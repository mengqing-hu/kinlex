"""Translate the English meanings into another language a learner can use the site in.

The vocabulary CSV gives each word and example sentence its English meaning; this asks the
language model for the same meanings in the target language, in batches: word meanings, example
sentence translations, and word part meanings. Each part only asks for what the target language is
still missing (or, for word parts, what changed in English since), so a failed batch is retried by
running the command again. Translate before annotating a language, whose hover meanings start from
the translated word meanings and sentences.
"""

import json
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from pydantic import BaseModel

from config import Config, get_settings
from core.meaning_languages import SOURCE_LANGUAGE, language_name
from core.models import (
    MeaningTranslation,
    MorphemeToTranslate,
    SentenceToTranslate,
    TranslatedTextReply,
    WordMeaningsReply,
    WordToTranslate,
)
from core.pipeline import TaskResult, ValidationError, _generate_json, _run_many
from services import db, translations
from services.clients import LLMProvider, create_llm, model_client
from utils.runtime import Cache, RunSummary, get_logger, read_prompt, setup_logging

WORDS_PROMPT = "word_meanings_translation_v1"
SENTENCES_PROMPT = "sentence_translation_v1"
MORPHEMES_PROMPT = "morpheme_meanings_translation_v1"
WORDS_PER_CALL = 40
SENTENCES_PER_CALL = 25
MORPHEMES_PER_CALL = 50
MAX_MEANING_LENGTH = 200
MAX_SENTENCE_LENGTH = 400


@dataclass(frozen=True)
class TranslationResult:
    words: TaskResult
    sentences: TaskResult
    morphemes: TaskResult

    @property
    def failed(self) -> int:
        return self.words.failed + self.sentences.failed + self.morphemes.failed


def _batches[T](items: Sequence[T], size: int) -> list[list[T]]:
    return [list(items[start : start + size]) for start in range(0, len(items), size)]


def _check_text(text: str, item_id: int, max_length: int) -> None:
    if not text.strip() or len(text) > max_length or "\n" in text.strip():
        raise ValidationError(f"bad translation for {item_id}")


def _validate_words(reply: WordMeaningsReply, batch: Sequence[WordToTranslate]) -> None:
    answered = {item.id: item.meanings for item in reply.words}
    for word in batch:
        meanings = answered.get(word.id)
        if meanings is None or len(meanings) != len(word.meanings):
            raise ValidationError(f"word {word.id} needs {len(word.meanings)} meanings")
        for meaning in meanings:
            _check_text(meaning, word.id, MAX_MEANING_LENGTH)


def _validate_texts(reply: TranslatedTextReply, ids: Sequence[int], max_length: int) -> None:
    answered = {item.id: item.text for item in reply.items}
    for item_id in ids:
        if item_id not in answered:
            raise ValidationError(f"no translation for {item_id}")
        _check_text(answered[item_id], item_id, max_length)


def _run_part[T, R: BaseModel](
    *,
    name: str,
    items: Sequence[T],
    size: int,
    prompt: str,
    request: Callable[[Sequence[T]], dict[str, str]],
    schema: type[R],
    validate: Callable[[R, Sequence[T]], None],
    save: Callable[[R, Sequence[T]], None],
    label: Callable[[Sequence[T]], str],
    llm: LLMProvider,
    meaning_language: str,
    language: str,
    config: Config,
) -> TaskResult:
    get_logger().info("%d %s to translate into %s", len(items), name, meaning_language)
    if not items:
        return TaskResult(processed=0, failed=0)
    summary = RunSummary(f"translate_{name}", language)
    template = read_prompt(prompt)
    cache = Cache(language, f"translate_{name}")
    model = config.providers.llm.model

    def translate_batch(batch: list[T]) -> tuple[int, bool]:
        reply, cached = _generate_json(
            llm=llm,
            cache=cache,
            word=f"{name} {label(batch)}",
            model=model,
            prompt=template.substitute(language=language_name(meaning_language), **request(batch)),
            schema=schema,
            validate=lambda value: validate(value, batch),
            config=config,
            summary=summary,
        )
        save(reply, batch)
        return len(batch), cached

    batches = _batches(items, size)
    _results, failed = _run_many(
        batches,
        translate_batch,
        lambda batch: f"{name} {label(batch)}",
        summary,
        config.llm_concurrency,
    )
    summary.write()
    return TaskResult(processed=len(batches) - failed, failed=failed)


def _dump(items: object) -> str:
    return json.dumps(items, ensure_ascii=False, indent=1)


