"""Stores a processed video's captions in the video tables.

A video belongs to the learner who added it. Its lines and their words are stored once; each
meaning language adds its own translations and word meanings, so explaining the video in another
language keeps the lines and words that are there.
"""

from collections.abc import Sequence
from typing import Any, Protocol

import psycopg


class _Study(Protocol):
    """A processed video: the pipeline's StudyVideo, or the same fields read from a study file."""

    @property
    def video_id(self) -> str: ...
    @property
    def title(self) -> str: ...
    @property
    def duration_ms(self) -> int | None: ...
    @property
    def language(self) -> str: ...
    @property
    def meaning_language(self) -> str: ...
    @property
    def lines(self) -> Sequence[Any]: ...


def _same_lines(connection: psycopg.Connection[Any], study: _Study) -> bool:
    stored = connection.execute(
        "select position, text from public.video_lines where video_id = %s order by position",
        (study.video_id,),
    ).fetchall()
    return [(row[0], row[1]) for row in stored] == [
        (line.position, line.text) for line in study.lines
    ]


def _insert_lines(connection: psycopg.Connection[Any], study: _Study) -> None:
    for line in study.lines:
        connection.execute(
            """
            insert into public.video_lines (video_id, position, start_ms, end_ms, text)
            values (%s, %s, %s, %s, %s)
            """,
            (study.video_id, line.position, line.start_ms, line.end_ms, line.text),
        )
        for position, token in enumerate(line.tokens):
            connection.execute(
                """
                insert into public.video_tokens
                  (video_id, line, position, start, "end", surface, lemma, word_id,
                   start_ms, end_ms, match_source, filter_reason)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    study.video_id,
                    line.position,
                    position,
                    token.start,
                    token.end,
                    token.surface,
                    token.lemma,
                    token.word_id,
                    token.start_ms,
                    token.end_ms,
                    # Study files written before these were recorded have neither.
                    getattr(token, "match_source", None),
                    getattr(token, "filter_reason", None),
                ),
            )


def _upsert_meanings(connection: psycopg.Connection[Any], study: _Study) -> None:
    for line in study.lines:
        if line.translation is not None:
            connection.execute(
                """
                insert into public.video_line_translations
                  (video_id, position, meaning_language, translation)
                values (%s, %s, %s, %s)
                on conflict (video_id, position, meaning_language)
                do update set translation = excluded.translation
                """,
                (study.video_id, line.position, study.meaning_language, line.translation),
            )
        for position, token in enumerate(line.tokens):
            if token.gloss:
                connection.execute(
                    """
                    insert into public.video_token_glosses
                      (video_id, line, position, meaning_language, gloss)
                    values (%s, %s, %s, %s, %s)
                    on conflict (video_id, line, position, meaning_language)
                    do update set gloss = excluded.gloss
                    """,
                    (
                        study.video_id,
                        line.position,
                        position,
                        study.meaning_language,
                        token.gloss,
                    ),
                )


def persist_study_video(
    connection: psycopg.Connection[Any],
    study: _Study,
    *,
    owner_id: str,
    source_url: str,
    media_path: str | None,
    provider: str = "youtube",
) -> None:
    """Store a processed video for owner_id in one transaction.

    A title the learner gave the video on the website outlives processing it again.

    The lines and words are replaced only when the captions changed; otherwise only this meaning
    language's translations and word meanings are written, beside the other languages'.
    """
    with connection.transaction():
        owner = connection.execute(
            "select owner_id from public.videos where id = %s", (study.video_id,)
        ).fetchone()
        if owner is not None and str(owner[0]) != owner_id:
            raise ValueError(f"video {study.video_id} belongs to another learner")
        connection.execute(
            """
            insert into public.videos
              (id, owner_id, language, title, duration_ms, provider, provider_video_id,
               source_url, media_path, channel_id, channel_name, status)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'done')
            on conflict (id) do update set
              duration_ms = excluded.duration_ms,
              channel_id = coalesce(excluded.channel_id, videos.channel_id),
              channel_name = coalesce(excluded.channel_name, videos.channel_name),
              source_url = excluded.source_url,
              media_path = excluded.media_path,
              status = 'done',
              failed_stage = null
            """,
            (
                study.video_id,
                owner_id,
                study.language,
                study.title,
                study.duration_ms,
                provider,
                study.video_id,
                source_url,
                media_path,
                # Study files written before the channel was kept have neither.
                getattr(study, "channel_id", None),
                getattr(study, "channel_name", None),
            ),
        )
        if not _same_lines(connection, study):
            connection.execute(
                "delete from public.video_lines where video_id = %s", (study.video_id,)
            )
            _insert_lines(connection, study)
        _upsert_meanings(connection, study)
