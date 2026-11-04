"""Annotate example sentences word by word, for the meanings the website shows on hover.

spaCy splits each sentence, finds every word's dictionary form, and joins a separated verb prefix
to its verb ("hast ... vor" is vorhaben). A word whose vocabulary entry has a single meaning takes
that meaning; the language model is asked only for the rest, in batches of sentences: words whose
entry lists several meanings ("from, of") and words that are not in the vocabulary at all.
"""

import json
import re
from collections import defaultdict
from collections.abc import Iterable, Sequence
from typing import TYPE_CHECKING

from config import Config, get_settings
from core.models import (
    ExampleToken,
    LexiconEntry,
    TokenGloss,
    TokenGlossReply,
    TokenToGloss,
)
from core.pipeline import TaskResult, ValidationError, _generate_json, _run_many
from services import db, example_tokens
from services.clients import create_llm, model_client
from utils.runtime import Cache, RunSummary, get_logger, read_prompt, setup_logging

if TYPE_CHECKING:
    from spacy.language import Language
    from spacy.tokens import Doc

SPACY_MODEL = "de_core_news_md"
PROMPT = "token_glosses_v1"
MEANING_LANGUAGE = "en"
SENTENCES_PER_CALL = 20
MAX_GLOSS_LENGTH = 60

_LEAD = re.compile(r"^(?:der|die|das|sich) (?=\S)")
# A meaning that lists alternatives ("from, of", "to drive; to travel") needs the sentence to pick.
_SEVERAL_MEANINGS = re.compile(r"[,;/]")
# The vocabulary word classes each spaCy part of speech may belong to.
_CLASSES_BY_POS: dict[str, frozenset[str]] = {
    "NOUN": frozenset({"noun"}),
    "PROPN": frozenset({"noun"}),
    "VERB": frozenset({"verb"}),
    "AUX": frozenset({"verb"}),
    "ADJ": frozenset({"adjective"}),
    # Predicative adjectives are often tagged as adverbs ("Das ist schön").
    "ADV": frozenset({"adverb", "adjective", "particle"}),
    "ADP": frozenset({"preposition"}),
    "PRON": frozenset({"pronoun"}),
    # Quantifiers such as viel are adjectives in the vocabulary.
    "DET": frozenset({"article", "pronoun", "adjective"}),
    "CCONJ": frozenset({"conjunction"}),
    "SCONJ": frozenset({"conjunction"}),
    "NUM": frozenset({"numeral"}),
    "INTJ": frozenset({"interjection"}),
    "PART": frozenset({"particle", "adverb"}),
}


# spaCy's lemmatizer gets German modal verbs wrong ("muss" stays, "kannst" becomes "könnsten").
_MODAL_FORMS: dict[str, str] = {
    form: infinitive
    for infinitive, forms in {
        "können": "kann kannst könnt konnte konntest konnten "
        "konntet könnte könntest könnten könntet",
        "müssen": "muss musst müsst musste musstest mussten "
        "musstet müsste müsstest müssten müsstet",
        "dürfen": "darf darfst dürft durfte durftest durften "
        "durftet dürfte dürftest dürften dürftet",
        "sollen": "soll sollst sollt sollte solltest sollten solltet",
        "wollen": "will willst wollt wollte wolltest wollten wolltet",
        "mögen": "mag magst mögt mochte mochtest mochten mochtet",
        "möchten": "möchte möchtest möchtet",
    }.items()
    for form in forms.split()
}


def lexicon_key(word: str) -> str:
    """'das Guthaben' and 'sich freuen' are looked up as 'guthaben' and 'freuen'."""
    return _LEAD.sub("", word.strip()).lower()


