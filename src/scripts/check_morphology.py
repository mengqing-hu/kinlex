"""Flag generated segmentations that are likely wrong, so review can start from a short list.

Run from src/ after a `fields` run:

    python -m scripts.check_morphology

Every check is a heuristic: a flagged entry is worth a look, not necessarily an error.
"""

import argparse
import csv
from dataclasses import dataclass, field
from pathlib import Path

from core.consistency import make_roots_consistent
from core.languages import LANGUAGES, language_profile
from services import db
from utils.affixes import affix_key, load_affix_meanings, load_root_homographs
from utils.roots import load_lowercase_roots


@dataclass
class Part:
    text: str
    morpheme: str | None
    morpheme_type: str | None


@dataclass
class WordRow:
    word: str
    word_class: str
    plural: str | None
    parts: list[Part] = field(default_factory=list)

    def show(self) -> str:
        return " + ".join(
            repr(part.text) if part.morpheme is None else f"{part.text}[{part.morpheme}]"
            for part in self.parts
        )


@dataclass
class MorphemeRow:
    morpheme: str
    morpheme_type: str
    meaning: str
    words: list[str] = field(default_factory=list)


def _load(language: str) -> tuple[list[WordRow], list[MorphemeRow]]:
    with db.connect() as connection:
        words = {
            int(row[0]): WordRow(word=row[1], word_class=row[2], plural=row[3])
            for row in connection.execute(
                """
                select id, word, word_class, plural from public.words
                where language = %s and source = 'vocabulary_csv'
                order by id
                """,
                (language,),
            )
        }
        morphemes: dict[int, MorphemeRow] = {}
        for word_id, text, morpheme_id, morpheme, morpheme_type, meaning in connection.execute(
            """
            select wm.word_id, wm.word_part, m.id, m.morpheme, m.morpheme_type, m.morpheme_meaning
            from public.word_morphemes wm
            left join public.morphemes m on m.id = wm.morpheme_id
            order by wm.word_id, wm.position
            """
        ):
            word = words.get(int(word_id))
            if word is None:
                continue
            word.parts.append(Part(text, morpheme, morpheme_type))
            if morpheme_id is not None:
                entry = morphemes.setdefault(
                    int(morpheme_id), MorphemeRow(morpheme, morpheme_type, meaning)
                )
                entry.words.append(word.word)
    return list(words.values()), list(morphemes.values())


def _source_labels(path: Path) -> dict[str, str]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        return {row["word"]: row["word_class"] for row in csv.DictReader(file)}


