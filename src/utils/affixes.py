"""The curated prefix and suffix dictionary.

An affix is shared by every word that contains it, so its meaning must fit all of them. The model
only sees one word at a time, so affix meanings come from src/lexicon/{language}_affixes.json and
the model's own meaning is kept only for affixes the dictionary does not list yet.

The dictionary also decides whether a part is an affix at all. The model labels the same part
differently from word to word ("groß" a root in Großvater but a prefix in Großmutter), which splits
related words across two morphemes, so normalize_segment_types settles the type before saving.
"""

import json
from functools import cache

from config import PIPELINE_ROOT
from core.models import Segment

LEXICON_ROOT = PIPELINE_ROOT / "lexicon"

AffixMeanings = dict[tuple[str, str], str]
_AFFIX_TYPES = ("prefix", "suffix")


@cache
def _load_lexicon(language: str) -> dict[str, dict[str, str]]:
    path = LEXICON_ROOT / f"{language}_affixes.json"
    if not path.is_file():
        return {}
    data: dict[str, dict[str, str]] = json.loads(path.read_text(encoding="utf-8"))
    return data


@cache
def load_affix_meanings(language: str) -> AffixMeanings:
    """Map (morpheme_type, morpheme) such as ("prefix", "ver-") to its curated meaning."""
    data = _load_lexicon(language)
    return {
        (morpheme_type, morpheme): meaning
        for morpheme_type in _AFFIX_TYPES
        for morpheme, meaning in data.get(morpheme_type, {}).items()
    }


@cache
def load_root_homographs(language: str) -> frozenset[str]:
    """Roots spelled like a listed affix but unrelated to it, such as "Ei" (egg) and "-ei".

    Keys are compared case-insensitively without hyphens; the values only document the reason.
    """
    return frozenset(key.casefold() for key in _load_lexicon(language).get("root_homographs", {}))


def affix_key(morpheme: str) -> str:
    """Compare roots and affixes by their letters: "groß-", "Groß" and "groß" share one key."""
    return morpheme.strip("-").casefold()


def apply_affix_meanings(segments: list[Segment], meanings: AffixMeanings) -> list[Segment]:
    return [
        segment.model_copy(update={"morpheme_meaning": meaning})
        if segment.morpheme_type is not None
        and segment.morpheme is not None
        and (meaning := meanings.get((segment.morpheme_type, segment.morpheme))) is not None
        else segment
        for segment in segments
    ]


def normalize_segment_types(
    segments: list[Segment], meanings: AffixMeanings, *, word_class: str
) -> list[Segment]:
    """Give each part the one type the dictionary implies, whatever the model labelled it.

    - A prefix the dictionary does not list is a root: German compounds put a full word first
      (groß in Großmutter, Haupt in Hauptbahnhof), and the curated prefixes are the bound ones.
    - In a verb, a root spelled like a listed prefix and followed by another part is that prefix:
      weg in weggehen is the same particle as weg- elsewhere, like an- or zurück-.

    - A single letter the dictionary does not list is an abbreviation, not a morpheme (U in
      U-Bahn for Untergrund, S in S-Bahn), so it stays an untyped part and the word is still
      linked through its real root, Bahn.

    Meanings of converted prefixes come from apply_affix_meanings, which runs afterwards.
    """
    prefixes = {affix_key(morpheme): morpheme for kind, morpheme in meanings if kind == "prefix"}
    last_typed = max(
        (index for index, segment in enumerate(segments) if segment.morpheme_type is not None),
        default=-1,
    )
    normalized = []
    for index, segment in enumerate(segments):
        morpheme = segment.morpheme
        if morpheme is None:
            normalized.append(segment)
        elif (
            len(affix_key(morpheme)) == 1
            and (segment.morpheme_type or "", morpheme) not in meanings
        ):
            normalized.append(
                segment.model_copy(
                    update={"morpheme_type": None, "morpheme": None, "morpheme_meaning": None}
                )
            )
        elif segment.morpheme_type == "prefix" and ("prefix", morpheme) not in meanings:
            normalized.append(
                segment.model_copy(
                    update={"morpheme_type": "root", "morpheme": morpheme.strip("-")}
                )
            )
        elif (
            segment.morpheme_type == "root"
            and word_class == "verb"
            and index < last_typed
            and affix_key(morpheme) in prefixes
        ):
            normalized.append(
                segment.model_copy(
                    update={"morpheme_type": "prefix", "morpheme": prefixes[affix_key(morpheme)]}
                )
            )
        else:
            normalized.append(segment)
    return normalized
