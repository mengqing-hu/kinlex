"""Give the learner an entry of their own for each word their videos use that the vocabulary lacks.

While a video is processed, the model names the dictionary form of every word the lexicon cannot
place. A form the vocabulary has no entry for is left with no word_id and match_source 'model'.
This writes an entry for each such form, the way the vocabulary's own are written: the model
gives the headword, its class, level and meanings, the sentence from the video becomes its
example, and the vocabulary's enrichment adds gender, plural and the word's parts. The entry
belongs to the learner (owner_id), so only they see it, and later videos link to it directly.

It runs after a video is done, so the learner can study the video while it works:

    python -m video.entries --language es            # every learner's waiting words
    python -m video.entries --language es --dry-run  # show the entries without saving them
"""

import argparse
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

import psycopg
from pydantic import Field

from config import Config, get_config, get_settings
from core.annotation import Lexicon
from core.languages import language_profile
from core.meaning_languages import language_name
from core.models import Record, Word
from core.pipeline import Enricher, ValidationError, _generate_json, _run_many
from services import db, example_tokens
from services.clients import create_llm, model_client
from utils.runtime import Cache, RunSummary, get_logger, read_prompt, setup_logging

PROMPT = "video_word_entry_v1"
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
WORD_CLASSES = (
    "noun",
    "verb",
    "adjective",
    "adverb",
    "pronoun",
    "preposition",
    "conjunction",
    "interjection",
    "article",
    "numeral",
)
MAX_MEANING_LENGTH = 60
SENTENCES_PER_WORD = 3


class VideoWordEntry(Record):
    word: str = ""
    phrase: str | None = None
    word_class: str = ""
    level: str = ""
    meanings: dict[str, str] = Field(default_factory=dict)
    is_word: bool = True


@dataclass
class Sighting:
    """Where a word is said: the caption line, so its sentence can be the entry's example."""

    video_id: str
    line: int
    text: str
    start_ms: int
    end_ms: int
    translations: dict[str, str]


@dataclass
class MissingWord:
    lemma: str
    forms: set[str] = field(default_factory=set)
    sightings: list[Sighting] = field(default_factory=list)


def _missing_words(
    connection: psycopg.Connection[Any], *, language: str, owner_id: str, video_id: str | None
) -> tuple[dict[str, MissingWord], list[str]]:
    """The waiting words of an owner's videos by lowercase lemma, and the meaning languages
    their videos are explained in."""
    rows = connection.execute(
        """
        select lower(t.lemma), lower(t.surface), t.video_id, t.line, l.text, l.start_ms, l.end_ms
        from public.video_tokens t
        join public.videos v on v.id = t.video_id
        join public.video_lines l on l.video_id = t.video_id and l.position = t.line
        where v.owner_id = %s and v.language = %s and v.status <> 'archived'
          and (%s::text is null or v.id = %s)
          and t.word_id is null and t.match_source = 'model'
        order by t.video_id, t.line, t.position
        """,
        (owner_id, language, video_id, video_id),
    ).fetchall()
    translations: dict[tuple[str, int], dict[str, str]] = defaultdict(dict)
    for video, line, meaning_language, translation in connection.execute(
        """
        select tr.video_id, tr.position, tr.meaning_language, tr.translation
        from public.video_line_translations tr
        join public.videos v on v.id = tr.video_id
        where v.owner_id = %s and v.language = %s and (%s::text is null or v.id = %s)
        """,
        (owner_id, language, video_id, video_id),
    ).fetchall():
        translations[(video, line)][meaning_language] = translation
    words: dict[str, MissingWord] = {}
    for lemma, surface, video, line, text, start_ms, end_ms in rows:
        word = words.setdefault(lemma, MissingWord(lemma))
        word.forms.add(surface)
        seen = {(sighting.video_id, sighting.line) for sighting in word.sightings}
        if len(word.sightings) < SENTENCES_PER_WORD and (video, line) not in seen:
            word.sightings.append(
                Sighting(video, line, text, start_ms, end_ms, translations[(video, line)])
            )
    meaning_languages = sorted(
        {"en"} | {language for line in translations.values() for language in line}
    )
    return words, meaning_languages


def _validate(entry: VideoWordEntry, meaning_languages: list[str]) -> None:
    if not entry.is_word:
        return
    if not entry.word.strip() or len(entry.word) > MAX_MEANING_LENGTH:
        raise ValidationError("no headword")
    if entry.word_class not in WORD_CLASSES:
        raise ValidationError(f"unknown word class {entry.word_class!r}")
    if entry.level not in LEVELS:
        raise ValidationError(f"unknown level {entry.level!r}")
    for code in meaning_languages:
        meaning = entry.meanings.get(code, "").strip()
        if not meaning or len(meaning) > MAX_MEANING_LENGTH or "\n" in meaning:
            raise ValidationError(f"bad {code} meaning")