def build_report(language: str, input_path: Path) -> str:
    words, morphemes = _load(language)
    with db.connect() as connection:
        consistency = make_roots_consistent(db.segmented_words(connection, language=language))
    labels = _source_labels(input_path)
    affixes = load_affix_meanings(language)
    homographs = load_root_homographs(language)
    lowercase_roots = load_lowercase_roots(language)
    done = [word for word in words if word.parts]
    roots = {m.morpheme: m for m in morphemes if m.morpheme_type == "root"}
    affixes_by_key: dict[str, list[MorphemeRow]] = {}
    for m in morphemes:
        if m.morpheme_type != "root":
            affixes_by_key.setdefault(affix_key(m.morpheme), []).append(m)
    verbs = {entry for entry, label in labels.items() if label.startswith("Verb")}
    nouns = {
        entry.split(" ", 1)[-1].casefold(): entry.split(" ", 1)[-1]
        for entry, label in labels.items()
        if label.startswith("Nomen")
    }

    sections = [
        (
            "Words without segmentation",
            "Failed or not yet processed.",
            [word.word for word in words if not word.parts],
        ),
        (
            "Roots that may be the same word written two ways",
            "For example `wohn` and `wohnen`: related words end up split across two entries.",
            [
                f"`{short}` ({len(roots[short].words)}) vs `{long}` ({len(roots[long].words)})"
                for short in roots
                for long in roots
                if short != long
                and long.casefold().startswith(short.casefold())
                and len(long) - len(short) <= 3
            ],
        ),
        (
            "Same text used as a root and as a prefix or suffix",
            "Related words end up under two morphemes. Fix the segmentation, or list an unrelated "
            "word with the same spelling under root_homographs in src/lexicon/.",
            [
                f"root `{root.morpheme}` ({', '.join(root.words[:3])}) vs "
                + ", ".join(
                    f"{affix.morpheme_type} `{affix.morpheme}` ({', '.join(affix.words[:3])})"
                    for affix in affixes_by_key[affix_key(root.morpheme)]
                )
                for root in roots.values()
                if affix_key(root.morpheme) in affixes_by_key
                and affix_key(root.morpheme) not in homographs
            ],
        ),
        (
            "Roots that name another segmented word",
            "Run `python -m scripts.process_vocabulary consistency` to expand them.",
            [
                f"{change.word.word}: "
                + " + ".join(
                    f"{s.word_part.strip()}[{s.morpheme}]" for s in change.after if s.morpheme
                )
                for change in consistency.changes
            ],
        ),
        (
            "Compound parts spelled differently from the word they name",
            "The part could not be split like that word; fix one of the two segmentations.",
            [
                f"{item.word.word}: `{item.word_part}` vs {item.target}"
                for item in consistency.unresolved
            ],
        ),
        (
            "Noun roots written in lowercase",
            "Noun roots use the capitalized singular unless a verb of the same form exists. "
            "Roots that should stay lowercase go under lowercase_roots in src/lexicon/.",
            [
                f"`{root}` → `{nouns[root]}`"
                for root in roots
                if root in nouns and root not in verbs and root not in lowercase_roots
            ],
        ),
        (
            "Verb roots named by the infinitive",
            "Verb roots use the stem (`fahr-`, not `fahren`); `consistency` renames them.",
            [f"`{root}`" for root in roots if root in verbs],
        ),
        (
            "Nouns without a plural",
            "Check whether the noun is really uncountable.",
            [
                word.word
                for word in done
                if word.word_class == "noun"
                and word.plural is None
                and "Pl." not in labels.get(word.word, "")
            ],
        ),
        (
            "Prefixes and suffixes missing from the affix dictionary",
            "Add them to src/lexicon/ with a general meaning, or fix the segmentation.",
            [
                f"{m.morpheme_type} `{m.morpheme}` ({m.meaning}): {', '.join(m.words[:5])}"
                for m in morphemes
                if m.morpheme_type != "root" and (m.morpheme_type, m.morpheme) not in affixes
            ],
        ),
        (
            "Prefixes and suffixes used by only one word",
            "Usually an odd spelling or a split that is not really productive.",
            [
                f"{m.morpheme_type} `{m.morpheme}` ({m.meaning}): {m.words[0]}"
                for m in morphemes
                if len(m.words) == 1 and m.morpheme_type != "root"
            ],
        ),
        (
            "All prefixes and suffixes",
            "Each meaning is shared by every word that uses it, so it must fit all of them.",
            [
                f"{m.morpheme_type} `{m.morpheme}` ({len(m.words)}): {m.meaning}"
                for m in sorted(morphemes, key=lambda m: (m.morpheme_type, m.morpheme))
                if m.morpheme_type != "root"
            ],
        ),
    ]

    lines = [
        "# Morphology review",
        "",
        f"{len(done)} of {len(words)} words segmented, {len(morphemes)} morphemes.",
    ]
    for title, note, items in sections:
        lines += ["", f"## {title} ({len(items)})", "", note, ""]
        lines += [f"- {item}" for item in sorted(items)] if items else ["None."]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Flag likely segmentation errors.")
    parser.add_argument("--language", default="de", choices=sorted(LANGUAGES))
    parser.add_argument("--input", type=Path, help="defaults to the language's vocabulary CSV")
    parser.add_argument("--output", type=Path, help="defaults to data/output/<language>/")
    args = parser.parse_args()
    profile = language_profile(args.language)
    args.input = args.input or profile.vocabulary_path
    args.output = args.output or profile.output_dir / "morphology_issues.md"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_report(args.language, args.input), encoding="utf-8")
    print(f"report: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
