"""Download a YouTube video and process it into a study file: sentences, translations, and word
meanings."""

import argparse
import json
import os
import threading
import time
from pathlib import Path
from typing import get_args

from config import get_config
from core.languages import LANGUAGES
from utils.runtime import DATA_ROOT, setup_logging
from video.pipeline import CaptionSource, Stage, process_video, video_path
from video.youtube import pick_speech_track, pick_track, read_video, video_id


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="kinlex-video",
        description="Download a YouTube video and prepare its captions for studying.",
    )
    parser.add_argument("url", help="a YouTube link or video id")
    parser.add_argument(
        "--language", required=True, choices=sorted(LANGUAGES), help="the language spoken"
    )
    parser.add_argument(
        "--meaning-language",
        default="en",
        help="the language sentences and words are explained in, e.g. zh; defaults to en",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="defaults to data/pipeline/<language>/videos/<id>.<meaning language>.json; the video "
        "is saved beside it as <id>.mp4",
    )
    parser.add_argument(
        "--captions",
        choices=get_args(CaptionSource),
        help="where the captions come from: the video's official track, YouTube's automatic "
        "recognition of the speech, or a Whisper transcription; defaults to official when the "
        "video has it, else whisper",
    )
    parser.add_argument(
        "--list-captions",
        action="store_true",
        help="only print, as JSON, which captions the video has in the language, then stop",
    )
    parser.add_argument(
        "--status-file",
        type=Path,
        help="keep a JSON file up to date with the stage and progress, for the website to show",
    )
    return parser


# Progress within a stage is written at most this often; a new stage is written at once.
STATUS_INTERVAL_SECONDS = 0.5


# Each finished processing adds how long its stages took, so the website can estimate how long
# the next one will take.
TIMINGS_FILE = DATA_ROOT / "video_timings.jsonl"


class StatusFile:
    """{"status": "running" | "done" | "failed", "stage", "progress", "error", "pid", "captions",
    "title", "duration_ms", "started_at", "stage_started_at", "stage_seconds"}

    The captions asked for and the video's title and length, once read, are in every write: the
    website lists unfinished processing from these files, retries it with the same captions, and
    estimates when it will finish from the times (Unix seconds) and how long each finished stage
    took.
    """

    def __init__(self, path: Path | None, captions: CaptionSource | None) -> None:
        self.path = path
        self.captions = captions
        self.title: str | None = None
        self.duration_ms: int | None = None
        self.stage: Stage | None = None
        self.progress: float | None = None
        self.started_at = time.time()
        self.stage_started_at = self.started_at
        self.stage_seconds: dict[str, float] = {}
        self.written = 0.0
        self.lock = threading.Lock()

    def write(self, **fields: object) -> None:
        if self.path is None:
            return
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(
                {
                    "pid": os.getpid(),
                    "captions": self.captions,
                    "title": self.title,
                    "duration_ms": self.duration_ms,
                    "started_at": self.started_at,
                    "stage_started_at": self.stage_started_at,
                    "stage_seconds": self.stage_seconds,
                    **fields,
                }
            ),
            encoding="utf-8",
        )
        temporary.replace(self.path)

    def _finish_stage(self, now: float) -> None:
        if self.stage is not None:
            self.stage_seconds[self.stage] = round(now - self.stage_started_at, 1)

    def report(self, stage: Stage, done: float | None) -> None:
        with self.lock:
            now = time.monotonic()
            if stage == self.stage and now - self.written < STATUS_INTERVAL_SECONDS:
                return
            if stage != self.stage:
                wall = time.time()
                self._finish_stage(wall)
                self.stage_started_at = wall
            self.stage, self.progress, self.written = stage, done, now
            self.write(status="running", stage=stage, progress=done)

    def describe(self, title: str, duration_ms: int | None) -> None:
        with self.lock:
            self.title, self.duration_ms = title, duration_ms
            self.write(status="running", stage=self.stage, progress=self.progress)

    def done(self, caption_source: str) -> None:
        with self.lock:
            self._finish_stage(time.time())
            self.write(status="done", stage=None)
            record = {
                "captions": caption_source,
                "duration_ms": self.duration_ms,
                "stage_seconds": self.stage_seconds,
            }
        try:
            with TIMINGS_FILE.open("a", encoding="utf-8") as file:
                file.write(json.dumps(record) + "\n")
        except OSError:
            # Only the estimates for later videos suffer.
            pass


def _list_captions(url: str, language: str) -> None:
    """{"official": track code or null, "automatic": track code or null}, for the website to
    offer only the sources the video has. Whisper needs nothing from YouTube, so it is always
    available."""
    info = read_video(video_id(url))
    official, automatic = pick_track(info, language), pick_speech_track(info, language)
    print(
        json.dumps(
            {
                "official": official.code if official else None,
                "automatic": automatic.code if automatic else None,
            }
        )
    )


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.list_captions:
        _list_captions(args.url, args.language)
        return 0
    setup_logging("video", args.language)
    output: Path = args.output or (
        DATA_ROOT / args.language / "videos" / f"{video_id(args.url)}.{args.meaning_language}.json"
    )
    status = StatusFile(args.status_file, args.captions)
    try:
        video = process_video(
            get_config(),
            args.url,
            language=args.language,
            meaning_language=args.meaning_language,
            directory=output.parent,
            captions=args.captions,
            report=status.report,
            on_video=status.describe,
        )
    except Exception as error:
        status.write(status="failed", stage=status.stage, error=str(error))
        raise
    # A title the learner gave the video on the website outlives processing it again.
    if output.is_file():
        video = video.model_copy(update={"title": json.loads(output.read_text("utf-8"))["title"]})
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(video.model_dump_json(indent=1), encoding="utf-8")
    temporary.replace(output)
    status.done(video.caption_source)
    print(f"{len(video.lines)} sentences ({video.caption_source} captions): {output}")
    print(f"video: {video_path(output.parent, video.video_id)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
