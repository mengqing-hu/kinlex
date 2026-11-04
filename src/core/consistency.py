"""Make roots agree across the whole vocabulary.

The model segments one word at a time, so it cannot see how the words inside a compound were
segmented on their own. Two mismatches follow:

- A compound keeps a word that is itself a compound as one root: Hauptbahnhof = Haupt + Bahnhof,
  although Bahnhof = Bahn + Hof.
- A compound gives a part a different root from the word it is: Badezimmer has the root "Bad",
  but das Bad has the root "baden".

Both have one fix: a root that is itself a segmented vocabulary word takes that word's
segmentation, so Hauptbahnhof becomes Haupt + Bahn + Hof and Badezimmer's "Bade" takes "baden".
"""

from dataclasses import dataclass

from core.models import Segment, Word

# The model sometimes writes a part in its root's spelling ("Wort" inside "Wörterbuch"). Folding
# umlauts keeps lengths, so parts can still be sliced from the entry's own letters.
_UMLAUTS = str.maketrans("äöü", "aou")


def spelling_key(text: str) -> str:
    # lower() rather than casefold(): "ß" must stay one character so parts can be sliced.
    return text.lower().translate(_UMLAUTS)


@dataclass(frozen=True)
class RootChange:
    word: Word
    before: list[Segment]
    after: list[Segment]


@dataclass(frozen=True)
class UnresolvedRoot:
    """A root naming a multi-part word whose letters the compound spells differently."""

    word: Word
    word_part: str
    target: str


@dataclass(frozen=True)
class ConsistencyResult:
    changes: list[RootChange]
    unresolved: list[UnresolvedRoot]


def split_lead(segments: list[Segment]) -> tuple[list[Segment], list[Segment]]:
    """Separate the stored article or "sich " part, which is untyped and ends in a space."""
    if segments and segments[0].morpheme_type is None and segments[0].word_part.endswith(" "):
        return segments[:1], segments[1:]
    return [], segments


def make_roots_consistent(entries: list[tuple[Word, list[Segment]]]) -> ConsistencyResult:
    """Expand every root that names another segmented word into that word's parts."""
    stems: dict[str, list[int]] = {}
    for index, (_word, segments) in enumerate(entries):
        _lead, body = split_lead(segments)
        stems.setdefault("".join(segment.word_part for segment in body), []).append(index)

    resolved: dict[int, list[Segment]] = {}
    unresolved: list[UnresolvedRoot] = []

    def resolve(index: int, visiting: frozenset[int]) -> list[Segment]:
        """The word's stem parts with nested roots expanded; `visiting` breaks cycles."""
        if index in resolved:
            return resolved[index]
        word, segments = entries[index]
        _lead, body = split_lead(segments)
        parts: list[Segment] = []
        for segment in body:
            targets = (
                stems.get(segment.morpheme or "", []) if segment.morpheme_type == "root" else []
            )
            # Only a single word with that exact stem counts; two would make the choice a guess.
            target = targets[0] if len(targets) == 1 else None
            if target is None or target == index or target in visiting:
                parts.append(segment)
                continue
            target_parts = resolve(target, visiting | {index})
            if all(part.morpheme_type is None for part in target_parts):
                # An unsegmented word (the preposition statt) says nothing about the root statt-.
                parts.append(segment)
                continue
            if len(target_parts) == 1:
                # Keep this word's letters ("Bade") but take the word's own root ("baden").
                parts.append(
                    segment.model_copy(
                        update={
                            key: getattr(target_parts[0], key)
                            for key in ("morpheme_type", "morpheme", "morpheme_meaning")
                        }
                    )
                )
                continue
            target_stem = "".join(part.word_part for part in target_parts)
            if spelling_key(segment.word_part) != spelling_key(target_stem):
                unresolved.append(UnresolvedRoot(word, segment.word_part, entries[target][0].word))
                parts.append(segment)
                continue
            start = 0
            for part in target_parts:
                end = start + len(part.word_part)
                parts.append(
                    part.model_copy(
                        update={
                            "word_part": segment.word_part[start:end],
                            # Only verbs carry separability; the target's flags fit the target.
                            "is_separable": part.is_separable
                            if word.word_class == "verb"
                            else None,
                        }
                    )
                )
                start = end
        if not visiting:
            resolved[index] = parts
        return parts

    changes = []
    for index, (word, segments) in enumerate(entries):
        lead, _body = split_lead(segments)
        after = lead + resolve(index, frozenset())
        if after != segments:
            changes.append(RootChange(word, segments, after))
    # A word reached through several compounds is resolved more than once.
    unique = list({(item.word.id, item.word_part): item for item in unresolved}.values())
    return ConsistencyResult(changes, unique)
