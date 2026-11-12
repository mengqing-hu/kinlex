"""Typed records used by the database-driven pipeline."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

SegmentType = Literal["prefix", "root", "suffix"]


class Record(BaseModel):
    model_config = ConfigDict(frozen=True)


class Word(Record):
    id: int
    language: str
    word: str
    word_class: str
    gender: str | None = None
    plural: str | None = None
    word_meaning: str = ""
    example_sentence: str | None = None
    sentence_meaning: str | None = None


class VocabularyItem(Record):
    language: str
    word: str
    word_class: str
    # The CSV label before normalization, e.g. "Verb (trennbar)" or "Nomen (Pl.)".
    word_class_label: str = ""
    # The label's parenthesized detail kept for display, e.g. "Modalverb" or "reflexiv, trennbar".
    word_class_detail: str | None = None
    level: str
    word_meaning: str = ""
    example_sentence: str | None = None
    sentence_meaning: str | None = None


class AudioTarget(Record):
    owner_type: Literal["word", "example"]
    owner_id: int
    language: str
    text: str
    word_id: int | None = None
    gender: str | None = None


class Segment(Record):
    word_part: str
    morpheme_type: SegmentType | None = None
    morpheme: str | None = None
    morpheme_meaning: str | None = None
    is_separable: bool | None = None


class WordEnrichment(Record):
    # German stores the article the CSV gives (der, die, das); Spanish asks the model for the
    # gender, with "m/f" for nouns used with both articles (el/la estudiante); Portuguese takes it
    # from the CSV label.
    gender: Literal["der", "die", "das", "m", "f", "m/f"] | None = None
    # The article shown before a Spanish or Portuguese noun. The gender does not settle a Spanish
    # one (el agua is "f"); a Portuguese one follows from the label.
    article: (
        Literal["el", "la", "el/la", "los", "las", "o", "a", "o/a", "os", "as", "os/as"] | None
    ) = None
    plural: str | None = None
    segments: list[Segment]


class ReviewMetadata(Record):
    word: str
    word_class: str
    gender: str | None = None
    article: str | None = None
    plural: str | None = None
    generation_model: str | None = None
    segments: list[Segment]


class AudioResult(Record):
    owner_type: Literal["word", "example"]
    owner_id: int
    path: str
    voice: str
    model: str


class LexiconEntry(Record):
    id: int
    word: str
    word_class: str
    gloss: str | None = None


class ExampleToken(Record):
    """One word of an example sentence; start and end are character offsets, end exclusive."""

    position: int
    start: int
    end: int
    surface: str
    lemma: str
    word_id: int | None = None
    # The entry's meaning when it has only one; None leaves the choice to the model.
    lexicon_gloss: str | None = None


class TokenGloss(Record):
    example_id: int
    position: int
    meaning_language: str
    gloss: str
    source: Literal["lexicon", "model"]


class TokenToGloss(Record):
    example_id: int
    sentence: str
    translation: str | None
    position: int
    surface: str
    lemma: str
    word_id: int | None = None
    # Whether another language took this word's meaning from its entry, which means the entry
    # was certain to be the word.
    entry_certain: bool = False


class SentenceGlosses(Record):
    id: int
    glosses: dict[str, str]


class TokenGlossReply(Record):
    sentences: list[SentenceGlosses]


class WordForTopics(Record):
    id: int
    word: str
    word_class: str
    level: str | None
    meaning: str | None
    example_sentence: str | None


class WordTopics(Record):
    id: int
    topics: list[str]


class WordTopicsReply(Record):
    words: list[WordTopics]


class WordToTranslate(Record):
    id: int
    word: str
    word_class: str
    # The English meanings in display order.
    meanings: list[str]
    example_sentence: str | None


class MeaningTranslation(Record):
    id: int
    meanings: list[str]


class WordMeaningsReply(Record):
    words: list[MeaningTranslation]


class SentenceToTranslate(Record):
    id: int
    sentence: str
    translation: str


class TranslatedText(Record):
    id: int
    text: str


class TranslatedTextReply(Record):
    items: list[TranslatedText]


class MorphemeToTranslate(Record):
    id: int
    morpheme: str
    morpheme_type: str
    meaning: str
    # A few words that use it, which show the sense the meaning describes.
    words: list[str]


class FamilyWord(Record):
    word: str
    word_part: str
    meaning: str


class RootFamily(Record):
    """A root with the words that use it, for the review of word families."""

    id: int
    root: str
    meaning: str
    # A Latin or Greek root from the curated list, whose meaning is fixed.
    listed: bool
    words: list[FamilyWord]


class RootOutlier(Record):
    word: str
    reason: str
    # The stem the word should have instead, with its meaning, when the model can name one.
    root: str | None = None
    root_meaning: str | None = None


class RootVerdict(Record):
    id: int
    outliers: list[RootOutlier] = []
    # A better meaning for the root, when the current one does not fit the words that stay.
    meaning: str | None = None


class RootReviewReply(Record):
    roots: list[RootVerdict]
