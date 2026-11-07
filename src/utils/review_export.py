"""Export source rows plus generated metadata for human or model review."""

import csv
import json
from pathlib import Path

from core.models import ReviewMetadata, VocabularyItem

_CSV_COLUMNS = (
    "word",
    "word_class",
    "word_meaning",
    "example_sentence",
    "sentence_meaning",
    "level",
    "gender",
    "article",
    "plural",
    "generation_model",
    "morphemes_json",
    "review_status",
    "review_notes",
)


def export_review_files(
    *,
    items: list[VocabularyItem],
    metadata: dict[tuple[str, str], ReviewMetadata],
    output_dir: Path,
    source_name: str,
    file_stem: str | None = None,
) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    records = [_record(item, metadata.get((item.word, item.word_class))) for item in items]
    output_stem = file_stem or f"{source_name}_enriched"
    csv_path = output_dir / f"{output_stem}.csv"
    json_path = output_dir / f"{output_stem}.json"

    temporary_csv = csv_path.with_suffix(".csv.tmp")
    with temporary_csv.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=_CSV_COLUMNS)
        writer.writeheader()
        for record in records:
            csv_record = {key: value for key, value in record.items() if key != "morphemes"}
            writer.writerow(
                {
                    **csv_record,
                    "morphemes_json": json.dumps(
                        record["morphemes"], ensure_ascii=False, separators=(",", ":")
                    ),
                }
            )
    temporary_csv.replace(csv_path)

    temporary_json = json_path.with_suffix(".json.tmp")
    temporary_json.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_json.replace(json_path)
    return csv_path, json_path


def _record(item: VocabularyItem, generated: ReviewMetadata | None) -> dict[str, object]:
    return {
        "word": item.word,
        "word_class": item.word_class,
        "word_meaning": item.word_meaning,
        "example_sentence": item.example_sentence,
        "sentence_meaning": item.sentence_meaning,
        "level": item.level,
        "gender": generated.gender if generated else None,
        "article": generated.article if generated else None,
        "plural": generated.plural if generated else None,
        "generation_model": generated.generation_model if generated else None,
        "morphemes": [segment.model_dump() for segment in generated.segments] if generated else [],
        "review_status": "pending" if generated and generated.segments else "missing",
        "review_notes": "",
    }
