"""Fill in the YouTube channel of stored videos processed before the channel was kept.

Only videos done processing are read; one still being processed gets its channel from it. Each
video is read from YouTube again, one at a time in the same turn as processing videos, with a
pause between them so YouTube does not ask to sign in. A video that cannot be read is left as it
is and reported; running again retries it.

    python -m scripts.backfill_video_channels --dry-run --limit 3
    python -m scripts.backfill_video_channels --language de
"""

import argparse
import json
import time

from services import db
from utils.runtime import DATA_ROOT, get_logger, setup_logging
from video import youtube

# Between two videos, on top of yt-dlp's own pacing within one.
SECONDS_BETWEEN_VIDEOS = 5


def _update_study_files(language: str, video_id: str, channel_id: str, name: str) -> None:
    """Write the channel into the study files too, which a site without the tables reads."""
    for path in sorted((DATA_ROOT / language / "videos").glob(f"{video_id}.??.json")):
        data = json.loads(path.read_text("utf-8"))
        data.update(channel_id=channel_id, channel_name=name)
        # Its own name, so it never meets the temporary file kinlex-video writes.
        temporary = path.with_suffix(".backfill.tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        temporary.replace(path)


def backfill(language: str | None, *, dry_run: bool, limit: int | None = None) -> tuple[int, int]:
    """The number of videos filled in and of those that could not be read."""
    log = get_logger()
    with db.connect() as connection:
        videos = connection.execute(
            """
            select id, language, title from public.videos
            where channel_id is null and status = 'done'
              and (%s::text is null or language = %s)
            order by created_at
            limit %s
            """,
            (language, language, limit),
        ).fetchall()
    log.info("%d videos have no channel", len(videos))
    filled = failed = 0
    for index, (video_id, video_language, title) in enumerate(videos):
        if index:
            time.sleep(SECONDS_BETWEEN_VIDEOS)
        try:
            with youtube.youtube_turn(lambda: log.info("waiting for another video's turn")):
                info = youtube.read_video(video_id)
        except Exception as error:
            log.warning("%s (%s): could not read it: %s", video_id, title, error)
            failed += 1
            continue
        if not info.channel_id or not info.channel_name:
            log.warning("%s (%s): YouTube names no channel", video_id, title)
            failed += 1
            continue
        print(f"{video_id}  {info.channel_name}  ({title})")
        if dry_run:
            filled += 1
            continue
        # The files first: the row is what marks the video done, so a failure here is retried.
        try:
            _update_study_files(video_language, video_id, info.channel_id, info.channel_name)
            with db.connect() as connection:
                connection.execute(
                    "update public.videos set channel_id = %s, channel_name = %s where id = %s",
                    (info.channel_id, info.channel_name, video_id),
                )
                connection.commit()
        except Exception as error:
            log.warning("%s (%s): could not save the channel: %s", video_id, title, error)
            failed += 1
            continue
        filled += 1
    return filled, failed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--language", help="only the videos in this language")
    parser.add_argument("--dry-run", action="store_true", help="list the channels without saving")
    parser.add_argument("--limit", type=int, help="only the first this many videos")
    args = parser.parse_args()
    setup_logging("video", args.language or "all")
    filled, failed = backfill(args.language, dry_run=args.dry_run, limit=args.limit)
    verb = "found" if args.dry_run else "filled in"
    print(f"{verb} {filled}, failed {failed}")


if __name__ == "__main__":
    main()
