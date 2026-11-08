"""Build the Spanish affix and etymological root dictionaries from the curated CSV.

Run from src/ whenever data/vocabulary/spanish/spanish_roots_affixes.csv changes:

    python -m scripts.build_es_lexicon

Every spelling in a row's `entry` and `variants` becomes its own dictionary entry with the row's
meaning, so a word's part is always written as it appears in the word: imposible is im- + posible,
not a hidden in-. A spelling listed by several rows is a homograph and gets a number in row order,
kept inside the hyphen so prefixes still end with "-": a1- (to, toward), a2- (not). Spanish
morphemes never contain digits, so the number cannot be mistaken for a letter; the website shows
it as a superscript. The report lists every homograph and every malformed spelling for review.

Only the generated keys are rewritten: `prefix` and `suffix` in lexicon/es_affixes.json and
`etymological_roots` in lexicon/es_roots.json. Hand-edited keys such as `overrides` are kept.
"""

import argparse
import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from config import REPO_ROOT
from utils.affixes import LEXICON_ROOT

DEFAULT_INPUT = REPO_ROOT / "data" / "vocabulary" / "spanish" / "spanish_roots_affixes.csv"
DEFAULT_REPORT = REPO_ROOT / "data" / "output" / "es" / "lexicon_report.md"
AFFIXES_PATH = LEXICON_ROOT / "es_affixes.json"
ROOTS_PATH = LEXICON_ROOT / "es_roots.json"

_CATEGORIES = ("prefix", "suffix", "root")
_NO_VARIANTS = {"", "—", "-"}


@dataclass(frozen=True)
class Spelling:
    row: str
    category: str
    form: str
    meaning: str
    example: str


def _is_well_formed(category: str, form: str) -> bool:
    letters = form.strip("-")
    if not letters or " " in letters or "-" in letters:
        return False
    if category == "suffix":
        return form.startswith("-") and not form.endswith("-")
    return form.endswith("-") and not form.startswith("-")


def number_homograph(category: str, form: str, number: int) -> str:
    """Put the number next to the letters: a1-, -al1, cap1-."""
    mark = str(number)
    return f"{form}{mark}" if category == "suffix" else f"{form[:-1]}{mark}-"


def read_spellings(path: Path) -> tuple[list[Spelling], list[str]]:
    spellings: list[Spelling] = []
    malformed: list[str] = []
    with path.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            category = row["category"].strip()
            if category not in _CATEGORIES:
                malformed.append(f"row {row['no']}: unknown category {category!r}")
                continue
            forms = [form.strip() for form in row["entry"].split(",")]
            forms += [
                form.strip()
                for form in row["variants"].split(",")
                if form.strip() not in _NO_VARIANTS
            ]
            for form in dict.fromkeys(forms):
                if not _is_well_formed(category, form):
                    malformed.append(f"row {row['no']}: {category} {form!r}")
                    continue
                spellings.append(
                    Spelling(
                        row=row["no"],
                        category=category,
                        form=form,
                        meaning=row["english_meaning"].strip(),
                        example=row["spanish_example"].strip(),
                    )
                )
    return spellings, malformed


def build(
    spellings: list[Spelling],
) -> tuple[dict[str, dict[str, str]], dict[tuple[str, str], list[tuple[str, Spelling]]]]:
    """Map each category to {numbered form: meaning}; also return the homographs by spelling."""
    by_form: dict[tuple[str, str], list[Spelling]] = defaultdict(list)
    for spelling in spellings:
        by_form[(spelling.category, spelling.form)].append(spelling)
    entries: dict[str, dict[str, str]] = {category: {} for category in _CATEGORIES}
    homographs: dict[tuple[str, str], list[tuple[str, Spelling]]] = {}
    for (category, form), group in by_form.items():
        if len(group) == 1:
            entries[category][form] = group[0].meaning
            continue
        numbered = [
            (number_homograph(category, form, number), spelling)
            for number, spelling in enumerate(group, start=1)
        ]
        homographs[(category, form)] = numbered
        for name, spelling in numbered:
            entries[category][name] = spelling.meaning
    return {
        category: dict(sorted(values.items(), key=lambda item: item[0].strip("-").casefold()))
        for category, values in entries.items()
    }, homographs


def _update_json(path: Path, generated: dict[str, Any]) -> None:
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    data.update(generated)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def report(
    entries: dict[str, dict[str, str]],
    homographs: dict[tuple[str, str], list[tuple[str, Spelling]]],
    malformed: list[str],
) -> str:
    lines = [
        "# Spanish lexicon review",
        "",
        ", ".join(f"{len(entries[category])} {category} entries" for category in _CATEGORIES) + ".",
        "",
        f"## Homographs ({len(homographs)})",
        "",
        "Spellings listed by several rows. Rows that mean the same thing should be merged in the "
        "CSV; the others keep their numbers, and the prompt tells the model which one to use.",
    ]
    for (category, form), numbered in sorted(homographs.items()):
        lines += ["", f"### {category} `{form}`", ""]
        lines += [
            f"- `{name}` (row {spelling.row}): {spelling.meaning}"
            + (f" — {spelling.example}" if spelling.example else "")
            for name, spelling in numbered
        ]
    lines += ["", f"## Malformed spellings ({len(malformed)})", "", "Skipped; fix them in the CSV."]
    lines += ["", *(f"- {item}" for item in malformed)] if malformed else ["", "None."]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the Spanish lexicon JSON from the CSV.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    spellings, malformed = read_spellings(args.input)
    entries, homographs = build(spellings)
    _update_json(AFFIXES_PATH, {"prefix": entries["prefix"], "suffix": entries["suffix"]})
    _update_json(ROOTS_PATH, {"etymological_roots": entries["root"]})
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report(entries, homographs, malformed), encoding="utf-8")
    print(", ".join(f"{category}: {len(entries[category])}" for category in _CATEGORIES))
    print(f"homographs: {len(homographs)}, malformed: {len(malformed)}")
    print(f"report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
