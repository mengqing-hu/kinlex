"""Build the Spanish affix and etymological root dictionaries from the curated CSV.

Run from src/ whenever data/vocabulary/spanish/spanish_roots_affixes.csv changes:

    python -m scripts.build_es_lexicon

Every row becomes one entry: one meaning and all the spellings the row lists in `entry` and
`variants`. A word's part keeps the letters it has in the word, and the entry is named after the
row's first spelling, so imposible is "im" under in- (not), together with incapaz and ilegal. The
website lists the spellings the words use, most used first.

Rows whose first spellings share their letters are numbered in row order, kept inside the hyphen
so prefixes still end with "-": a1- (to, toward), a2- (not). Spanish morphemes never contain
digits, so the number cannot be mistaken for a letter. A Latin or Greek root also gets a number
when a hand-numbered modern stem in `numbered_roots` shares its letters (cap1- take, cap2- cape);
the modern stems take the numbers after the rows'. The report lists the numbered entries, the
spellings several entries share, and every malformed spelling.

Only the generated keys are rewritten: `prefix` and `suffix` in lexicon/es_affixes.json and
`etymological_roots` in lexicon/es_roots.json. Hand-edited keys such as `overrides` and
`numbered_roots` are kept.
"""

import argparse
import csv
import json
import re
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
_NUMBER = re.compile(r"\d+")


@dataclass(frozen=True)
class Row:
    number: str
    category: str
    forms: tuple[str, ...]
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


def read_rows(path: Path) -> tuple[list[Row], list[str]]:
    rows: list[Row] = []
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
            kept = []
            for form in dict.fromkeys(forms):
                if _is_well_formed(category, form):
                    kept.append(form)
                else:
                    malformed.append(f"row {row['no']}: {category} {form!r}")
            if kept:
                rows.append(
                    Row(
                        number=row["no"],
                        category=category,
                        forms=tuple(kept),
                        meaning=row["english_meaning"].strip(),
                        example=row["spanish_example"].strip(),
                    )
                )
    return rows, malformed


def build(
    rows: list[Row], numbered_roots: dict[str, str]
) -> tuple[dict[str, dict[str, Any]], dict[tuple[str, str], list[tuple[str, Row]]], list[str]]:
    """Name each row's entry; return the entries by category, the numbered rows by spelling, and
    the hand-numbered modern stems whose numbers clash with the rows'."""
    by_name: dict[tuple[str, str], list[Row]] = defaultdict(list)
    for row in rows:
        by_name[(row.category, row.forms[0])].append(row)
    modern = {_NUMBER.sub("", root) for root in numbered_roots}
    entries: dict[str, dict[str, Any]] = {category: {} for category in _CATEGORIES}
    homographs: dict[tuple[str, str], list[tuple[str, Row]]] = {}
    for (category, form), group in by_name.items():
        if len(group) == 1 and not (category == "root" and form in modern):
            names = [form]
        else:
            names = [number_homograph(category, form, n) for n in range(1, len(group) + 1)]
            homographs[(category, form)] = list(zip(names, group, strict=True))
        for name, row in zip(names, group, strict=True):
            entries[category][name] = {"meaning": row.meaning, "forms": list(row.forms)}
    clashes = [root for root in numbered_roots if root in entries["root"]]
    return (
        {
            category: dict(sorted(values.items(), key=lambda item: item[0].strip("-").casefold()))
            for category, values in entries.items()
        },
        homographs,
        clashes,
    )


def shared_spellings(entries: dict[str, dict[str, Any]]) -> dict[tuple[str, str], list[str]]:
    """Spellings several entries list, such as di- in di- (through) and dis- (apart)."""
    owners: dict[tuple[str, str], list[str]] = defaultdict(list)
    for category, values in entries.items():
        for name, entry in values.items():
            for form in entry["forms"]:
                owners[(category, form)].append(name)
    return {key: names for key, names in owners.items() if len(names) > 1}


def _update_json(path: Path, generated: dict[str, Any]) -> None:
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    data.update(generated)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def report(
    entries: dict[str, dict[str, Any]],
    homographs: dict[tuple[str, str], list[tuple[str, Row]]],
    clashes: list[str],
    malformed: list[str],
) -> str:
    shared = shared_spellings(entries)
    lines = [
        "# Spanish lexicon review",
        "",
        ", ".join(f"{len(entries[category])} {category} entries" for category in _CATEGORIES) + ".",
        "",
        f"## Numbered entries ({len(homographs)})",
        "",
        "Rows whose first spellings share their letters. Rows that mean the same thing should be "
        "merged in the CSV; the others keep their numbers, and the prompt tells the model which "
        "one to use.",
    ]
    for (category, form), numbered in sorted(homographs.items()):
        lines += ["", f"### {category} `{form}`", ""]
        lines += [
            f"- `{name}` (row {row.number}): {row.meaning}"
            + (f" — {row.example}" if row.example else "")
            for name, row in numbered
        ]
    lines += [
        "",
        f"## Spellings in several entries ({len(shared)})",
        "",
        "The model picks the entry by meaning.",
        "",
        *(
            f"- {category} `{form}`: {', '.join(f'`{name}`' for name in names)}"
            for (category, form), names in sorted(shared.items())
        ),
        "",
        f"## Modern stems numbered like a row ({len(clashes)})",
        "",
        "Renumber them in numbered_roots so they follow the rows' numbers.",
        "",
        *(f"- `{root}`" for root in clashes),
    ]
    lines += ["", f"## Malformed spellings ({len(malformed)})", "", "Skipped; fix them in the CSV."]
    lines += ["", *(f"- {item}" for item in malformed)] if malformed else ["", "None."]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the Spanish lexicon JSON from the CSV.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    rows, malformed = read_rows(args.input)
    roots_data = json.loads(ROOTS_PATH.read_text(encoding="utf-8")) if ROOTS_PATH.is_file() else {}
    entries, homographs, clashes = build(rows, roots_data.get("numbered_roots", {}))
    _update_json(AFFIXES_PATH, {"prefix": entries["prefix"], "suffix": entries["suffix"]})
    _update_json(ROOTS_PATH, {"etymological_roots": entries["root"]})
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report(entries, homographs, clashes, malformed), encoding="utf-8")
    print(", ".join(f"{category}: {len(entries[category])}" for category in _CATEGORIES))
    print(
        f"numbered: {len(homographs)}, clashing modern stems: {len(clashes)}, "
        f"malformed: {len(malformed)}"
    )
    print(f"report: {args.report}")
    return 0 if not clashes else 1


if __name__ == "__main__":
    raise SystemExit(main())
