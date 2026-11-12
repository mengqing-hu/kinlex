"""Translate caption sentences into the language the learner reads, in batches of neighbours.

Each batch also shows the sentences just before it, untranslated, so a reply can follow what was
said; sentences are numbered and every number must come back once.
"""

import json
import threading
from collections.abc import Callable, Sequence

from config import Config
from core.meaning_languages import language_name
from core.models import TranslatedTextReply
from core.pipeline import PipelineError, ValidationError, _generate_json, _run_many
from services.clients import LLMProvider
from utils.runtime import Cache, RunSummary, read_prompt
from video.captions import CaptionLine

PROMPT = "caption_translation_v1"
LINES_PER_CALL = 15
CONTEXT_LINES = 3
MAX_TRANSLATION_LENGTH = 600


def _validate(reply: TranslatedTextReply, batch: Sequence[CaptionLine]) -> None:
    answered = {item.id: item.text.strip() for item in reply.items}
    for line in batch:
        text = answered.get(line.position)
        if not text or len(text) > MAX_TRANSLATION_LENGTH or "\n" in text:
            raise ValidationError(f"bad translation for sentence {line.position}")


def _dump(lines: Sequence[CaptionLine]) -> str:
    return json.dumps(
        [{"id": line.position, "text": line.text} for line in lines], ensure_ascii=False, indent=1
    )


def translate_lines(
    lines: Sequence[CaptionLine],
    *,
    llm: LLMProvider,
    language: str,
    meaning_language: str,
    cache: Cache,
    config: Config,
    summary: RunSummary,
    on_progress: Callable[[float], None] | None = None,
) -> dict[int, str]:
    """Translations by sentence position. A failed batch fails the whole step; rerunning asks the
    model only for the batches that are not cached yet."""
    template = read_prompt(PROMPT)
    source = language_name(language)
    starts = range(0, len(lines), LINES_PER_CALL)
    finished = 0
    lock = threading.Lock()

    def translate(start: int) -> tuple[dict[int, str], bool]:
        batch = lines[start : start + LINES_PER_CALL]
        reply, cached = _generate_json(
            llm=llm,
            cache=cache,
            word=f"sentences {batch[0].position}-{batch[-1].position}",
            model=config.providers.llm.model,
            prompt=template.substitute(
                source_language=source,
                language=language_name(meaning_language),
                context=_dump(lines[max(0, start - CONTEXT_LINES) : start]),
                sentences=_dump(batch),
            ),
            schema=TranslatedTextReply,
            validate=lambda value: _validate(value, batch),
            config=config,
            summary=summary,
            system=f"You are a careful {source} subtitle translator. Reply with JSON only.",
        )
        wanted = {line.position for line in batch}
        if on_progress:
            nonlocal finished
            with lock:
                finished += 1
                on_progress(finished / len(starts))
        return {item.id: item.text.strip() for item in reply.items if item.id in wanted}, cached

    results, failed = _run_many(
        list(starts),
        translate,
        lambda start: f"sentences from {start}",
        summary,
        config.llm_concurrency,
    )
    if failed:
        raise PipelineError(f"{failed} translation batches failed; run again to retry them")
    return {position: text for result in results for position, text in result.items()}
