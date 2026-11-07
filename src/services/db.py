"""Database reads and idempotent writes for enrichment and audio."""

import re
import sys
import unicodedata
from collections.abc import Iterator
from contextlib import contextmanager
from functools import cache
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from config import database_host, get_settings, is_production
from core.models import (
    AudioResult,
    AudioTarget,
    ReviewMetadata,
    Segment,
    VocabularyItem,
    Word,
    WordEnrichment,
)


def _slugify(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).lower()
    for source, replacement in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        text = text.replace(source, replacement)
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")


_WORD_COLUMNS = """
    select w.id, w.language, w.word, w.word_class, w.gender, w.plural,
           coalesce((
             select s.word_meaning
             from public.senses s
             where s.word_id = w.id
             order by s.sort_order
             limit 1
           ), '') as word_meaning,
           (
             select e.example_sentence
             from public.example_links el
             join public.examples e on e.id = el.example_id
             where el.target_type = 'word' and el.target_id = w.id
             order by el.sort_order, e.id
             limit 1
           ) as example_sentence,
           (
             select sm.sentence_meaning
             from public.example_links el
             join public.example_translations sm on sm.example_id = el.example_id
             where el.target_type = 'word' and el.target_id = w.id
               and sm.meaning_language = 'en'
             order by el.sort_order, el.example_id
             limit 1
           ) as sentence_meaning
    from public.words w
"""
_WORD_ORDER = """
    order by array_position(array['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], w.level),
             w.freq_rank nulls last,
             w.id
    limit %s
"""


@cache
def _announce_production(host: str) -> None:
    print(
        f"KINLEX_TARGET=production: working on the production database at {host}", file=sys.stderr
    )


@contextmanager
def connect() -> Iterator[psycopg.Connection[Any]]:
    settings = get_settings()
    settings.require("database_url")
    if is_production():
        _announce_production(database_host(settings))
    with psycopg.connect(settings.database_url.get_secret_value()) as connection:
        yield connection


def _available_slug(
    connection: psycopg.Connection[Any], language: str, word: str, word_class: str
) -> str:
    base = _slugify(word) or "entry"
    candidates = (base, f"{base}-{_slugify(word_class)}")
    for candidate in candidates:
        exists = connection.execute(
            "select 1 from public.words where language = %s and slug = %s",
            (language, candidate),
        ).fetchone()
        if exists is None:
            return candidate
    suffix = 2
    while True:
        candidate = f"{base}-{_slugify(word_class)}-{suffix}"
        exists = connection.execute(
            "select 1 from public.words where language = %s and slug = %s",
            (language, candidate),
        ).fetchone()
        if exists is None:
            return candidate
        suffix += 1


def _word_from_row(row: tuple[Any, ...]) -> Word:
    return Word(
        id=row[0],
        language=row[1],
        word=row[2],
        word_class=row[3],
        gender=row[4],
        plural=row[5],
        word_meaning=row[6],
        example_sentence=row[7],
        sentence_meaning=row[8],
    )


