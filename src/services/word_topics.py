"""Database reads and idempotent writes for the topics each word belongs to."""

from collections.abc import Mapping, Sequence
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from core.models import WordForTopics

TOPIC_TAG_TYPE = "topic"


def words_to_classify(
    connection: psycopg.Connection[Any],
    *,
    language: str,
    meaning_language: str,
    prompt: str,
    force: bool,
    limit: int | None,
) -> list[WordForTopics]:
    """Words not yet sorted with this prompt, or every word with --force.

    The order is a fixed shuffle, so a small --limit samples every level and word class, and a
    later full run asks the same first batches again (and finds them in the cache).
    """
    rows = connection.execute(
        """
        select w.id, w.word, w.word_class, w.level,
               (
                 select string_agg(s.word_meaning, '; ' order by s.sort_order)
                 from public.senses s
                 where s.word_id = w.id and s.meaning_language = %s
               ),
               (
                 select e.example_sentence
                 from public.example_links l
                 join public.examples e on e.id = l.example_id
                 where l.target_type = 'word' and l.target_id = w.id
                 order by l.sort_order, l.example_id
                 limit 1
               )
        from public.words w
        where w.language = %s
          and w.status not in ('rejected', 'retired')
          and (%s or (w.model_info #>> '{word_topics,prompt}') is distinct from %s)
        order by md5(w.id::text)
        limit %s
        """,
        (meaning_language, language, force, prompt, limit),
    ).fetchall()
    return [
        WordForTopics(
            id=row[0],
            word=row[1],
            word_class=row[2],
            level=row[3],
            meaning=row[4],
            example_sentence=row[5],
        )
        for row in rows
    ]


def sync_topic_tags(connection: psycopg.Connection[Any], topics: Mapping[str, str]) -> None:
    """Make sure every topic exists as a tag, with its current name."""
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            insert into public.tags (type, slug, name)
            values (%s, %s, %s)
            on conflict (type, slug) do update set name = excluded.name
            """,
            [(TOPIC_TAG_TYPE, slug, name) for slug, name in topics.items()],
        )


def replace_word_topics(
    connection: psycopg.Connection[Any],
    *,
    word_id: int,
    topics: Sequence[str],
    model: str,
    prompt: str,
) -> None:
    """Store a word's topics, and that it was sorted, even when it has none."""
    connection.execute(
        """
        delete from public.word_tags wt
        using public.tags t
        where wt.tag_id = t.id and t.type = %s and wt.word_id = %s
        """,
        (TOPIC_TAG_TYPE, word_id),
    )
    if topics:
        connection.execute(
            """
            insert into public.word_tags (word_id, tag_id)
            select %s, t.id
            from public.tags t
            where t.type = %s and t.slug = any(%s)
            """,
            (word_id, TOPIC_TAG_TYPE, list(topics)),
        )
    connection.execute(
        """
        update public.words
        set model_info = coalesce(model_info, '{}'::jsonb) || %s
        where id = %s
        """,
        (Jsonb({"word_topics": {"model": model, "prompt": prompt}}), word_id),
    )
