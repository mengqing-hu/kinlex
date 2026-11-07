"""Import the canonical CSV, generate missing fields, and create TTS audio."""

import argparse
from pathlib import Path

import httpx

from config import REPO_ROOT, get_config, get_settings
from core.annotation import annotate_examples
from core.consistency import ConsistencyResult
from core.models import Segment
from core.pipeline import (
    TaskResult,
    apply_root_consistency,
    export_review_data,
    generate_database_fields,
    generate_tts_audio,
    import_vocabulary,
    publish_vocabulary,
)
from core.topics import classify_topics
from core.translation import translate_meanings
from services.clients import revalidate_website
from utils.runtime import get_logger

DEFAULT_INPUT = REPO_ROOT / "data" / "vocabulary" / "german" / "german.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "data" / "output" / "de"
DEFAULT_BATCH_SIZE = 500


def _add_common_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"source CSV; defaults to {DEFAULT_INPUT}",
    )
    parser.add_argument("--language", default="de", help="ISO language code")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"review export directory; defaults to {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument("--limit", type=int, help="process at most N CSV rows")
    parser.add_argument("--batch", type=int, help="one-based batch number")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"rows per batch; defaults to {DEFAULT_BATCH_SIZE}",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="regenerate fields or audio that already exist",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="consistency: print the root changes without saving them; "
        "topics: ask the model and write the report, but save no topics",
    )
    parser.add_argument(
        "--lexicon-only",
        action="store_true",
        help="annotate only: store tokens and vocabulary meanings without calling the LLM",
    )
    parser.add_argument(
        "--meaning-language",
        default="en",
        help="translate and annotate: the language words are explained in, e.g. zh; defaults to en",
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="kinlex-pipeline",
        description="Process the canonical vocabulary CSV into database content and TTS audio.",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    for name, help_text in (
        ("import", "import CSV rows as draft content without calling any model"),
        ("fields", "use the LLM to generate missing database fields"),
        ("audio", "generate word and example-sentence TTS audio"),
        ("export", "export enriched CSV and JSON review files"),
        ("publish", "publish imported words and examples to the public frontend"),
        ("prepare", "generate fields, audio, and review files for one batch"),
        ("process", "generate, export, and publish one vocabulary batch"),
        ("run", "generate database fields and then TTS audio"),
        ("consistency", "expand roots that name other segmented words, across all batches"),
        ("annotate", "split example sentences into words with their meanings, for hover"),
        ("topics", "sort words into topics, for the topic filter and topic pages"),
        (
            "translate",
            "translate English word, sentence and word part meanings into --meaning-language",
        ),
    ):
        command = commands.add_parser(name, help=help_text)
        _add_common_options(command)
    return parser


def _selection(args: argparse.Namespace) -> tuple[int, int | None, str | None]:
    if args.batch is None:
        return 0, args.limit, None
    if args.batch < 1:
        raise ValueError("--batch must be at least 1")
    if args.batch_size < 1:
        raise ValueError("--batch-size must be at least 1")
    if args.limit is not None:
        raise ValueError("use either --batch or --limit, not both")
    offset = (args.batch - 1) * args.batch_size
    return offset, args.batch_size, f"{args.input.stem}_enriched_batch_{args.batch:04d}"


def _show(segments: list[Segment]) -> str:
    return " + ".join(
        f"{segment.word_part.strip()}[{segment.morpheme}]"
        for segment in segments
        if segment.morpheme_type is not None
    )


def _report_consistency(result: ConsistencyResult, *, dry_run: bool) -> None:
    verb = "would change" if dry_run else "changed"
    print(f"root consistency: {verb} {len(result.changes)} words")
    for change in result.changes:
        print(f"  {change.word.word}: {_show(change.before)} -> {_show(change.after)}")
    for item in result.unresolved:
        print(f"  unresolved {item.word.word}: {item.word_part!r} does not spell {item.target!r}")


def _revalidate(processed: int) -> None:
    settings = get_settings()
    if not processed or not settings.revalidation_enabled:
        return
    try:
        revalidate_website(settings)
    except httpx.HTTPError as error:
        get_logger().warning("website cache revalidation failed: %s", error)


def main() -> int:
    args = _parser().parse_args()
    if not args.input.is_file():
        raise FileNotFoundError(f"vocabulary CSV does not exist: {args.input}")

    if args.command == "consistency":
        _report_consistency(
            apply_root_consistency(language=args.language, dry_run=args.dry_run),
            dry_run=args.dry_run,
        )
        return 0

    if args.command == "topics":
        if args.batch is not None:
            raise ValueError("topics works through all words not yet sorted; use --limit")
        topics_result = classify_topics(
            get_config(),
            language=args.language,
            limit=args.limit,
            force=args.force,
            dry_run=args.dry_run,
            report_path=args.output_dir / f"topics_report{'_dry_run' if args.dry_run else ''}.md",
        )
        print(f"topics: sorted {topics_result.sorted} words, failed {topics_result.failed} batches")
        print(f"report: {topics_result.report}")
        return 1 if topics_result.failed else 0

    if args.command == "annotate":
        if args.batch is not None:
            raise ValueError("annotate works through examples in order; use --limit")
        result = annotate_examples(
            get_config(),
            language=args.language,
            limit=args.limit,
            force=args.force,
            use_model=not args.lexicon_only,
            meaning_language=args.meaning_language,
        )
        print(f"annotate: processed {result.processed}, failed {result.failed}")
        return 1 if result.failed else 0

    if args.command == "translate":
        if args.batch is not None:
            raise ValueError("translate works through what is still missing; use --limit")
        translated = translate_meanings(
            get_config(),
            language=args.language,
            meaning_language=args.meaning_language,
            limit=args.limit,
            force=args.force,
        )
        for name, part in (
            ("words", translated.words),
            ("sentences", translated.sentences),
            ("word parts", translated.morphemes),
        ):
            print(f"translate {name}: {part.processed} batches done, {part.failed} failed")
        _revalidate(sum(part.processed for part in (translated.words, translated.sentences)))
        return 1 if translated.failed else 0

    offset, limit, file_stem = _selection(args)
    config = get_config()
    results: list[TaskResult] = []
    if args.command in {"fields", "prepare", "process", "run"}:
        results.append(
            generate_database_fields(
                config,
                language=args.language,
                input_path=args.input,
                offset=offset,
                limit=limit,
                force=args.force,
            )
        )
        # New segmentations can be roots of earlier words and the other way round.
        _report_consistency(apply_root_consistency(language=args.language), dry_run=False)
    if args.command in {"audio", "prepare", "process", "run"}:
        results.append(
            generate_tts_audio(
                config,
                language=args.language,
                input_path=args.input,
                offset=offset,
                limit=limit,
                force=args.force,
            )
        )

    if args.command == "import":
        imported = import_vocabulary(
            language=args.language, input_path=args.input, offset=offset, limit=limit
        )
        print(f"imported words: {imported}")
        return 0

    if args.command == "publish":
        published_words, published_examples = publish_vocabulary(
            language=args.language,
            input_path=args.input,
            offset=offset,
            limit=limit,
        )
        print(f"published words: {published_words}")
        print(f"published examples: {published_examples}")
        _revalidate(published_words + published_examples)
        return 0

    if args.command in {"fields", "export", "prepare", "process", "run"}:
        csv_path, json_path = export_review_data(
            language=args.language,
            input_path=args.input,
            output_dir=args.output_dir,
            offset=offset,
            limit=limit,
            file_stem=file_stem,
        )
        print(f"review CSV: {csv_path}")
        print(f"review JSON: {json_path}")

    if args.command == "process":
        if any(result.failed for result in results):
            print("publishing skipped because generation tasks failed")
            return 1
        published_words, published_examples = publish_vocabulary(
            language=args.language,
            input_path=args.input,
            offset=offset,
            limit=limit,
        )
        print(f"published words: {published_words}")
        print(f"published examples: {published_examples}")
        _revalidate(published_words + published_examples)
        return 0

    _revalidate(sum(result.processed for result in results))
    return 1 if any(result.failed for result in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