def import_vocabulary(
    connection: psycopg.Connection[Any], items: list[VocabularyItem]
) -> list[Word]:
    """Upsert CSV rows and return their database records."""
    for item in items:
        word_class = item.word_class
        row = connection.execute(
            """
            select id from public.words
            where language = %s and word = %s and word_class = %s
            """,
            (item.language, item.word, word_class),
        ).fetchone()
        if row is None:
            row = connection.execute(
                """
                insert into public.words
                  (language, word, slug, word_class, word_class_detail, level, level_source,
                   status, source)
                values (%s, %s, %s, %s, %s, %s, 'estimated', 'draft', 'vocabulary_csv')
                returning id
                """,
                (
                    item.language,
                    item.word,
                    _available_slug(connection, item.language, item.word, word_class),
                    word_class,
                    item.word_class_detail,
                    item.level,
                ),
            ).fetchone()
        else:
            connection.execute(
                """
                update public.words
                set level = %s, level_source = 'estimated', source = 'vocabulary_csv',
                    word_class_detail = %s
                where id = %s
                """,
                (item.level, item.word_class_detail, row[0]),
            )
        assert row is not None
        word_id = int(row[0])
        if item.word_meaning:
            existing_meaning = connection.execute(
                """
                select 1 from public.senses
                where word_id = %s and meaning_language = 'en' and word_meaning = %s
                """,
                (word_id, item.word_meaning),
            ).fetchone()
            if existing_meaning is None:
                connection.execute(
                    """
                    insert into public.senses
                      (word_id, meaning_language, word_meaning, sort_order)
                    select %s, 'en', %s, coalesce(max(sort_order), -1) + 1
                    from public.senses where word_id = %s and meaning_language = 'en'
                    """,
                    (word_id, item.word_meaning, word_id),
                )
        if item.example_sentence:
            example = connection.execute(
                """
                insert into public.examples (language, example_sentence, level, status, source)
                values (%s, %s, %s, 'draft', 'vocabulary_csv')
                on conflict (language, example_sentence) do update set level = excluded.level
                returning id
                """,
                (item.language, item.example_sentence, item.level),
            ).fetchone()
            assert example is not None
            example_id = int(example[0])
            if item.sentence_meaning:
                connection.execute(
                    """
                    insert into public.example_translations
                      (example_id, meaning_language, sentence_meaning)
                    values (%s, 'en', %s)
                    on conflict (example_id, meaning_language)
                    do update set sentence_meaning = excluded.sentence_meaning
                    """,
                    (example_id, item.sentence_meaning),
                )
            connection.execute(
                """
                insert into public.example_links (example_id, target_type, target_id, sort_order)
                values (%s, 'word', %s, 0)
                on conflict (example_id, target_type, target_id) do nothing
                """,
                (example_id, word_id),
            )
    pairs = [(item.language, item.word, item.word_class) for item in items]
    if not pairs:
        return []
    rows = connection.execute(
        f"""
        {_WORD_COLUMNS}
        where (w.language, w.word, w.word_class) in (
          select * from unnest(%s::text[], %s::text[], %s::text[])
        )
        """,
        ([p[0] for p in pairs], [p[1] for p in pairs], [p[2] for p in pairs]),
    ).fetchall()
    return [_word_from_row(row) for row in rows]


def words_for_enrichment(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    limit: int | None,
    force: bool,
    word_ids: list[int] | None = None,
) -> list[Word]:
    missing = (
        ""
        if force
        else ("and not exists (select 1 from public.word_morphemes wm where wm.word_id = w.id)")
    )
    selected_filter = "" if word_ids is None else "and w.id = any(%s)"
    params: tuple[object, ...] = (
        (language, limit) if word_ids is None else (language, word_ids, limit)
    )
    rows = connection.execute(
        f"""{_WORD_COLUMNS}
        where w.language = %s
          and w.source = 'vocabulary_csv'
          and w.status in ('draft', 'in_review', 'published')
          {selected_filter}
          {missing}
        {_WORD_ORDER}
        """,
        params,
    ).fetchall()
    return [_word_from_row(row) for row in rows]


def _segments_by_word(
    connection: psycopg.Connection[Any], word_ids: list[int]
) -> dict[int, list[Segment]]:
    segments_by_word: dict[int, list[Segment]] = {word_id: [] for word_id in word_ids}
    if not word_ids:
        return segments_by_word
    rows = connection.execute(
        """
        select wm.word_id, wm.word_part, m.morpheme_type, m.morpheme,
               m.morpheme_meaning, m.is_separable
        from public.word_morphemes wm
        left join public.morphemes m on m.id = wm.morpheme_id
        where wm.word_id = any(%s)
        order by wm.word_id, wm.position
        """,
        (word_ids,),
    ).fetchall()
    for row in rows:
        segments_by_word[int(row[0])].append(
            Segment(
                word_part=row[1],
                morpheme_type=row[2],
                morpheme=row[3],
                morpheme_meaning=row[4],
                is_separable=row[5],
            )
        )
    return segments_by_word


