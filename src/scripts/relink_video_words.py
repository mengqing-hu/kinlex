"""Link the words of stored videos that were left without a vocabulary entry.

The lexicon learns to find more words over time (malas is malo, hacerlo is hacer). This runs it
again over every stored caption line and links each word that has no entry yet and now finds one.
Words already linked keep their entry, and the meanings shown for them stay as they are.

    python -m scripts.relink_video_words --dry-run
    python -m scripts.relink_video_words --language es
"""

import argparse
from collections import Counter, defaultdict
from typing import Any

from core.annotation import Lexicon, load_spacy, tokenize
from core.languages import language_profile
from services import db, example_tokens


def relink(language: str, *, dry_run: bool) -> None:
    profile = language_profile(language)
    nlp = load_spacy(profile.spacy_model)
    linked: Counter[tuple[str, str]] = Counter()
    left = 0
    with db.connect() as connection:
        videos = connection.execute(
            "select id, owner_id from public.videos where language = %s order by id", (language,)
        ).fetchall()
        lexicons: dict[Any, Lexicon] = {}
        for video_id, owner_id in videos:
            if owner_id not in lexicons:
                lexicons[owner_id] = Lexicon(
                    example_tokens.lexicon_entries(
                        connection,
                        language=language,
                        meaning_language="en",
                        owner_id=str(owner_id),
                    ),
                    profile,
                )
            lexicon = lexicons[owner_id]
            lines = dict(
                connection.execute(
                    "select position, text from public.video_lines where video_id = %s",
                    (video_id,),
                ).fetchall()
            )
            unlinked: dict[int, list[tuple[int, int, int, str]]] = defaultdict(list)
            for line, position, start, end, surface in connection.execute(
                """
                select line, position, start, "end", surface from public.video_tokens
                where video_id = %s and word_id is null
                """,
                (video_id,),
            ).fetchall():
                unlinked[line].append((position, start, end, surface))

            updates: list[tuple[int, str, str, int, int]] = []
            for line, tokens in unlinked.items():
                found = {
                    (token.start, token.end): token
                    for token in tokenize(nlp, lexicon, lines[line])
                    if token.word_id is not None
                }
                for position, start, end, surface in tokens:
                    token = found.get((start, end))
                    if token is None or token.word_id is None:
                        left += 1
                        continue
                    linked[(surface.lower(), token.lemma)] += 1
                    updates.append((token.word_id, token.lemma, video_id, line, position))
            if updates and not dry_run:
                with connection.transaction():
                    connection.cursor().executemany(
                        """
                        update public.video_tokens set word_id = %s, lemma = %s
                        where video_id = %s and line = %s and position = %s
                        """,
                        updates,
                    )

    for (surface, lemma), count in linked.most_common():
        print(f"{count:4}  {surface} -> {lemma}")
    verb = "would link" if dry_run else "linked"
    print(f"{verb} {sum(linked.values())} words in {len(videos)} videos; {left} still unlinked")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--language", default="es")
    parser.add_argument("--dry-run", action="store_true", help="list the links without saving")
    args = parser.parse_args()
    relink(args.language, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
