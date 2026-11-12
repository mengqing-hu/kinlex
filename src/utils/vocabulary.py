"""Read the canonical vocabulary CSV used by the content pipeline."""

import csv
import re
from pathlib import Path

from core.models import VocabularyItem

REQUIRED_COLUMNS = (
    "word",
    "word_class",
    "word_meaning",
    "example_sentence",
    "sentence_meaning",
    "level",
)

WORD_CLASS_PREFIXES = {
    "adjektiv": "adjective",
    "adverb": "adverb",
    "artikel": "article",
    "ausdruck": "expression",
    "interjektion": "interjection",
    "konjunktion": "conjunction",
    "nomen": "noun",
    "numerale": "numeral",
    "partikel": "particle",
    "pronomen": "pronoun",
    "präposition": "preposition",
    "verb": "verb",
    # Spanish
    "adjetivo": "adjective",
    "adverbio": "adverb",
    "artículo": "article",
    "conjunción": "conjunction",
    "interjección": "interjection",
    "preposición": "preposition",
    "pronombre": "pronoun",
    "sustantivo": "noun",
    "verbo": "verb",
    # Portuguese; adjetivo and verbo are spelled as in Spanish
    "advérbio": "adverb",
    "artigo": "article",
    "conjunção": "conjunction",
    "expressão": "expression",
    "interjeição": "interjection",
    "preposição": "preposition",
    "pronome": "pronoun",
    "substantivo": "noun",
}


def normalize_word_class(value: str) -> str:
    """Map detailed German, Spanish or Portuguese CSV labels to a stable broad part of speech."""
    normalized = value.strip().casefold()
    for prefix, word_class in WORD_CLASS_PREFIXES.items():
        if normalized.startswith(prefix):
            return word_class
    return normalized


_DETAIL = re.compile(r"\((?P<detail>[^()]*)\)\s*$")
_NOUN_GENDERS = {"m", "f", "n"}


def word_class_detail(label: str, word_class: str) -> str | None:
    """Return the parenthesized part of a label: "Verb (Modalverb)" gives "Modalverb".

    A noun's m/f/n is dropped because the article already shows it, so "Nomen (f)" has no detail
    and "Nomen (n, Eigenname)" gives "Eigenname".
    """
    match = _DETAIL.search(label)
    if match is None:
        return None
    parts = [part.strip() for part in match.group("detail").split(",")]
    if word_class == "noun":
        parts = [part for part in parts if part not in _NOUN_GENDERS]
    return ", ".join(part for part in parts if part) or None


def read_vocabulary(
    path: Path,
    *,
    language: str,
    offset: int = 0,
    limit: int | None = None,
) -> list[VocabularyItem]:
    if offset < 0:
        raise ValueError("vocabulary offset cannot be negative")
    if path.suffix.casefold() != ".csv":
        raise ValueError(f"vocabulary input must be a CSV file: {path}")
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        missing = [column for column in REQUIRED_COLUMNS if column not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(missing)}")
        items: list[VocabularyItem] = []
        for row_number, row in enumerate(reader, start=2):
            if row_number - 2 < offset:
                continue
            values = {column: (row.get(column) or "").strip() for column in REQUIRED_COLUMNS}
            empty = [column for column, value in values.items() if not value]
            if empty:
                raise ValueError(f"CSV row {row_number} has empty columns: {', '.join(empty)}")
            values["word_class_label"] = values["word_class"]
            values["word_class"] = normalize_word_class(values["word_class"])
            items.append(
                VocabularyItem(
                    language=language,
                    word_class_detail=word_class_detail(
                        values["word_class_label"], values["word_class"]
                    ),
                    **values,
                )
            )
            if limit is not None and len(items) >= limit:
                break
    return items
