"""Back up and restore the video tables of the local database.

The video data lives only in the local database, which `supabase db reset` empties, so back it up
before resetting. Restoring writes the rows back into the tables the migrations created and never
drops anything.
"""

import argparse
import os
import subprocess
import tarfile
from datetime import UTC, datetime
from pathlib import Path

from services.storage import LOCAL_AUDIO_ROOT

TABLES = (
    "videos",
    "video_lines",
    "video_line_translations",
    "video_tokens",
    "video_token_glosses",
    "video_examples",
    "video_progress",
)


# The tools run inside the local Supabase database container, whose pg_dump matches the server's
# Postgres 17; a pg_dump installed on the computer is often older and refuses to run.
CONTAINER = os.environ.get("SUPABASE_DB_CONTAINER", "supabase_db_kinlex")


def backup(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    dump = directory / f"video-{timestamp}.dump"
    tables = [option for table in TABLES for option in ("--table", f"public.{table}")]
    command = ["docker", "exec", CONTAINER, "pg_dump", "-U", "postgres", "--data-only", "-Fc"]
    with dump.open("wb") as output:
        subprocess.run([*command, *tables], check=True, stdout=output)
    with tarfile.open(dump.with_suffix(".audio.tar.gz"), "w:gz") as archive:
        if LOCAL_AUDIO_ROOT.is_dir():
            archive.add(LOCAL_AUDIO_ROOT, arcname=LOCAL_AUDIO_ROOT.name)
    print(dump)


def restore(dump: Path) -> None:
    command = ["docker", "exec", "-i", CONTAINER, "pg_restore", "-U", "postgres", "-d", "postgres"]
    with dump.open("rb") as source:
        subprocess.run([*command, "--data-only"], check=True, stdin=source)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("backup", "restore"))
    parser.add_argument("path", type=Path, help="the backup directory, or the .dump to restore")
    args = parser.parse_args()
    if args.action == "backup":
        backup(args.path)
    else:
        restore(args.path)


if __name__ == "__main__":
    main()
