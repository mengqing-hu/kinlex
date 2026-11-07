"""Database reads and idempotent writes for meanings translated from English."""

from collections.abc import Sequence
from typing import Any

import psycopg

from core.models import (
    MeaningTranslation,
    MorphemeToTranslate,
    SentenceToTranslate,
    WordToTranslate,
)


def words_to_translate(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    meaning_language: str,
    force: bool,
    limit: int | None,
) -> list[WordToTranslate]:
    """Words with English meanings but none in the target language, most common words first."""
    rows = connection.execute(
        """
        select w.id, w.word, w.word_class,
               array_agg(s.word_meaning order by s.sort_order),
               (
                 select e.example_sentence
                 from public.example_links l
                 join public.examples e on e.id = l.example_id
                 where l.target_type = 'word' and l.target_id = w.id
                 order by l.sort_order, e.id
                 limit 1
               )
        from public.words w
        join public.senses s on s.word_id = w.id and s.meaning_language = 'en'
        where w.language = %(language)s
          and (%(force)s or not exists (
            select 1 from public.senses t
            where t.word_id = w.id and t.meaning_language = %(meaning)s
          ))
        group by w.id
        order by array_position(array['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], w.level),
                 w.freq_rank nulls last,
                 w.id
        limit %(limit)s
        """,
        {"language": language, "meaning": meaning_language, "force": force, "limit": limit},
    ).fetchall()
    return [
        WordToTranslate(
            id=row[0], word=row[1], word_class=row[2], meanings=row[3], example_sentence=row[4]
        )
        for row in rows
    ]


def replace_word_meanings(
    connection: psycopg.Connection[Any],
    *,
    meaning_language: str,
    translations: Sequence[MeaningTranslation],
) -> None:
    """Store each word's translated meanings in the order of its English ones."""
    for item in translations:
        connection.execute(
            "delete from public.senses where word_id = %s and meaning_language = %s",
            (item.id, meaning_language),
        )
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                insert into public.senses (word_id, meaning_language, word_meaning, sort_order)
                values (%s, %s, %s, %s)
                """,
                [
                    (item.id, meaning_language, meaning, order)
                    for order, meaning in enumerate(item.meanings)
                ],
            )


def sentences_to_translate(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    meaning_language: str,
    force: bool,
    limit: int | None,
) -> list[SentenceToTranslate]:
    """Examples with an English translation but none in the target language, in id order."""
    rows = connection.execute(
        """
        select e.id, e.example_sentence, en.sentence_meaning
        from public.examples e
        join public.example_translations en
          on en.example_id = e.id and en.meaning_language = 'en'
        where e.language = %(language)s
          and (%(force)s or not exists (
            select 1 from public.example_translations t
            where t.example_id = e.id and t.meaning_language = %(meaning)s
          ))
        order by e.id
        limit %(limit)s
        """,
        {"language": language, "meaning": meaning_language, "force": force, "limit": limit},
    ).fetchall()
    return [SentenceToTranslate(id=row[0], sentence=row[1], translation=row[2]) for row in rows]


def upsert_sentence_translations(
    connection: psycopg.Connection[Any],
    *,
    meaning_language: str,
    translations: dict[int, str],
) -> None:
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            insert into public.example_translations
              (example_id, meaning_language, sentence_meaning)
            values (%s, %s, %s)
            on conflict (example_id, meaning_language)
            do update set sentence_meaning = excluded.sentence_meaning
            """,
            [(example_id, meaning_language, text) for example_id, text in translations.items()],
        )


def morphemes_to_translate(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    meaning_language: str,
    force: bool,
    limit: int | None,
) -> list[MorphemeToTranslate]:
    """Word parts whose English meaning is new or changed since it was last translated, each
    with a few words that use it."""
    rows = connection.execute(
        """
        select m.id, m.morpheme, m.morpheme_type, m.morpheme_meaning,
               array(
                 select w.word
                 from public.word_morphemes wm
                 join public.words w on w.id = wm.word_id
                 where wm.morpheme_id = m.id
                 order by w.freq_rank nulls last, w.id
                 limit 3
               )
        from public.morphemes m
        left join public.morpheme_meanings t
          on t.morpheme_id = m.id and t.meaning_language = %(meaning)s
        where m.language = %(language)s
          and (%(force)s or t.source_meaning is distinct from m.morpheme_meaning)
        order by m.id
        limit %(limit)s
        """,
        {"language": language, "meaning": meaning_language, "force": force, "limit": limit},
    ).fetchall()
    return [
        MorphemeToTranslate(
            id=row[0], morpheme=row[1], morpheme_type=row[2], meaning=row[3], words=row[4]
        )
        for row in rows
    ]


def upsert_morpheme_meanings(
    connection: psycopg.Connection[Any],
    *,
    meaning_language: str,
    morphemes: Sequence[MorphemeToTranslate],
    translations: dict[int, str],
) -> None:
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            insert into public.morpheme_meanings
              (morpheme_id, meaning_language, meaning, source_meaning)
            values (%s, %s, %s, %s)
            on conflict (morpheme_id, meaning_language)
            do update set meaning = excluded.meaning, source_meaning = excluded.source_meaning
            """,
            [
                (morpheme.id, meaning_language, translations[morpheme.id], morpheme.meaning)
                for morpheme in morphemes
            ],
        )
