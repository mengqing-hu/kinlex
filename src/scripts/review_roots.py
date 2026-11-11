"""Ask the language model to review the word families under every root, and report the problems.

Run from src/ after the vocabulary is segmented:

    python -m scripts.review_roots --language es

Each root is segmented one word at a time, so a word can land under a root it only shares a
spelling with (pasar under pass-, suffer) and a root's meaning may fit only the first word that
used it. The model sees each root with all its words and lists the words that do not belong, with
the stem they should have, and a better meaning where the root's own does not fit. Nothing is
changed: the report is for review, and the JSON next to it holds the same findings for applying the
fixes that are accepted. Replies are cached, so a rerun only asks about roots that changed.
"""

import argparse
from collections.abc import Sequence
from pathlib import Path

from config import REPO_ROOT, get_config, get_settings
from core.meaning_languages import language_name
from core.models import RootFamily, RootReviewReply, RootVerdict
from core.pipeline import ValidationError, _generate_json, _run_many
from services import db
from services.clients import create_llm, model_client
from utils.roots import load_etymological_roots
from utils.runtime import Cache, RunSummary, read_prompt, setup_logging

PROMPT = "root_review_v1"
# Small enough for the model to look at every word, large enough to keep the calls few.
WORDS_PER_CALL = 120
ROOTS_PER_CALL = 20


def _batches(families: Sequence[RootFamily]) -> list[list[RootFamily]]:
    batches: list[list[RootFamily]] = []
    batch: list[RootFamily] = []
    words = 0
    for family in families:
        if batch and (len(batch) >= ROOTS_PER_CALL or words + len(family.words) > WORDS_PER_CALL):
            batches.append(batch)
            batch, words = [], 0
        batch.append(family)
        words += len(family.words)
    if batch:
        batches.append(batch)
    return batches


def _request(batch: Sequence[RootFamily]) -> str:
    blocks = []
    for family in batch:
        kind = " (listed Latin or Greek root)" if family.listed else ""
        lines = [f"id {family.id}: root {family.root}{kind}, meaning: {family.meaning}"]
        lines += [
            f'- {word.word}: part "{word.word_part}", {word.meaning or "no meaning"}'
            for word in family.words
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _validate(reply: RootReviewReply, batch: Sequence[RootFamily]) -> None:
    families = {family.id: family for family in batch}
    if sorted(verdict.id for verdict in reply.roots) != sorted(families):
        raise ValidationError("the reply does not cover exactly the roots asked about")
    for verdict in reply.roots:
        family = families[verdict.id]
        words = {word.word for word in family.words}
        for outlier in verdict.outliers:
            if outlier.word not in words:
                raise ValidationError(f"{outlier.word!r} is not a word of {family.root}")
        if family.listed and verdict.meaning:
            raise ValidationError(f"the meaning of the listed root {family.root} is fixed")


def review(
    language: str, limit: int | None
) -> tuple[list[RootFamily], dict[int, RootVerdict], int]:
    setup_logging("root_review", language)
    summary = RunSummary("root_review", language)
    listed = {name for _type, name in load_etymological_roots(language)}
    with db.connect() as connection:
        families = [
            family.model_copy(update={"listed": family.root in listed})
            for family in db.root_families(connection, language=language)
        ]
    families = families[:limit] if limit is not None else families
    config = get_config()
    template = read_prompt(PROMPT)
    cache = Cache(language, "root_review")
    system = f"You are a careful {language_name(language)} lexicographer. Reply with JSON only."
    with model_client(get_settings()) as client:
        llm = create_llm(client, config)

        def ask(batch: list[RootFamily]) -> tuple[list[RootVerdict], bool]:
            reply, cached = _generate_json(
                llm=llm,
                cache=cache,
                word=f"roots {batch[0].root}..{batch[-1].root}",
                model=config.providers.llm.model,
                prompt=template.substitute(language=language_name(language), roots=_request(batch)),
                schema=RootReviewReply,
                validate=lambda value: _validate(value, batch),
                config=config,
                summary=summary,
                system=system,
            )
            return reply.roots, cached

        results, failed = _run_many(
            _batches(families),
            ask,
            lambda batch: f"roots {batch[0].root}..{batch[-1].root}",
            summary,
            config.llm_concurrency,
        )
    summary.write()
    return families, {verdict.id: verdict for batch in results for verdict in batch}, failed


def report(families: Sequence[RootFamily], verdicts: dict[int, RootVerdict], failed: int) -> str:
    by_id = {family.id: family for family in families}
    with_outliers = [v for v in verdicts.values() if v.outliers]
    with_meaning = [v for v in verdicts.values() if v.meaning]
    lines = [
        "# Root review",
        "",
        f"{len(families)} roots with two or more words; {len(verdicts)} reviewed, "
        f"{failed} batches failed. {len(with_outliers)} roots have words that do not belong, "
        f"{len(with_meaning)} have a meaning to change.",
        "",
        f"## Words that do not belong ({sum(len(v.outliers) for v in with_outliers)})",
        "",
        "Largest families first. Each word is followed by the stem the model suggests.",
    ]
    for verdict in sorted(with_outliers, key=lambda v: -len(by_id[v.id].words)):
        family = by_id[verdict.id]
        kept = [w.word for w in family.words if w.word not in {o.word for o in verdict.outliers}]
        lines += [
            "",
            f"### `{family.root}` — {family.meaning} ({len(family.words)} words)",
            "",
            f"Stays: {', '.join(kept) or 'none'}",
            "",
        ]
        lines += [
            f"- **{o.word}** → `{o.root or '?'}` ({o.root_meaning or '?'}): {o.reason}"
            for o in verdict.outliers
        ]
    lines += ["", f"## Meanings to change ({len(with_meaning)})", ""]
    lines += [
        f"- `{by_id[v.id].root}`: {by_id[v.id].meaning} → **{v.meaning}** "
        f"({', '.join(w.word for w in by_id[v.id].words[:6])})"
        for v in sorted(with_meaning, key=lambda v: by_id[v.id].root)
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Review the word families under every root.")
    parser.add_argument("--language", default="es")
    parser.add_argument("--limit", type=int, help="review only the first N roots")
    parser.add_argument("--output-dir", type=Path, help="defaults to data/output/<language>/")
    args = parser.parse_args()
    output_dir = args.output_dir or REPO_ROOT / "data" / "output" / args.language
    families, verdicts, failed = review(args.language, args.limit)
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "root_review.md"
    report_path.write_text(report(families, verdicts, failed), encoding="utf-8")
    findings = RootReviewReply(roots=[v for v in verdicts.values() if v.outliers or v.meaning])
    (output_dir / "root_review.json").write_text(
        findings.model_dump_json(indent=2) + "\n", encoding="utf-8"
    )
    print(f"report: {report_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
