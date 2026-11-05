"""Name verb roots by their stem and keep the infinitive ending out of them.

The model names a verb root by its infinitive (fahren, mögen), so in the verb itself the root
covers the ending, and the related words show the dictionary form instead of the shared stem. The
root is the stem: fahr- in fahren, Fahrrad and Abfahrt, mög- in mögen, möglich and Möglichkeit.
The ending -en or -n is an inflection, so it stays an untyped part of the verb, like a linking
letter, and does not link related words.

Only the last root of a verb is split. Inside a noun the ending belongs to the noun (das Wissen,
der Laden), and a verb ending in a suffix (-ieren, -igen) keeps that suffix as the dictionary
lists it.
"""

import re

from core.models import Segment, Word

# A meaning such as "to like" or "must, to have to" marks a verb root the vocabulary lacks.
_VERB_MEANING = re.compile(r"(^|, )to ")


def infinitive_ending(text: str) -> str | None:
    """The ending to split off: -en (fahren), or -n after -er and -el (wandern, lächeln).

    Irregular short infinitives (sein, tun) have no such ending and stay whole.
    """
    lowered = text.lower()
    if lowered.endswith(("ern", "eln")):
        return "n"
    if lowered.endswith("en") and len(lowered) > 3:
        return "en"
    return None


def verb_infinitives(words: list[Word]) -> frozenset[str]:
    """The vocabulary's verbs as root names: "freuen" for "sich freuen"."""
    return frozenset(word.word.removeprefix("sich ") for word in words if word.word_class == "verb")


def _is_verb_root(segment: Segment, verbs: frozenset[str]) -> bool:
    morpheme = segment.morpheme
    return (
        segment.morpheme_type == "root"
        and morpheme is not None
        and morpheme[:1].islower()
        and not morpheme.endswith("-")
        and infinitive_ending(morpheme) is not None
        and (morpheme in verbs or bool(_VERB_MEANING.search(segment.morpheme_meaning or "")))
    )


def use_verb_stems(word: Word, segments: list[Segment], verbs: frozenset[str]) -> list[Segment]:
    """Rename verb roots to their stem ("fahren" → "fahr-") and split a verb's ending off.

    `segments` is the stem's parts, without the article or "sich".
    """
    renamed = []
    for segment in segments:
        if _is_verb_root(segment, verbs):
            morpheme = segment.morpheme or ""
            cut = len(morpheme) - len(infinitive_ending(morpheme) or "")
            segment = segment.model_copy(update={"morpheme": morpheme[:cut] + "-"})
        renamed.append(segment)
    if word.word_class != "verb" or not renamed or renamed[-1].morpheme_type != "root":
        return renamed
    last = renamed[-1]
    ending = infinitive_ending(last.word_part)
    if ending is None:
        return renamed
    cut = len(last.word_part) - len(ending)
    return [
        *renamed[:-1],
        last.model_copy(update={"word_part": last.word_part[:cut]}),
        Segment(word_part=last.word_part[cut:]),
    ]
