"""Put caption text into whole sentences with their times.

Captions come as cues: lines of an official track, or sentences of a transcript. Cues are joined
until one ends a sentence, within limits for text that has no punctuation.
"""

import re
import unicodedata
from collections.abc import Sequence
from typing import Any

from core.models import Record

# [Música], [Aplausos], and the >> captions put where the speaker changes.
_NOISE = re.compile(r"\[[^\]]*\]|>>")
_SPACES = re.compile(r"\s+")
# A sentence ends with . ? ! or …, maybe followed by a closing quote or bracket.
_SENTENCE_END = re.compile(r"[.?!…][\"'»”)\]]*$")
MAX_LINE_MS = 15_000
MAX_LINE_CHARS = 220
# A word before a pause ends this long after it starts, not when the next word starts.
MAX_WORD_MS = 1_500
_NOT_WORD = re.compile("[^\\w'\u2019-]+")


class Cue(Record):
    start_ms: int
    end_ms: int
    text: str


class CaptionLine(Record):
    """One sentence of the captions, numbered from 0."""

    position: int
    start_ms: int
    end_ms: int
    text: str


class TimedWord(Record):
    text: str
    start_ms: int
    end_ms: int


def clean(text: str) -> str:
    return _SPACES.sub(" ", _NOISE.sub(" ", text)).strip()


def spelling(text: str) -> str:
    """A word without case, punctuation or Unicode composition differences, for matching."""
    normalized = unicodedata.normalize("NFC", text).casefold()
    return _NOT_WORD.sub("", normalized)


def official_cues(data: dict[str, Any]) -> list[Cue]:
    """The cues of a json3 caption file."""
    cues = []
    for event in data.get("events", []):
        text = clean("".join(seg.get("utf8", "") for seg in event.get("segs") or []))
        if text:
            start = event["tStartMs"]
            cues.append(Cue(start_ms=start, end_ms=start + event.get("dDurationMs", 0), text=text))
    return cues


def timed_words(data: dict[str, Any]) -> list[TimedWord]:
    """The words of an automatic json3 track, each with the time YouTube heard it at."""
    heard: list[tuple[str, int]] = []
    for event in data.get("events", []):
        # Rolling automatic captions append a line break as its own event.
        if event.get("aAppend"):
            continue
        for seg in event.get("segs") or []:
            text = clean(seg.get("utf8", ""))
            if text:
                heard.append((text, event["tStartMs"] + seg.get("tOffsetMs", 0)))
    words = []
    for index, (text, start) in enumerate(heard):
        following = heard[index + 1][1] if index + 1 < len(heard) else start + MAX_WORD_MS
        end = min(max(following, start), start + MAX_WORD_MS)
        words.append(TimedWord(text=text, start_ms=start, end_ms=end))
    return words


def lines_from_cues(cues: Sequence[Cue]) -> list[CaptionLine]:
    lines: list[CaptionLine] = []
    pending: list[Cue] = []

    def close() -> None:
        if pending:
            lines.append(
                CaptionLine(
                    position=len(lines),
                    start_ms=pending[0].start_ms,
                    end_ms=pending[-1].end_ms,
                    text=" ".join(cue.text for cue in pending),
                )
            )
            pending.clear()

    for cue in cues:
        if pending and (
            cue.end_ms - pending[0].start_ms > MAX_LINE_MS
            or sum(len(item.text) + 1 for item in pending) + len(cue.text) > MAX_LINE_CHARS
        ):
            close()
        pending.append(cue)
        if _SENTENCE_END.search(cue.text):
            close()
    close()
    return lines
