"""What the pipeline does differently for each learning language.

German names roots by modern words and its infinitives (the stem is cut later); Spanish and
Portuguese segment into stems from the start and spell every affix part as their lexicon lists it.
A noun's gender comes from the article in a German entry ("der Mann"), from the model for Spanish
(el agua is feminine), and from the CSV label for Portuguese ("substantivo f.").
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from config import REPO_ROOT

GenderSource = Literal["article", "model", "label"]


@dataclass(frozen=True)
class LanguageProfile:
    code: str
    # The folder and file name of the vocabulary CSV: data/vocabulary/german/german.csv.
    vocabulary: str
    prompt: str
    # Words are segmented into stems with the lexicon's spellings: tidy_segments settles the
    # model's layouts, affix parts must be spelled as listed, and verb stems come from the model.
    stems: bool
    gender_source: GenderSource
    # The accent stored with each audio file.
    accent: str
    # The spaCy pipeline that splits sentences into words and finds their dictionary forms.
    spacy_model: str
    # How a reflexive verb is listed after its infinitive: levantarse, chamar-se. spaCy gives the
    # plain infinitive, so the entry is also looked up with this ending. German lists "sich" first.
    reflexive_ending: str | None = None

    @property
    def vocabulary_path(self) -> Path:
        return REPO_ROOT / "data" / "vocabulary" / self.vocabulary / f"{self.vocabulary}.csv"

    @property
    def output_dir(self) -> Path:
        return REPO_ROOT / "data" / "output" / self.code


LANGUAGES = {
    profile.code: profile
    for profile in (
        LanguageProfile(
            "de", "german", "word_enrichment_v2", False, "article", "de-DE", "de_core_news_md"
        ),
        LanguageProfile(
            "es", "spanish", "word_enrichment_es_v2", True, "model", "es", "es_core_news_md", "se"
        ),
        LanguageProfile(
            "pt",
            "portuguese",
            "word_enrichment_pt_v1",
            True,
            "label",
            "pt-BR",
            "pt_core_news_md",
            "-se",
        ),
    )
}


def language_profile(code: str) -> LanguageProfile:
    try:
        return LANGUAGES[code]
    except KeyError as error:
        known = ", ".join(LANGUAGES)
        raise ValueError(f"unknown learning language {code!r}; use one of {known}") from error


# The CSV label states a Portuguese noun's gender, and the gender settles its article:
# "substantivo m./f." is o/a estudante, "substantivo f. pl." is as férias.
_LABEL_GENDER = re.compile(r"\bsubstantivo (?P<gender>m\./f\.|m\.|f\.)(?P<plural> pl\.)?")
_PORTUGUESE_ARTICLES = {
    ("m", False): "o",
    ("f", False): "a",
    ("m/f", False): "o/a",
    ("m", True): "os",
    ("f", True): "as",
    ("m/f", True): "os/as",
}


def gender_from_label(label: str) -> tuple[str, str] | None:
    """The gender and article a Portuguese noun label gives: ("f", "a") for "substantivo f."."""
    match = _LABEL_GENDER.search(label)
    if match is None:
        return None
    gender = match.group("gender").replace(".", "")
    return gender, _PORTUGUESE_ARTICLES[(gender, match.group("plural") is not None)]
