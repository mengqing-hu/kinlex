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
    gender: Literal["der", "die", "das"] | None = None
    plural: str | None = None
    segments: list[Segment]


class ReviewMetadata(Record):
    word: str
    word_class: str
    gender: str | None = None
    plural: str | None = None
    generation_model: str | None = None
    segments: list[Segment]


class AudioResult(Record):
    owner_type: Literal["word", "example"]
    owner_id: int
    path: str
    voice: str
    model: str