class Lexicon:
    def __init__(self, entries: Iterable[LexiconEntry]) -> None:
        self.by_key: dict[str, list[LexiconEntry]] = defaultdict(list)
        self.by_id: dict[int, LexiconEntry] = {}
        for entry in entries:
            self.by_key[lexicon_key(entry.word)].append(entry)
            self.by_id[entry.id] = entry

    def find(self, lemma: str, pos: str) -> list[LexiconEntry]:
        """Entries spelled like the lemma whose word class fits the part of speech.

        The class check keeps "seiner" (a determiner) away from the verb sein.
        """
        classes = _CLASSES_BY_POS.get(pos, frozenset())
        return [
            entry for entry in self.by_key.get(lemma.lower(), []) if entry.word_class in classes
        ]

    def match(self, lemma: str, surface: str, pos: str) -> tuple[str, list[LexiconEntry], bool]:
        """The lemma to store, its entries, and whether the entry is certain enough to take its
        meaning without asking the model."""
        lemma = _MODAL_FORMS.get(surface.lower(), lemma)
        entries = self.find(lemma, pos)
        if entries:
            return lemma, entries, True
        # spaCy's lemma is sometimes wrong where the word as written is an entry: Kuchen, not Kuche.
        entries = self.find(surface, pos)
        if entries:
            return _LEAD.sub("", entries[0].word), entries, True
        # spaCy and the vocabulary sometimes disagree on the class ("bitte", "klar"). A single
        # entry with that spelling is still the word, but the model picks its meaning. Never for
        # determiners, which share spellings with other words (seiner is not the verb sein).
        same_spelling = self.by_key.get(lemma.lower(), [])
        if pos != "DET" and len(same_spelling) == 1:
            return lemma, same_spelling, False
        return lemma, [], False


def load_spacy() -> "Language":
    try:
        import spacy
    except ImportError as error:
        raise RuntimeError(
            'annotate needs spaCy and its German model: pip install -e ".[annotate]"'
        ) from error
    return spacy.load(SPACY_MODEL, disable=["ner"])


def parse(nlp: "Language", sentence: str) -> "Doc":
    """Parse a sentence as if its first word were lowercase, unless that word is a noun.

    A capitalized sentence-initial verb keeps its capital in the lemma or reads as a noun ("Hast
    du ..." as the noun Hast, "Kannst" as "Kannst"). Lowercasing one letter keeps every offset.
    """
    doc = nlp(sentence)
    first = next((token for token in doc if not token.is_punct), None)
    if first is None or not first.text[:1].isupper():
        return doc
    lowered = sentence[: first.idx] + sentence[first.idx].lower() + sentence[first.idx + 1 :]
    retry = nlp(lowered)
    # A noun or name stays as written unless the lowercase reading is a verb: Zug stays.
    if first.pos_ in {"NOUN", "PROPN"} and retry[first.i].pos_ not in {"VERB", "AUX"}:
        return doc
    return retry


def tokenize(nlp: "Language", lexicon: Lexicon, sentence: str) -> list[ExampleToken]:
    doc = parse(nlp, sentence)
    # A separated prefix and its verb both belong to the joined verb: "an" + "rufen" is anrufen.
    joined: dict[int, tuple[str, list[LexiconEntry]]] = {}
    for token in doc:
        if token.dep_ != "svp" or token.head.pos_ not in {"VERB", "AUX"}:
            continue
        lemma = token.lemma_.lower() + token.head.lemma_.lower()
        entries = lexicon.find(lemma, "VERB")
        if entries:
            joined[token.i] = joined[token.head.i] = (lemma, entries)

    tokens: list[ExampleToken] = []
    for token in doc:
        if token.is_punct or token.is_space:
            continue
        if token.i in joined:
            lemma, entries = joined[token.i]
            certain = True
        else:
            lemma, entries, certain = lexicon.match(token.lemma_, token.text, token.pos_)
        entry = entries[0] if entries else None
        # Only a certain, unambiguous entry with one meaning settles it without the model.
        settled = (
            entry.gloss
            if entry is not None
            and certain
            and len(entries) == 1
            and entry.gloss
            and not _SEVERAL_MEANINGS.search(entry.gloss)
            else None
        )
        tokens.append(
            ExampleToken(
                position=len(tokens),
                start=token.idx,
                end=token.idx + len(token.text),
                # From the original sentence: the parse may have lowercased its first letter.
                surface=sentence[token.idx : token.idx + len(token.text)],
                lemma=lemma,
                word_id=entry.id if entry else None,
                lexicon_gloss=settled,
            )
        )
    return tokens


def _request(pending: Sequence[TokenToGloss], lexicon: Lexicon) -> str:
    sentences = []
    for example_id, rows in _by_example(pending).items():
        words = []
        for row in rows:
            word: dict[str, object] = {"i": row.position, "word": row.surface, "lemma": row.lemma}
            entry = lexicon.by_id.get(row.word_id) if row.word_id is not None else None
            if entry and entry.gloss:
                word["options"] = entry.gloss
            words.append(word)
        sentences.append(
            {
                "id": example_id,
                "sentence": rows[0].sentence,
                "translation": rows[0].translation,
                "words": words,
            }
        )
    return json.dumps(sentences, ensure_ascii=False, indent=1)