def translate_meanings(
    config: Config,
    *,
    language: str,
    meaning_language: str,
    limit: int | None,
    force: bool,
) -> TranslationResult:
    if meaning_language == SOURCE_LANGUAGE:
        raise ValueError(f"{SOURCE_LANGUAGE} meanings come from the vocabulary CSV")
    language_name(meaning_language)
    setup_logging("translate", language)
    with db.connect() as connection:
        words = translations.words_to_translate(
            connection,
            language=language,
            meaning_language=meaning_language,
            force=force,
            limit=limit,
        )
        sentences = translations.sentences_to_translate(
            connection,
            language=language,
            meaning_language=meaning_language,
            force=force,
            limit=limit,
        )
        morphemes = translations.morphemes_to_translate(
            connection,
            language=language,
            meaning_language=meaning_language,
            force=force,
            limit=limit,
        )

    def save_words(reply: WordMeaningsReply, batch: Sequence[WordToTranslate]) -> None:
        answered = {item.id: item.meanings for item in reply.words}
        with db.connect() as connection, connection.transaction():
            translations.replace_word_meanings(
                connection,
                meaning_language=meaning_language,
                translations=[
                    MeaningTranslation(id=word.id, meanings=[m.strip() for m in answered[word.id]])
                    for word in batch
                ],
            )

    def save_sentences(reply: TranslatedTextReply, batch: Sequence[SentenceToTranslate]) -> None:
        answered = {item.id: item.text.strip() for item in reply.items}
        with db.connect() as connection, connection.transaction():
            translations.upsert_sentence_translations(
                connection,
                meaning_language=meaning_language,
                translations={sentence.id: answered[sentence.id] for sentence in batch},
            )

    def save_morphemes(reply: TranslatedTextReply, batch: Sequence[MorphemeToTranslate]) -> None:
        answered = {item.id: item.text.strip() for item in reply.items}
        with db.connect() as connection, connection.transaction():
            translations.upsert_morpheme_meanings(
                connection,
                meaning_language=meaning_language,
                morphemes=batch,
                translations=answered,
            )

    with model_client(get_settings()) as client:
        llm = create_llm(client, config)
        words_result = _run_part(
            name="words",
            items=words,
            size=WORDS_PER_CALL,
            prompt=WORDS_PROMPT,
            request=lambda batch: {
                "words": _dump(
                    [
                        {
                            "id": word.id,
                            "word": word.word,
                            "word_class": word.word_class,
                            "english_meanings": word.meanings,
                            "example": word.example_sentence or "not provided",
                        }
                        for word in batch
                    ]
                )
            },
            schema=WordMeaningsReply,
            validate=_validate_words,
            save=save_words,
            label=lambda batch: f"{batch[0].id}..{batch[-1].id}",
            llm=llm,
            meaning_language=meaning_language,
            language=language,
            config=config,
        )
        sentences_result = _run_part(
            name="sentences",
            items=sentences,
            size=SENTENCES_PER_CALL,
            prompt=SENTENCES_PROMPT,
            request=lambda batch: {
                "sentences": _dump(
                    [
                        {"id": item.id, "sentence": item.sentence, "english": item.translation}
                        for item in batch
                    ]
                )
            },
            schema=TranslatedTextReply,
            validate=lambda reply, batch: _validate_texts(
                reply, [item.id for item in batch], MAX_SENTENCE_LENGTH
            ),
            save=save_sentences,
            label=lambda batch: f"{batch[0].id}..{batch[-1].id}",
            llm=llm,
            meaning_language=meaning_language,
            language=language,
            config=config,
        )
        morphemes_result = _run_part(
            name="morphemes",
            items=morphemes,
            size=MORPHEMES_PER_CALL,
            prompt=MORPHEMES_PROMPT,
            request=lambda batch: {
                "morphemes": _dump(
                    [
                        {
                            "id": item.id,
                            "word_part": item.morpheme,
                            "type": item.morpheme_type,
                            "english_meaning": item.meaning,
                            "example_words": item.words,
                        }
                        for item in batch
                    ]
                )
            },
            schema=TranslatedTextReply,
            validate=lambda reply, batch: _validate_texts(
                reply, [item.id for item in batch], MAX_MEANING_LENGTH
            ),
            save=save_morphemes,
            label=lambda batch: f"{batch[0].id}..{batch[-1].id}",
            llm=llm,
            meaning_language=meaning_language,
            language=language,
            config=config,
        )
    return TranslationResult(
        words=words_result, sentences=sentences_result, morphemes=morphemes_result
    )
