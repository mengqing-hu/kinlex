"""Import legacy kinlex-video JSON study files into the database."""

import argparse
import json
from pathlib import Path
from types import SimpleNamespace

from services import db, video_words


def import_file(path: Path, owner_id: str) -> None:
    raw = json.loads(path.read_text(encoding="utf-8"))
    lines = []
    for line in raw["lines"]:
        tokens = [SimpleNamespace(**token) for token in line.get("tokens", [])]
        lines.append(SimpleNamespace(**{**line, "tokens": tokens}))
    study = SimpleNamespace(**{**raw, "lines": lines})
    media = path.with_name(f"{raw['video_id']}.mp4")
    with db.connect() as connection:
        video_words.persist_study_video(
            connection,
            study,
            owner_id=owner_id,
            source_url=f"https://www.youtube.com/watch?v={raw['video_id']}",
            media_path=str(media) if media.is_file() else None,
        )
    print(f"imported {path.name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--owner-id", required=True)
    args = parser.parse_args()
    # Study files are <id>.<meaning language>.json; the .job.json beside them are processing state.
    for path in sorted(args.directory.glob("*.json")):
        if path.name.endswith(".job.json"):
            continue
        import_file(path, args.owner_id)


if __name__ == "__main__":
    main()