def _ask(
    config: Config,
    llm: Any,
    cache: Cache,
    summary: RunSummary,
    *,
    language: str,
    word: MissingWord,
    meaning_languages: list[str],
) -> tuple[VideoWordEntry, bool]:
    source = language_name(language)
    sentences = "\n".join(
        f"- {sighting.text}"
        + (f" ({sighting.translations['en']})" if "en" in sighting.translations else "")
        for sighting in word.sightings
    )
    return _generate_json(
        llm=llm,
        cache=cache,
        word=word.lemma,
        model=config.providers.llm.model,
        system=f"You are a careful {source} dictionary editor. Reply with JSON only.",
        prompt=read_prompt(PROMPT).substitute(
            source_language=source,
            lemma=word.lemma,
            forms=", ".join(sorted(word.forms)),
            sentences=sentences,
            word_classes=", ".join(WORD_CLASSES),
            meaning_languages=", ".join(
                f"{code} ({language_name(code)})" for code in meaning_languages
            ),
        ),
        schema=VideoWordEntry,
        validate=lambda entry: _validate(entry, meaning_languages),
        config=config,
        summary=summary,
    )


def _link(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    owner_id: str,
    lemma: str,
    word_id: int | None,
    headword: str,
    filtered: str | None = None,
) -> None:
    """Point every waiting word of the owner's videos with this lemma at its entry."""
    connection.execute(
        """
        update public.video_tokens t
        set word_id = %s, lemma = %s,
            match_source = case when %s::text is null then t.match_source else 'filtered' end,
            filter_reason = %s
        from public.videos v
        where v.id = t.video_id and v.owner_id = %s and v.language = %s
          and t.word_id is null and t.match_source = 'model' and lower(t.lemma) = %s
        """,
        (word_id, headword, filtered, filtered, owner_id, language, lemma),
    )


def _create(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    owner_id: str,
    word: MissingWord,
    entry: VideoWordEntry,
) -> Word:
    """Store the entry, its meanings and its example from the video; an entry the owner already
    has with that headword and class gains the example instead."""
    headword = entry.word.strip()
    row = connection.execute(
        """
        select id from public.words
        where owner_id = %s and language = %s and word = %s and word_class = %s
        """,
        (owner_id, language, headword, entry.word_class),
    ).fetchone()
    if row is None:
        row = connection.execute(
            """
            insert into public.words
              (language, word, slug, word_class, level, level_source, status, source, owner_id)
            values (%s, %s, %s, %s, %s, 'estimated', 'published', 'video', %s)
            returning id
            """,
            (
                language,
                headword,
                db._available_slug(connection, language, headword, entry.word_class, owner_id),
                entry.word_class,
                entry.level,
                owner_id,
            ),
        ).fetchone()
        assert row is not None
        for meaning_language, meaning in entry.meanings.items():
            connection.execute(
                """
                insert into public.senses (word_id, meaning_language, word_meaning, sort_order)
                values (%s, %s, %s, 0)
                """,
                (row[0], meaning_language, meaning.strip()),
            )
    word_id = int(row[0])

    sighting = word.sightings[0]
    example = connection.execute(
        """
        insert into public.examples
          (language, example_sentence, level, status, source, owner_id)
        values (%s, %s, %s, 'published', 'video', %s)
        on conflict (owner_id, language, example_sentence) where owner_id is not null
        do update set level = public.examples.level
        returning id
        """,
        (language, sighting.text, entry.level, owner_id),
    ).fetchone()
    assert example is not None
    example_id = int(example[0])
    for meaning_language, translation in sighting.translations.items():
        connection.execute(
            """
            insert into public.example_translations (example_id, meaning_language, sentence_meaning)
            values (%s, %s, %s)
            on conflict (example_id, meaning_language) do nothing
            """,
            (example_id, meaning_language, translation),
        )
    connection.execute(
        """
        insert into public.example_links (example_id, target_type, target_id, sort_order)
        values (%s, 'word', %s, 0)
        on conflict (example_id, target_type, target_id) do nothing
        """,
        (example_id, word_id),
    )
    connection.execute(
        """
        insert into public.video_examples
          (video_id, example_id, first_line, last_line, start_ms, end_ms)
        values (%s, %s, %s, %s, %s, %s)
        on conflict do nothing
        """,
        (
            sighting.video_id,
            example_id,
            sighting.line,
            sighting.line,
            sighting.start_ms,
            sighting.end_ms,
        ),
    )
    for form in word.forms:
        connection.execute(
            """
            insert into public.word_forms (language, form, word_id, source, owner_id)
            values (%s, %s, %s, 'video', %s)
            on conflict do nothing
            """,
            (language, form, word_id, owner_id),
        )
    _link(
        connection,
        language=language,
        owner_id=owner_id,
        lemma=word.lemma,
        word_id=word_id,
        headword=headword,
    )
    return Word(
        id=word_id,
        language=language,
        word=headword,
        word_class=entry.word_class,
        word_meaning=entry.meanings.get("en", ""),
        example_sentence=sighting.text,
        sentence_meaning=sighting.translations.get("en"),
    )


