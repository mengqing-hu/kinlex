"""The languages words are explained in, matching the languages the website can be used in."""

# How each language is named in the prompts.
MEANING_LANGUAGES: dict[str, str] = {
    "en": "English",
    "zh": "Simplified Chinese",
    "hi": "Hindi",
    "es": "Spanish",
    "fr": "French",
    "ar": "Modern Standard Arabic",
    "bn": "Bengali",
    "ru": "Russian",
    "pt": "Portuguese",
    "ur": "Urdu",
    "id": "Indonesian",
    "de": "German",
    "ja": "Japanese",
    "vi": "Vietnamese",
    "ko": "Korean",
    "th": "Thai",
    "ms": "Malay",
}

# English comes from the vocabulary CSV; every other language is translated from it.
SOURCE_LANGUAGE = "en"


def language_name(code: str) -> str:
    try:
        return MEANING_LANGUAGES[code]
    except KeyError as error:
        known = ", ".join(MEANING_LANGUAGES)
        raise ValueError(f"unknown meaning language {code!r}; use one of {known}") from error
