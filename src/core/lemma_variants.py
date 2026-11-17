"""Dictionary forms to try when spaCy's lemma is not a vocabulary entry.

spaCy often leaves an inflected word as it is or gets its dictionary form half right: Spanish
"malas" becomes "mala", "buena" becomes "buen", "dame" stays "dame". The vocabulary lists one form
per word (malo, bueno, dar), so the lexicon tries these guesses in order and keeps the first that
is an entry. A guess is only ever used when the vocabulary has it, so a wrong guess costs nothing.

Each language has its own rules; a language without any gets no guesses.
"""

import re
import unicodedata
from collections.abc import Callable, Iterator

# Pronouns a Spanish infinitive, gerund or command can carry at its end: hacerlo, dímelo.
_ES_ENCLITICS = re.compile(r"(?:(?:me|te|se|nos|os|lo|la|los|las|le|les){1,2})$")
# Short forms before a noun: un buen día, el primer año.
_ES_APOCOPES = {
    "buen": "bueno",
    "mal": "malo",
    "gran": "grande",
    "primer": "primero",
    "tercer": "tercero",
    "algún": "alguno",
    "ningún": "ninguno",
    "cualquier": "cualquiera",
    "san": "santo",
}
# A preposition joined with the article el.
_ES_CONTRACTIONS = {"al": "a", "del": "de"}
# Commands that are not the infinitive's stem: di (decir), haz (hacer).
_ES_IRREGULAR_COMMANDS = {
    "di": "decir",
    "haz": "hacer",
    "pon": "poner",
    "ven": "venir",
    "ten": "tener",
    "sal": "salir",
    "ve": "ir",
    "sé": "ser",
}
# Forms spaCy's lemmatizer leaves as they are in some sentences.
_ES_VERB_FORMS = {
    form: infinitive
    for infinitive, forms in {
        "ir": "voy vas va vamos vais van vaya vayas vayamos vayáis vayan",
        "estar": "esté estés estemos estéis estén estoy estás está están",
        "ser": "sea seas seamos seáis sean eres",
        "haber": "haya hayas hayamos hayáis hayan",
        "dar": "dé des demos deis den",
    }.items()
    for form in forms.split()
}
_VERB_POS = frozenset({"VERB", "AUX"})


def strip_accents(word: str) -> str:
    """'vídeo' as 'video', keeping ñ, which is a letter of its own."""
    decomposed = unicodedata.normalize("NFD", word.replace("ñ", "\0").replace("Ñ", "\1"))
    plain = "".join(char for char in decomposed if unicodedata.category(char) != "Mn")
    return unicodedata.normalize("NFC", plain).replace("\0", "ñ").replace("\1", "Ñ")


def _spanish_singulars(word: str) -> Iterator[str]:
    if word.endswith("ces"):
        yield word[:-3] + "z"
    if word.endswith("es"):
        yield word[:-2]
    if word.endswith("s"):
        yield word[:-1]


def _spanish_masculines(word: str) -> Iterator[str]:
    if word.endswith("ora"):
        yield word[:-1]
    if word.endswith("a"):
        yield word[:-1] + "o"


def _spanish_infinitives(stem: str) -> Iterator[str]:
    """The infinitives a command or a verb with its pronouns removed may come from."""
    stem = strip_accents(stem)
    if stem in _ES_IRREGULAR_COMMANDS:
        yield _ES_IRREGULAR_COMMANDS[stem]
    if stem.endswith(("ar", "er", "ir")):
        yield stem
    if stem.endswith("ando"):
        yield stem[:-4] + "ar"
    if stem.endswith("iendo"):
        yield stem[:-5] + "er"
        yield stem[:-5] + "ir"
    if stem.endswith("a"):
        yield stem + "r"
    if stem.endswith("e"):
        yield stem + "r"
        yield stem[:-1] + "ir"
    # A one-syllable command such as da or ve with nothing after it.
    if len(stem) <= 3:
        yield stem + "r"


def spanish_variants(lemma: str, surface: str, pos: str) -> Iterator[str]:
    # A name is not inflected: Suiza is the country, not the adjective suizo.
    if pos == "PROPN":
        return
    lemma = lemma.lower()
    surface = surface.lower()
    words = dict.fromkeys((lemma, surface))
    # A verb only becomes another verb: "me duela" is doler, not the noun duelo.
    if pos in _VERB_POS:
        # spaCy writes a verb and its pronoun as two words: "hacer él" for hacerlo.
        if " " in lemma:
            yield lemma.split(" ", 1)[0]
        for word in words:
            if word in _ES_VERB_FORMS:
                yield _ES_VERB_FORMS[word]
        stem = _ES_ENCLITICS.sub("", surface)
        if stem and stem != surface:
            yield from _spanish_infinitives(stem)
        yield from _spanish_infinitives(surface)
        return
    for word in words:
        if word in _ES_VERB_FORMS:
            yield _ES_VERB_FORMS[word]
        if word in _ES_APOCOPES:
            yield _ES_APOCOPES[word]
        if word in _ES_CONTRACTIONS:
            yield _ES_CONTRACTIONS[word]
        # Short words such as "es" or "na" are not plurals or feminines of anything.
        if len(word) < 4:
            continue
        for singular in (word, *_spanish_singulars(word)):
            yield singular
            yield from _spanish_masculines(singular)


VARIANTS: dict[str, Callable[[str, str, str], Iterator[str]]] = {"es": spanish_variants}
# Languages whose vocabulary may be looked up without accents when nothing else matches: the
# captions write "video" where the vocabulary has "vídeo".
ACCENT_FREE = frozenset({"es"})