def add_missing_words(
    config: Config,
    *,
    language: str,
    owner_id: str,
    video_id: str | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """Write entries for the owner's waiting words; returns how many words went each way."""
    profile = language_profile(language)
    summary = RunSummary("video_entries", language)
    counts: dict[str, int] = defaultdict(int)
    with db.connect() as connection:
        words, meaning_languages = _missing_words(
            connection, language=language, owner_id=owner_id, video_id=video_id
        )
        lexicon = Lexicon(
            example_tokens.lexicon_entries(
                connection, language=language, meaning_language="en", owner_id=owner_id
            ),
            profile,
        )
        # Entries made since the words were placed, by this run or another video, need no model.
        for lemma in list(words):
            entries = lexicon.lookup(lemma)
            if entries:
                counts["linked"] += 1
                if not dry_run:
                    with connection.transaction():
                        _link(
                            connection,
                            language=language,
                            owner_id=owner_id,
                            lemma=lemma,
                            word_id=entries[0].id,
                            headword=entries[0].word,
                        )
                del words[lemma]
    get_logger().info("%d words of %s need an entry", len(words), owner_id)
    if not words:
        return dict(counts)

    cache = Cache(language, "video_entries")
    with model_client(get_settings()) as client:
        llm = create_llm(client, config)
        answers, failed = _run_many(
            list(words.values()),
            lambda word: (
                (
                    word,
                    *_ask(
                        config,
                        llm,
                        cache,
                        summary,
                        language=language,
                        word=word,
                        meaning_languages=meaning_languages,
                    ),
                ),
                False,
            ),
            lambda word: word.lemma,
            summary,
            config.llm_concurrency,
        )
        counts["failed"] += failed

        created: list[Word] = []
        with db.connect() as connection:
            for word, entry, _cached in answers:
                existing = lexicon.lookup(entry.phrase or "") or lexicon.lookup(entry.word)
                if not entry.is_word:
                    outcome = "not a word"
                elif existing:
                    outcome = "linked"
                else:
                    outcome = "created"
                counts[outcome] += 1
                print(
                    f"{outcome:10} {word.lemma} -> {entry.phrase or entry.word} "
                    f"[{entry.word_class} {entry.level}] {entry.meanings}"
                )
                if dry_run:
                    continue
                with connection.transaction():
                    if not entry.is_word:
                        _link(
                            connection,
                            language=language,
                            owner_id=owner_id,
                            lemma=word.lemma,
                            word_id=None,
                            headword=word.lemma,
                            filtered="other",
                        )
                    elif existing:
                        _link(
                            connection,
                            language=language,
                            owner_id=owner_id,
                            lemma=word.lemma,
                            word_id=existing[0].id,
                            headword=existing[0].word,
                        )
                    else:
                        created.append(
                            _create(
                                connection,
                                language=language,
                                owner_id=owner_id,
                                word=word,
                                entry=entry,
                            )
                        )

        # The vocabulary's enrichment: gender, article, plural and the word's parts. An entry it
        # fails for keeps its meanings and example.
        enricher = Enricher(config, language=language, llm=llm, summary=summary)
        unique = list({word.id: word for word in created}.values())
        _done, enrich_failed = _run_many(
            unique,
            lambda word: (word, enricher.enrich(word, word.word_class)),
            lambda word: word.word,
            summary,
            config.llm_concurrency,
        )
        counts["not enriched"] += enrich_failed
    summary.write()
    return dict(counts)


def _owners(language: str) -> list[str]:
    with db.connect() as connection:
        rows = connection.execute(
            """
            select distinct v.owner_id from public.video_tokens t
            join public.videos v on v.id = t.video_id
            where v.language = %s and t.word_id is null and t.match_source = 'model'
            """,
            (language,),
        ).fetchall()
    return [str(row[0]) for row in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--language", default="es")
    parser.add_argument("--owner-id", help="only this learner's videos")
    parser.add_argument("--video", help="only this video id")
    parser.add_argument("--dry-run", action="store_true", help="show the entries, save nothing")
    args = parser.parse_args()
    setup_logging("video_entries", args.language)
    config = get_config()
    for owner_id in [args.owner_id] if args.owner_id else _owners(args.language):
        counts = add_missing_words(
            config,
            language=args.language,
            owner_id=owner_id,
            video_id=args.video,
            dry_run=args.dry_run,
        )
        print(owner_id, ", ".join(f"{name}: {count}" for name, count in counts.items()))


if __name__ == "__main__":
    main()
