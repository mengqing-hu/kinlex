"""Link the words of stored videos that were left without a vocabulary entry.

The lexicon learns to find more words over time (malas is malo, hacerlo is hacer). This runs it
again over every stored caption line and links each word that has no entry yet and now finds one.
Words already linked keep their entry, and the meanings shown for them stay as they are.

With --ask-model, the words still left are sent to the language model, which gives each its
dictionary form (puedas is poder) and says whether it is a word at all: names, sounds, foreign
words and numbers are marked so no entry is ever made for them. Their meanings stay as they are.

    python -m scripts.relink_video_words --dry-run
    python -m scripts.relink_video_words --language es --ask-model
"""

import argparse
import functools
from collections import Counter, defaultdict
from typing import Any

import psycopg

from config import get_config, get_settings
from core.annotation import (
    Lexicon,
    gloss_batches,
    load_spacy,
    place_form,
    request_glosses_and_forms,
    tokenize,
)
from core.languages import language_profile
from core.models import TokenToGloss, WordForm
from core.pipeline import PipelineError, _run_many
from services import db, example_tokens
from services.clients import create_llm, model_client
from utils.runtime import Cache, RunSummary

# (word_id, lemma, match_source, filter_reason, video_id, line, position)
Update = tuple[int | None, str, str | None, str | None, str, int, int]


def _owner_lexicons(
    connection: psycopg.Connection[Any], language: str, video: str | None = None
) -> tuple[list[tuple[str, Any]], dict[Any, Lexicon]]:
    profile = language_profile(language)
    videos = connection.execute(
        """
        select id, owner_id from public.videos
        where language = %s and (%s::text is null or id = %s)
        order by id
        """,
        (language, video, video),
    ).fetchall()
    lexicons = {
        owner_id: Lexicon(
            example_tokens.lexicon_entries(
                connection, language=language, meaning_language="en", owner_id=str(owner_id)
            ),
            profile,
        )
        for owner_id in {owner_id for _video, owner_id in videos}
    }
    return [(row[0], row[1]) for row in videos], lexicons


def _batch_name(video_id: str, batch: list[TokenToGloss]) -> str:
    return f"{video_id} lines {batch[0].example_id}-{batch[-1].example_id}"


def _save(connection: psycopg.Connection[Any], updates: list[Update]) -> None:
    with connection.transaction():
        connection.cursor().executemany(
            """
            update public.video_tokens
            set word_id = %s, lemma = %s, match_source = %s, filter_reason = %s
            where video_id = %s and line = %s and position = %s
            """,
            updates,
        )


def relink(language: str, *, video: str | None, dry_run: bool) -> None:
    """Run the lexicon again over the words still without an entry."""
    nlp = load_spacy(language_profile(language).spacy_model)
    linked: Counter[tuple[str, str]] = Counter()
    left = 0
    with db.connect() as connection:
        videos, lexicons = _owner_lexicons(connection, language, video)
        for video_id, owner_id in videos:
            lines = dict(
                connection.execute(
                    "select position, text from public.video_lines where video_id = %s",
                    (video_id,),
                ).fetchall()
            )
            unlinked: dict[int, list[tuple[int, int, int, str]]] = defaultdict(list)
            for line, position, start, end, surface in connection.execute(
                """
                select line, position, start, "end", surface from public.video_tokens
                where video_id = %s and word_id is null and match_source is null
                """,
                (video_id,),
            ).fetchall():
                unlinked[line].append((position, start, end, surface))

            updates: list[Update] = []
            for line, tokens in unlinked.items():
                found = {
                    (token.start, token.end): token
                    for token in tokenize(nlp, lexicons[owner_id], lines[line])
                    if token.word_id is not None
                }
                for position, start, end, surface in tokens:
                    token = found.get((start, end))
                    if token is None:
                        left += 1
                        continue
                    linked[(surface.lower(), token.lemma)] += 1
                    updates.append(
                        (token.word_id, token.lemma, None, None, video_id, line, position)
                    )
            if updates and not dry_run:
                _save(connection, updates)

    for (surface, lemma), count in linked.most_common():
        print(f"{count:4}  {surface} -> {lemma}")
    verb = "would link" if dry_run else "linked"
    print(f"{verb} {sum(linked.values())} words in {len(videos)} videos; {left} still unlinked")