def segmented_words(
    connection: psycopg.Connection[Any], *, language: str
) -> list[tuple[Word, list[Segment]]]:
    """Every vocabulary word that already has a segmentation, with its parts in order."""
    rows = connection.execute(
        f"""{_WORD_COLUMNS}
        where w.language = %s
          and w.source = 'vocabulary_csv'
          and exists (select 1 from public.word_morphemes wm where wm.word_id = w.id)
        {_WORD_ORDER}
        """,
        (language, None),
    ).fetchall()
    words = [_word_from_row(row) for row in rows]
    segments_by_word = _segments_by_word(connection, [word.id for word in words])
    return [(word, segments_by_word[word.id]) for word in words]


def review_metadata(
    connection: psycopg.Connection[Any], *, language: str
) -> dict[tuple[str, str], ReviewMetadata]:
    words = connection.execute(
        """
        select id, word, word_class, gender, article, plural,
               model_info #>> '{word_enrichment,model}' as generation_model
        from public.words
        where language = %s and source = 'vocabulary_csv'
        """,
        (language,),
    ).fetchall()
    segments_by_word = _segments_by_word(connection, [int(row[0]) for row in words])
    return {
        (row[1], row[2]): ReviewMetadata(
            word=row[1],
            word_class=row[2],
            gender=row[3],
            article=row[4],
            plural=row[5],
            generation_model=row[6],
            segments=segments_by_word[int(row[0])],
        )
        for row in words
    }


def audio_targets_for_words(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    accent: str,
    limit: int | None,
    force: bool,
    word_ids: list[int] | None = None,
) -> list[AudioTarget]:
    missing = (
        ""
        if force
        else (
            "and not exists (select 1 from public.audio a "
            "where a.owner_type = x.owner_type and a.owner_id = x.owner_id and a.accent = %s)"
        )
    )
    selected_filter = "" if word_ids is None else "and w.id = any(%s)"
    selected_params: tuple[object, ...] = (
        (language, limit) if word_ids is None else (language, word_ids, limit)
    )
    params = selected_params if force else (*selected_params, accent)
    rows = connection.execute(
        f"""
        with selected as (
          select w.id, w.language, w.word, w.gender from public.words w
          where w.language = %s
            and w.source = 'vocabulary_csv'
            and w.status in ('draft', 'in_review', 'published')
            {selected_filter}
          order by w.id limit %s
        ), targets as (
          select 'word'::text owner_type, s.id owner_id, s.language,
                 s.word text,
                 s.id word_id, s.gender from selected s
          union all
          select 'example', e.id, e.language, e.example_sentence, s.id, null
          from selected s
          join public.example_links l on l.target_type = 'word' and l.target_id = s.id
          join public.examples e on e.id = l.example_id
        )
        select x.owner_type, x.owner_id, x.language, x.text, x.word_id, x.gender
        from targets x where true {missing}
        """,
        params,
    ).fetchall()
    return [
        AudioTarget(
            owner_type=row[0],
            owner_id=row[1],
            language=row[2],
            text=row[3],
            word_id=row[4],
            gender=row[5],
        )
        for row in rows
    ]


def publish_vocabulary(
    connection: psycopg.Connection[Any],
    *,
    items: list[VocabularyItem],
) -> tuple[int, int]:
    """Publish existing CSV words and their linked examples for public frontend access."""
    pairs = [(item.language, item.word, item.word_class) for item in items]
    if not pairs:
        return 0, 0

    word_rows = connection.execute(
        """
        select w.id
        from public.words w
        where (w.language, w.word, w.word_class) in (
          select * from unnest(%s::text[], %s::text[], %s::text[])
        )
          and w.source = 'vocabulary_csv'
        """,
        ([p[0] for p in pairs], [p[1] for p in pairs], [p[2] for p in pairs]),
    ).fetchall()
    word_ids = [int(row[0]) for row in word_rows]
    if not word_ids:
        return 0, 0

    words = connection.execute(
        """
        update public.words
        set status = 'published', updated_at = now()
        where id = any(%s) and status <> 'published'
        returning id
        """,
        (word_ids,),
    ).fetchall()
    examples = connection.execute(
        """
        update public.examples e
        set status = 'published'
        where e.status <> 'published'
          and exists (
            select 1 from public.example_links l
            where l.example_id = e.id
              and l.target_type = 'word'
              and l.target_id = any(%s)
          )
        returning e.id
        """,
        (word_ids,),
    ).fetchall()
    return len(words), len(examples)


