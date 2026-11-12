"""Transcribe a video's speech with Whisper on ScaDS.AI, for videos without official captions.

The service answers in segments of a few seconds, punctuated but without word times, so each
sentence in a segment gets a share of the segment's time in proportion to its length. The sound is
sent as mono MP3 in ten-minute pieces, and the transcript is cached by the video file's hash.
"""

import hashlib
import re
import subprocess
import tempfile
from collections.abc import Callable
from pathlib import Path

from core.models import Record
from services.clients import STTProvider
from utils.runtime import Cache, cache_key, get_logger
from video.captions import Cue, clean

CHUNK_SECONDS = 600
# A sentence ends at . ? ! or … before the next word.
_SENTENCE_BREAK = re.compile(r"(?<=[.?!…])\s+")


class TranscriptSegment(Record):
    start: float
    end: float
    text: str


class Transcript(Record):
    segments: list[TranscriptSegment]


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _sound_pieces(video: Path, directory: Path) -> list[Path]:
    subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-i",
            str(video),
            "-vn",
            "-ac",
            "1",
            "-b:a",
            "48k",
            "-f",
            "segment",
            "-segment_time",
            str(CHUNK_SECONDS),
            "-reset_timestamps",
            "1",
            str(directory / "piece_%03d.mp3"),
        ],
        check=True,
    )
    return sorted(directory.glob("piece_*.mp3"))


def _transcribe(
    video: Path, stt: STTProvider, language: str, on_progress: Callable[[float], None] | None
) -> Transcript:
    segments: list[TranscriptSegment] = []
    with tempfile.TemporaryDirectory() as directory:
        pieces = _sound_pieces(video, Path(directory))
        for index, piece in enumerate(pieces):
            get_logger().info("transcribing part %d of %d", index + 1, len(pieces))
            offset = index * CHUNK_SECONDS
            reply = stt.transcribe(piece.read_bytes(), piece.name, language)
            segments.extend(
                TranscriptSegment(
                    start=offset + float(segment["start"]),
                    end=offset + float(segment["end"]),
                    text=segment.get("text", ""),
                )
                for segment in reply.get("segments") or []
            )
            if on_progress:
                on_progress((index + 1) / len(pieces))
    return Transcript(segments=segments)


def transcript(
    video: Path,
    *,
    stt: STTProvider,
    language: str,
    cache: Cache,
    on_progress: Callable[[float], None] | None = None,
) -> Transcript:
    key = cache_key("transcription", stt.model, language, _file_hash(video))
    cached = cache.get(key, Transcript)
    if cached is not None:
        return cached
    result = _transcribe(video, stt, language, on_progress)
    cache.set(key, result)
    return result


def cues_from_transcript(result: Transcript) -> list[Cue]:
    """One cue per sentence, timed within its segment by its share of the segment's text."""
    cues = []
    for segment in result.segments:
        sentences = [clean(part) for part in _SENTENCE_BREAK.split(segment.text)]
        sentences = [sentence for sentence in sentences if sentence]
        total = sum(len(sentence) for sentence in sentences)
        start_ms = round(segment.start * 1000)
        span_ms = max(0, round(segment.end * 1000) - start_ms)
        done = 0
        for sentence in sentences:
            cue_start = start_ms + span_ms * done // total
            done += len(sentence)
            cues.append(
                Cue(start_ms=cue_start, end_ms=start_ms + span_ms * done // total, text=sentence)
            )
    return cues