def ask_model(language: str, *, video: str | None, dry_run: bool) -> None:
    """Ask the model for the dictionary form and kind of the words still without an entry."""
    config = get_config()
    summary = RunSummary("video_forms", language)
    cache = Cache(language, "token_glosses")
    outcomes: Counter[str] = Counter()
    shown: Counter[tuple[str, str, str]] = Counter()
    with db.connect() as connection:
        videos, lexicons = _owner_lexicons(connection, language, video)
        pending: list[tuple[str, Any, list[TokenToGloss]]] = []
        for video_id, owner_id in videos:
            translations = dict(
                connection.execute(
                    """
                    select position, translation from public.video_line_translations
                    where video_id = %s and meaning_language = 'en'
                    """,
                    (video_id,),
                ).fetchall()
            )
            rows = [
                TokenToGloss(
                    example_id=line,
                    sentence=text,
                    translation=translations.get(line),
                    position=position,
                    surface=surface,
                    lemma=lemma,
                )
                for line, text, position, surface, lemma in connection.execute(
                    """
                    select t.line, l.text, t.position, t.surface, t.lemma
                    from public.video_tokens t
                    join public.video_lines l on l.video_id = t.video_id and l.position = t.line
                    where t.video_id = %s and t.word_id is null and t.match_source is null
                    order by t.line, t.position
                    """,
                    (video_id,),
                ).fetchall()
            ]
            if rows:
                pending.append((video_id, owner_id, rows))

    print(f"{sum(len(rows) for _v, _o, rows in pending)} words in {len(pending)} videos")
    with model_client(get_settings()) as client:
        llm = create_llm(client, config)
        for video_id, owner_id, rows in pending:
            lexicon = lexicons[owner_id]

            def forms_of(
                batch: list[TokenToGloss], lexicon: Lexicon = lexicon
            ) -> tuple[dict[tuple[int, int], WordForm], bool]:
                _glosses, forms, cached = request_glosses_and_forms(
                    llm,
                    batch,
                    lexicon,
                    language=language,
                    meaning_language="en",
                    cache=cache,
                    config=config,
                    summary=summary,
                )
                return forms, cached

            results, failed = _run_many(
                gloss_batches(rows),
                forms_of,
                functools.partial(_batch_name, video_id),
                summary,
                config.llm_concurrency,
            )
            if failed:
                raise PipelineError(f"{failed} batches of {video_id} failed; run again to retry")
            surfaces = {(row.example_id, row.position): row.surface for row in rows}
            updates: list[Update] = []
            for found in results:
                for (line, position), form in found.items():
                    placed = place_form(lexicon, form)
                    source = "filtered" if placed.filtered else "model"
                    outcome = placed.filtered or ("linked" if placed.word_id else "missing")
                    outcomes[outcome] += 1
                    shown[(outcome, surfaces[(line, position)].lower(), placed.lemma)] += 1
                    updates.append(
                        (
                            placed.word_id,
                            placed.lemma,
                            source,
                            placed.filtered,
                            video_id,
                            line,
                            position,
                        )
                    )
            if updates and not dry_run:
                with db.connect() as connection:
                    _save(connection, updates)
    summary.write()

    for (outcome, surface, lemma), count in sorted(shown.items(), key=lambda item: -item[1]):
        print(f"{count:4}  {outcome:12} {surface} -> {lemma}")
    print(", ".join(f"{outcome}: {count}" for outcome, count in outcomes.most_common()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--language", default="es")
    parser.add_argument("--video", help="only this video id")
    parser.add_argument("--dry-run", action="store_true", help="list the changes without saving")
    parser.add_argument(
        "--ask-model",
        action="store_true",
        help="ask the language model about the words the lexicon still cannot place",
    )
    args = parser.parse_args()
    if args.ask_model:
        ask_model(args.language, video=args.video, dry_run=args.dry_run)
    else:
        relink(args.language, video=args.video, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
