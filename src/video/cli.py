"""Download a YouTube video and process it into a study file: sentences, translations, and word
meanings."""

import argparse
import json
import os
import threading
import time
from pathlib import Path

from config import get_config
from core.languages import LANGUAGES
from utils.runtime import DATA_ROOT, setup_logging
from video.pipeline import Stage, process_video, video_path
from video.youtube import video_id


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
        "--status-file",
        type=Path,
        help="keep a JSON file up to date with the stage and progress, for the website to show",
    )
    return parser


# Progress within a stage is written at most this often; a new stage is written at once.
STATUS_INTERVAL_SECONDS = 0.5


class StatusFile:
    """{"status": "running" | "done" | "failed", "stage", "progress", "error", "pid"}"""

    def __init__(self, path: Path | None) -> None:
        self.path = path
        self.stage: Stage | None = None
        self.written = 0.0
        self.lock = threading.Lock()

    def write(self, **fields: object) -> None:
        if self.path is None:
            return
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"pid": os.getpid(), **fields}), encoding="utf-8")
        temporary.replace(self.path)

    def report(self, stage: Stage, done: float | None) -> None:
        with self.lock:
            now = time.monotonic()
            if stage == self.stage and now - self.written < STATUS_INTERVAL_SECONDS:
                return
            self.stage, self.written = stage, now
            self.write(status="running", stage=stage, progress=done)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    setup_logging("video", args.language)
    output: Path = args.output or (
        DATA_ROOT / args.language / "videos" / f"{video_id(args.url)}.{args.meaning_language}.json"
    )
    status = StatusFile(args.status_file)
    try:
        video = process_video(
            get_config(),
            args.url,
            language=args.language,
            meaning_language=args.meaning_language,
            directory=output.parent,
            report=status.report,
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
    status.write(status="done", stage=None)
    print(f"{len(video.lines)} sentences ({video.caption_source} captions): {output}")
    print(f"video: {video_path(output.parent, video.video_id)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