def _by_example(rows: Iterable[TokenToGloss]) -> dict[int, list[TokenToGloss]]:
    grouped: dict[int, list[TokenToGloss]] = defaultdict(list)
    for row in rows:
        grouped[row.example_id].append(row)
    return grouped


def _validate_reply(reply: TokenGlossReply, pending: Sequence[TokenToGloss]) -> None:
    answered = {sentence.id: sentence.glosses for sentence in reply.sentences}
    for example_id, rows in _by_example(pending).items():
        glosses = answered.get(example_id)
        if glosses is None:
            raise ValidationError(f"no answer for example {example_id}")
        for row in rows:
            gloss = glosses.get(str(row.position), "").strip()
            if not gloss or len(gloss) > MAX_GLOSS_LENGTH or "\n" in gloss:
                raise ValidationError(f"bad meaning for {row.surface!r} in example {example_id}")


def _batches(rows: Sequence[TokenToGloss]) -> list[list[TokenToGloss]]:
    grouped = list(_by_example(rows).values())
    return [
        [row for sentence in grouped[start : start + SENTENCES_PER_CALL] for row in sentence]
        for start in range(0, len(grouped), SENTENCES_PER_CALL)
    ]


def annotate_examples(
    config: Config,
    *,
    language: str,
    limit: int | None,
    force: bool,
    use_model: bool = True,
) -> TaskResult:
    """Tokenize examples that have no tokens yet, then fill in the meanings still missing.

    Both steps are idempotent: a rerun tokenizes only new examples and asks the model only for
    words that still lack a meaning, so a failed batch is retried by running the command again.
    """
    setup_logging("annotate", language)
    summary = RunSummary("annotate", language)
    nlp = load_spacy()
    with db.connect() as connection:
        lexicon = Lexicon(
            example_tokens.lexicon_entries(
                connection, language=language, meaning_language=MEANING_LANGUAGE
            )
        )
        examples = example_tokens.examples_to_tokenize(
            connection, language=language, limit=limit, force=force
        )
        for example_id, sentence in examples:
            tokens = tokenize(nlp, lexicon, sentence)
            with connection.transaction():
                example_tokens.replace_tokens(connection, example_id, tokens)
                example_tokens.upsert_glosses(
                    connection,
                    [
                        TokenGloss(
                            example_id=example_id,
                            position=token.position,
                            meaning_language=MEANING_LANGUAGE,
                            gloss=token.lexicon_gloss,
                            source="lexicon",
                        )
                        for token in tokens
                        if token.lexicon_gloss
                    ],
                )
        get_logger().info("tokenized %d examples", len(examples))
        pending = example_tokens.tokens_without_glosses(
            connection, language=language, meaning_language=MEANING_LANGUAGE, limit=limit
        )

    if not use_model or not pending:
        get_logger().info("%d words still need a meaning from the model", len(pending))
        summary.write()
        return TaskResult(processed=len(examples), failed=0)

    model = config.providers.llm.model
    template = read_prompt(PROMPT)
    cache = Cache(language, "token_glosses")
    with model_client(get_settings()) as client:
        llm = create_llm(client, config)

        def gloss_batch(batch: list[TokenToGloss]) -> tuple[list[TokenGloss], bool]:
            reply, cached = _generate_json(
                llm=llm,
                cache=cache,
                word=f"examples {batch[0].example_id}-{batch[-1].example_id}",
                model=model,
                prompt=template.substitute(sentences=_request(batch, lexicon)),
                schema=TokenGlossReply,
                validate=lambda value: _validate_reply(value, batch),
                config=config,
                summary=summary,
            )
            answered = {sentence.id: sentence.glosses for sentence in reply.sentences}
            glosses = [
                TokenGloss(
                    example_id=row.example_id,
                    position=row.position,
                    meaning_language=MEANING_LANGUAGE,
                    gloss=answered[row.example_id][str(row.position)].strip(),
                    source="model",
                )
                for row in batch
            ]
            with db.connect() as connection, connection.transaction():
                example_tokens.upsert_glosses(connection, glosses)
            return glosses, cached

        batches = _batches(pending)
        _results, failed = _run_many(
            batches,
            gloss_batch,
            lambda batch: f"examples {batch[0].example_id}-{batch[-1].example_id}",
            summary,
            config.llm_concurrency,
        )
    summary.write()
    return TaskResult(processed=len(examples) + len(batches) - failed, failed=failed)
