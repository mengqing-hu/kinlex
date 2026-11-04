"""Database reads and idempotent writes for the word-by-word example annotations."""

from collections.abc import Sequence
from typing import Any

import psycopg

from core.models import ExampleToken, LexiconEntry, TokenGloss, TokenToGloss


def lexicon_entries(
    connection: psycopg.Connection[Any], *, language: str, meaning_language: str
) -> list[LexiconEntry]:
    """Every vocabulary entry with its first meaning, most common entries first."""
    rows = connection.execute(
        """
        select w.id, w.word, w.word_class,
               (
                 select s.word_meaning
                 from public.senses s
                 where s.word_id = w.id and s.meaning_language = %s
                 order by s.sort_order
                 limit 1
               )
        from public.words w
        where w.language = %s
        order by array_position(array['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], w.level),
                 w.freq_rank nulls last,
                 w.id
        """,
        (meaning_language, language),
    ).fetchall()
    return [LexiconEntry(id=row[0], word=row[1], word_class=row[2], gloss=row[3]) for row in rows]


def examples_to_tokenize(
    connection: psycopg.Connection[Any], *, language: str, limit: int | None, force: bool
) -> list[tuple[int, str]]:
    """Examples without tokens yet, or every example with --force, in id order."""
    rows = connection.execute(
        """
        select e.id, e.example_sentence
        from public.examples e
        where e.language = %s
          and (%s or not exists (
            select 1 from public.example_tokens t where t.example_id = e.id
          ))
        order by e.id
        limit %s
        """,
        (language, force, limit),
    ).fetchall()
    return [(row[0], row[1]) for row in rows]


def replace_tokens(
    connection: psycopg.Connection[Any], example_id: int, tokens: Sequence[ExampleToken]
) -> None:
    """Store an example's tokens; replacing them also drops their glosses."""
    connection.execute("delete from public.example_tokens where example_id = %s", (example_id,))
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            insert into public.example_tokens
              (example_id, position, start_offset, end_offset, surface, lemma, word_id)
            values (%s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    example_id,
                    token.position,
                    token.start,
                    token.end,
                    token.surface,
                    token.lemma,
                    token.word_id,
                )
                for token in tokens
            ],
        )


def upsert_glosses(connection: psycopg.Connection[Any], glosses: Sequence[TokenGloss]) -> None:
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            insert into public.example_token_glosses
              (example_id, position, meaning_language, gloss, source)
            values (%s, %s, %s, %s, %s)
            on conflict (example_id, position, meaning_language)
            do update set gloss = excluded.gloss, source = excluded.source
            """,
            [
                (
                    gloss.example_id,
                    gloss.position,
                    gloss.meaning_language,
                    gloss.gloss,
                    gloss.source,
                )
                for gloss in glosses
            ],
        )


def tokens_without_glosses(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    meaning_language: str,
    limit: int | None,
) -> list[TokenToGloss]:
    """Tokens still missing a meaning, grouped by example; `limit` counts examples."""
    rows = connection.execute(
        """
        with pending as (
          select distinct t.example_id
          from public.example_tokens t
          join public.examples e on e.id = t.example_id
          where e.language = %(language)s
            and not exists (
              select 1 from public.example_token_glosses g
              where g.example_id = t.example_id and g.position = t.position
                and g.meaning_language = %(meaning)s
            )
          order by t.example_id
          limit %(limit)s
        )
        select t.example_id, e.example_sentence, tr.sentence_meaning,
               t.position, t.surface, t.lemma, t.word_id
        from public.example_tokens t
        join pending p on p.example_id = t.example_id
        join public.examples e on e.id = t.example_id
        left join public.example_translations tr
          on tr.example_id = t.example_id and tr.meaning_language = %(meaning)s
        where not exists (
          select 1 from public.example_token_glosses g
          where g.example_id = t.example_id and g.position = t.position
            and g.meaning_language = %(meaning)s
        )
        order by t.example_id, t.position
        """,
        {"language": language, "meaning": meaning_language, "limit": limit},
    ).fetchall()
    return [
        TokenToGloss(
            example_id=row[0],
            sentence=row[1],
            translation=row[2],
            position=row[3],
            surface=row[4],
            lemma=row[5],
            word_id=row[6],
        )
        for row in rows
    ]