def replace_word_enrichment(
    connection: psycopg.Connection[Any],
    *,
    word: Word,
    enrichment: WordEnrichment,
    model: str,
    prompt: str,
) -> None:
    connection.execute(
        """
        update public.words
        set gender = %s, article = %s, plural = %s,
            model_info = coalesce(model_info, '{}'::jsonb) || %s
        where id = %s
        """,
        (
            enrichment.gender,
            enrichment.article,
            enrichment.plural,
            Jsonb({"word_enrichment": {"model": model, "prompt": prompt}}),
            word.id,
        ),
    )
    replace_word_segments(connection, word=word, segments=enrichment.segments)


def _available_morpheme_slug(connection: psycopg.Connection[Any], language: str, base: str) -> str:
    """Slugs are lowercase, so "Wert" (value) and "wert" (worth) need different ones."""
    candidate = base
    suffix = 2
    while connection.execute(
        "select 1 from public.morphemes where language = %s and slug = %s",
        (language, candidate),
    ).fetchone():
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def replace_word_segments(
    connection: psycopg.Connection[Any], *, word: Word, segments: list[Segment]
) -> None:
    connection.execute("delete from public.word_morphemes where word_id = %s", (word.id,))
    for position, segment in enumerate(segments):
        morpheme_id = None
        if segment.morpheme_type is not None:
            assert segment.morpheme is not None and segment.morpheme_meaning is not None
            # A verb stem gets its own slug: "druck-" must not land on the noun root "Druck".
            kind = (
                "stem"
                if segment.morpheme_type == "root" and segment.morpheme.endswith("-")
                else segment.morpheme_type
            )
            row = connection.execute(
                """
                select id from public.morphemes
                where language = %s and morpheme_type = %s and morpheme = %s
                """,
                (word.language, segment.morpheme_type, segment.morpheme),
            ).fetchone()
            if row is None:
                row = connection.execute(
                    """
                    insert into public.morphemes
                      (language, morpheme, morpheme_type, morpheme_meaning, is_separable, slug)
                    values (%s, %s, %s, %s, %s, %s)
                    returning id
                    """,
                    (
                        word.language,
                        segment.morpheme,
                        segment.morpheme_type,
                        segment.morpheme_meaning,
                        segment.is_separable,
                        _available_morpheme_slug(
                            connection, word.language, f"{_slugify(segment.morpheme)}-{kind}"
                        ),
                    ),
                ).fetchone()
                assert row is not None
            morpheme_id = int(row[0])
        connection.execute(
            """
            insert into public.word_morphemes (word_id, position, word_part, morpheme_id)
            values (%s, %s, %s, %s)
            """,
            (word.id, position, segment.word_part, morpheme_id),
        )


def sync_affix_meanings(
    connection: psycopg.Connection[Any], *, language: str, meanings: dict[tuple[str, str], str]
) -> int:
    """Overwrite stored prefix and suffix meanings with the curated dictionary."""
    if not meanings:
        return 0
    keys = list(meanings)
    rows = connection.execute(
        """
        update public.morphemes m
        set morpheme_meaning = d.meaning
        from unnest(%s::text[], %s::text[], %s::text[]) as d(morpheme_type, morpheme, meaning)
        where m.language = %s and m.morpheme_type = d.morpheme_type and m.morpheme = d.morpheme
          and m.morpheme_meaning is distinct from d.meaning
        returning m.id
        """,
        (
            [key[0] for key in keys],
            [key[1] for key in keys],
            [meanings[key] for key in keys],
            language,
        ),
    ).fetchall()
    return len(rows)


def upsert_audio(
    connection: psycopg.Connection[Any],
    *,
    result: AudioResult,
    accent: str,
) -> None:
    connection.execute(
        """
        insert into public.audio (owner_type, owner_id, accent, voice, model, path)
        values (%s, %s, %s, %s, %s, %s)
        on conflict (owner_type, owner_id, accent) do update set
          voice = excluded.voice,
          model = excluded.model,
          path = excluded.path
        """,
        (result.owner_type, result.owner_id, accent, result.voice, result.model, result.path),
    )
