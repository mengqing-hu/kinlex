"""The two content-generation workflows."""

import json
import re
import time
from collections import Counter
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import cache
from pathlib import Path

import pydantic
from pydantic import BaseModel

from config import Config, SettingsError, get_settings
from core.consistency import (
    ConsistencyResult,
    RootChange,
    make_roots_consistent,
    spelling_key,
    split_lead,
)
from core.languages import gender_from_label, language_profile
from core.meaning_languages import language_name
from core.models import AudioResult, AudioTarget, Segment, Word, WordEnrichment
from core.verb_stems import use_verb_stems, verb_infinitives
from services import db
from services.clients import (
    LLMProvider,
    ProviderError,
    Voice,
    create_fallback_tts,
    create_llm,
    create_tts,
    model_client,
)
from services.storage import AudioStorage
from utils.affixes import (
    AffixMeanings,
    EntryForms,
    affix_key,
    apply_affix_meanings,
    homograph_key,
    homograph_keys,
    load_affix_forms,
    load_affix_meanings,
    normalize_segment_types,
)
from utils.review_export import export_review_files
from utils.roots import (
    apply_root_override,
    load_etymological_forms,
    load_etymological_roots,
    load_numbered_roots,
    load_root_meanings,
    load_root_overrides,
)
from utils.runtime import (
    Cache,
    RunSummary,
    cache_key,
    get_logger,
    log_model_call,
    read_prompt,
    setup_logging,
)
from utils.vocabulary import read_vocabulary

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)
_ARTICLE = re.compile(r"^(?:der|die|das) (?=\S)")
_REFLEXIVE = re.compile(r"^sich (?=\S)")


class PipelineError(RuntimeError):
    pass


class ValidationError(ValueError):
    pass


@dataclass(frozen=True)
class TaskResult:
    processed: int
    failed: int


def validate_segments(word: str, segments: list[Segment]) -> None:
    if not segments:
        raise ValidationError("no segments")
    joined = "".join(segment.word_part for segment in segments)
    if spelling_key(joined) != spelling_key(word):
        raise ValidationError(f"segments do not spell {word!r}")
    for segment in segments:
        if segment.morpheme_type is None:
            if segment.morpheme is not None or segment.morpheme_meaning is not None:
                raise ValidationError(f"untyped segment {segment.word_part!r} has metadata")
            continue
        if not segment.morpheme or not segment.morpheme_meaning:
            raise ValidationError(f"segment {segment.word_part!r} has incomplete metadata")
        if segment.morpheme_type == "prefix" and not (
            segment.morpheme.endswith("-") and not segment.morpheme.startswith("-")
        ):
            raise ValidationError("prefix text must end with '-' and not start with it")
        if segment.morpheme_type == "suffix" and not (
            segment.morpheme.startswith("-") and not segment.morpheme.endswith("-")
        ):
            raise ValidationError("suffix text must start with '-' and not end with it")
    if len(segments) > 1 and all(segment.morpheme_type is None for segment in segments):
        raise ValidationError("an unsplit word must be one segment")


def validate_lexicon_forms(
    segments: list[Segment], meanings: AffixMeanings, owners: dict[tuple[str, str], list[str]]
) -> None:
    """Reject a part the lexicon cannot place, so the model is asked again: a homograph without
    its number (a- for a1- or a2-), or a spelling several entries share (im- is in1- and in2-)."""
    homographs = homograph_keys(meanings)
    for segment in segments:
        if segment.morpheme_type is None or segment.morpheme is None:
            continue
        if (segment.morpheme_type, segment.morpheme) in meanings:
            continue
        key = homograph_key(segment.morpheme_type, segment.morpheme)
        if (segment.morpheme_type, key) in homographs:
            raise ValidationError(f"{segment.morpheme!r} needs its homograph number")
        if len(owners.get((segment.morpheme_type, segment.morpheme), [])) > 1:
            raise ValidationError(f"{segment.morpheme!r} is spelled by several entries; name one")


def _spells(part: str, form: str, *, more_follow: bool) -> bool:
    """Whether a part is written with this spelling of an affix. Only a final vowel may drop
    before another part (cercanías has "an" for -ano), and a final -o may be -a (característica
    has -ístico)."""
    letters = spelling_key(affix_key(form))
    part = spelling_key(part.strip())
    dropped_vowel = letters[-1:] in ("a", "e", "i", "o", "u") and part == letters[:-1]
    feminine = letters.endswith("o") and part == letters[:-1] + "a"
    return part == letters or (dropped_vowel and more_follow) or feminine


def validate_affix_spelling(segments: list[Segment], forms: EntryForms) -> None:
    """A Spanish or Portuguese affix part is written with one of its entry's spellings: "ante"
    for -ante, never "iante"; "im" for in2-, whose spellings are in-, im-, i- and ir-."""
    for index, segment in enumerate(segments):
        if segment.morpheme_type in (None, "root") or segment.morpheme is None:
            continue
        spellings = forms.get((segment.morpheme_type, segment.morpheme), (segment.morpheme,))
        more_follow = index + 1 < len(segments)
        if not any(_spells(segment.word_part, form, more_follow=more_follow) for form in spellings):
            raise ValidationError(f"{segment.word_part!r} is not spelled like {segment.morpheme!r}")


_VOWELS = frozenset("aeiouáéíóúâêôãõà")


def tidy_segments(segments: list[Segment], language: str) -> list[Segment]:
    """Settle the stem layouts the model writes either way before they are checked.

    A part named by one of its spellings takes its entry's name, when only one entry has that
    spelling: dia- is di-. A spelling that numbered modern stems also take is left as written, so
    it is rejected for its missing number: cas- may be cas1- (house), not cad- (fall), whose
    spellings include cas-. A linking vowel the model kept on a suffix becomes its own null part, so
    the suffix is spelled as listed: "ación" for -ción is "a" + "ción". An entry made only of
    function words (desde que) is one null part.
    """
    if not language_profile(language).stems:
        return segments
    if len(segments) > 1 and all(segment.morpheme_type is None for segment in segments):
        return [Segment(word_part="".join(segment.word_part for segment in segments))]
    forms = lexicon_forms(language)
    owners = spelling_owners(language)
    numbered = homograph_keys(lexicon_meanings(language))
    tidied: list[Segment] = []
    for segment in segments:
        morpheme_type, morpheme = segment.morpheme_type, segment.morpheme
        if morpheme_type is None or morpheme is None:
            tidied.append(segment)
            continue
        names = owners.get((morpheme_type, morpheme), [])
        if (
            (morpheme_type, morpheme) not in forms
            and len(names) == 1
            and (morpheme_type, homograph_key(morpheme_type, morpheme)) not in numbered
        ):
            morpheme = names[0]
            segment = segment.model_copy(update={"morpheme": morpheme})
        part = segment.word_part
        spellings = forms.get((morpheme_type, morpheme), (morpheme,))
        if (
            morpheme_type == "suffix"
            and len(part) > 1
            and part[0].lower() in _VOWELS
            and any(spelling_key(part[1:]) == spelling_key(affix_key(form)) for form in spellings)
        ):
            tidied.append(Segment(word_part=part[0]))
            segment = segment.model_copy(update={"word_part": part[1:]})
        tidied.append(segment)
    return tidied


def validate_enrichment(
    stem: str, segments: list[Segment], meanings: AffixMeanings, *, language: str
) -> None:
    segments = tidy_segments(segments, language)
    validate_segments(stem, segments)
    validate_lexicon_forms(segments, meanings, spelling_owners(language))
    if language_profile(language).stems:
        validate_affix_spelling(segments, lexicon_forms(language))


def split_article(word: Word) -> tuple[str, str]:
    """Split 'das Brot' into ('das ', 'Brot') and 'sich freuen' into ('sich ', 'freuen')."""
    pattern = {"noun": _ARTICLE, "verb": _REFLEXIVE}.get(word.word_class)
    match = pattern.match(word.word) if pattern else None
    if match is None:
        return "", word.word
    return match.group(0), word.word[match.end() :]


def restore_spelling(stem: str, segments: list[Segment]) -> list[Segment]:
    """Take each part's letters from the entry itself; the model may capitalize inner parts."""
    restored, start = [], 0
    for segment in segments:
        end = start + len(segment.word_part)
        restored.append(segment.model_copy(update={"word_part": stem[start:end]}))
        start = end
    return restored


def postprocess_stem(
    word: Word,
    stem: str,
    segments: list[Segment],
    *,
    affixes: AffixMeanings,
    overrides: dict[str, list[Segment]],
) -> list[Segment]:
    """Apply the curated lexicon to a stem's parts: hand-checked fixes, types, affix meanings."""
    segments = apply_root_override(word.word, stem, segments, overrides)
    return apply_affix_meanings(
        normalize_segment_types(segments, affixes, word_class=word.word_class), affixes
    )


def apply_source_metadata(
    enrichment: WordEnrichment, *, lead: str, word_class: str, label: str, language: str
) -> WordEnrichment:
    """Set what the CSV already states instead of trusting the model with it.

    A German entry's article gives a noun's gender ("Nomen (Pl.)" entries have none). Spanish
    entries have no article, so a noun keeps the gender and article the model gave. A Portuguese
    label states the gender ("substantivo f."), which settles the article. Other word classes have
    neither. "Verb (trennbar)" marks a separable verb: its first part, when that part is a prefix,
    separates; every other verb prefix does not (vorbereiten: vor- separable, be- not).
    """
    gender: str | None = enrichment.gender
    article: str | None = enrichment.article
    if word_class != "noun":
        gender, article = None, None
    elif lead:
        gender, article = (None if "Pl." in label else lead.strip()), None
    elif language_profile(language).gender_source == "label":
        gender, article = gender_from_label(label) or (None, None)
    segments = list(enrichment.segments)
    separable = "trennbar" in label
    first_typed = next((i for i, s in enumerate(segments) if s.morpheme_type is not None), None)
    for index, segment in enumerate(segments):
        value = None
        if word_class == "verb" and segment.morpheme_type == "prefix":
            value = separable and index == first_typed
        segments[index] = segment.model_copy(update={"is_separable": value})
    if lead:
        # The model segments only the stem; the article or "sich" is stored as an untyped part
        # so the segments still spell the full entry.
        segments.insert(0, Segment(word_part=lead))
    return enrichment.model_copy(
        update={"gender": gender, "article": article, "segments": segments}
    )


def lexicon_meanings(language: str) -> AffixMeanings:
    """The curated meanings: affixes, plus the Latin and Greek roots, the numbered modern roots
    and the hand-checked meanings of other modern roots where a language lists them."""
    return (
        load_affix_meanings(language)
        | load_etymological_roots(language)
        | load_numbered_roots(language)
        | load_root_meanings(language)
    )


@cache
def lexicon_forms(language: str) -> EntryForms:
    """The spellings of every listed affix and Latin or Greek root, by entry."""
    return load_affix_forms(language) | load_etymological_forms(language)


@cache
def spelling_owners(language: str) -> dict[tuple[str, str], list[str]]:
    """The entries that list each spelling: ("prefix", "im-") is in1- and in2-."""
    owners: dict[tuple[str, str], list[str]] = {}
    for (morpheme_type, name), spellings in lexicon_forms(language).items():
        for form in spellings:
            owners.setdefault((morpheme_type, form), []).append(name)
    return owners


def _lexicon_table(meanings: AffixMeanings, forms: EntryForms, kind: str) -> str:
    """One entry a line: its name, the other spellings it takes, and its meaning."""
    lines = []
    for (type_, name), meaning in meanings.items():
        if type_ != kind:
            continue
        others = [form for form in forms.get((type_, name), (name,)) if form != name]
        spelled = f" (also {', '.join(others)})" if others else ""
        lines.append(f"{name}{spelled}: {meaning}")
    return "\n".join(lines)


def _extract_json(text: str) -> object:
    body = _FENCE.sub("", text.strip())
    start, end = body.find("{"), body.rfind("}")
    if start == -1 or end < start:
        raise ValueError("no JSON object in response")
    return json.loads(body[start : end + 1])


def _generate_json[T: BaseModel](
    *,
    llm: LLMProvider,
    cache: Cache,
    word: str,
    model: str,
    prompt: str,
    schema: type[T],
    validate: Callable[[T], None],
    config: Config,
    summary: RunSummary,
    # translate, topics and annotate still work on German only and use this default.
    system: str = "You are a careful German dictionary editor. Reply with JSON only.",
) -> tuple[T, bool]:
    key = cache_key("database_fields", model, prompt)
    cached = cache.get(key, schema)
    if cached is not None:
        # A check added since the answer was cached may reject it; then the model is asked again.
        try:
            validate(cached)
        except ValueError:
            cached = None
    if cached is not None:
        log_model_call(word, model, cached=True, valid=True)
        return cached, True
    last_error: Exception | None = None
    for _attempt in range(config.retries):
        started = time.monotonic()
        text = llm.complete(model, system, prompt)
        summary.add_model_calls(1)
        try:
            value = schema.model_validate(_extract_json(text))
            validate(value)
        except (ValueError, pydantic.ValidationError) as error:
            last_error = error
            log_model_call(
                word, model, cached=False, valid=False, seconds=time.monotonic() - started
            )
            continue
        log_model_call(word, model, cached=False, valid=True, seconds=time.monotonic() - started)
        cache.set(key, value)
        return value, False
    raise PipelineError(f"{model} returned no valid output: {last_error}")


def _run_many[T, R](
    items: Sequence[T],
    work: Callable[[T], tuple[R, bool]],
    key: Callable[[T], str],
    summary: RunSummary,
    concurrency: int,
) -> tuple[list[R], int]:
    def attempt(item: T) -> R | None:
        try:
            result, cached = work(item)
            summary.record("cached" if cached else "succeeded")
            return result
        except Exception as error:
            get_logger().warning("failed %s: %s", key(item), error)
            summary.record("failed")
            return None

    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
        results = list(pool.map(attempt, items))
    return [result for result in results if result is not None], sum(
        result is None for result in results
    )


def generate_database_fields(
    config: Config,
    *,
    language: str,
    offset: int,
    limit: int | None,
    force: bool,
    input_path: Path,
) -> TaskResult:
    setup_logging("database_fields", language)
    summary = RunSummary("database_fields", language)
    items = read_vocabulary(input_path, language=language, offset=offset, limit=limit)
    labels = {(item.word, item.word_class): item.word_class_label for item in items}
    affixes = lexicon_meanings(language)
    overrides = load_root_overrides(language)
    with db.connect() as connection:
        with connection.transaction():
            selected_words = db.import_vocabulary(connection, items)
            db.sync_affix_meanings(connection, language=language, meanings=affixes)
        words = db.words_for_enrichment(
            connection,
            language=language,
            limit=limit,
            force=force,
            word_ids=[word.id for word in selected_words],
        )
    if not words:
        summary.write()
        return TaskResult(0, 0)
    prompt_name = language_profile(language).prompt
    prompt = read_prompt(prompt_name)
    system = f"You are a careful {language_name(language)} dictionary editor. Reply with JSON only."
    tables = {
        "prefixes": _lexicon_table(affixes, lexicon_forms(language), "prefix"),
        "suffixes": _lexicon_table(affixes, lexicon_forms(language), "suffix"),
        "etymological_roots": _lexicon_table(
            load_etymological_roots(language), lexicon_forms(language), "root"
        ),
        "numbered_roots": _lexicon_table(load_numbered_roots(language), {}, "root"),
    }
    cache = Cache(language, "database_fields")
    with model_client(get_settings()) as client:
        llm = create_llm(client, config)

        def work(word: Word) -> tuple[Word, bool]:
            lead, stem = split_article(word)
            label = labels.get((word.word, word.word_class), word.word_class)
            enrichment, cached = _generate_json(
                llm=llm,
                cache=cache,
                word=word.word,
                model=config.providers.llm.model,
                system=system,
                prompt=prompt.substitute(
                    tables,
                    word=word.word,
                    stem=stem,
                    word_class=label,
                    word_meaning=word.word_meaning or "not provided",
                    example_sentence=word.example_sentence or "not provided",
                    sentence_meaning=word.sentence_meaning or "not provided",
                ),
                schema=WordEnrichment,
                validate=lambda value: validate_enrichment(
                    stem, value.segments, affixes, language=language
                ),
                config=config,
                summary=summary,
            )
            enrichment = enrichment.model_copy(
                update={
                    "segments": postprocess_stem(
                        word,
                        stem,
                        restore_spelling(stem, tidy_segments(enrichment.segments, language)),
                        affixes=affixes,
                        overrides=overrides,
                    )
                }
            )
            enrichment = apply_source_metadata(
                enrichment, lead=lead, word_class=word.word_class, label=label, language=language
            )
            with db.connect() as connection, connection.transaction():
                db.replace_word_enrichment(
                    connection,
                    word=word,
                    enrichment=enrichment,
                    model=config.providers.llm.model,
                    prompt=prompt_name,
                )
            return word, cached

        _, failed = _run_many(
            words,
            work,
            lambda word: word.word,
            summary,
            config.llm_concurrency,
        )
    summary.write()
    return TaskResult(len(words) - failed, failed)


def apply_root_consistency(*, language: str, dry_run: bool = False) -> ConsistencyResult:
    """Bring every stored segmentation in line with the current lexicon and with each other.

    It reapplies postprocess_stem to what is already saved, so lexicon edits reach earlier
    batches without calling the model, names verb roots by their stem, and then expands roots
    that name other segmented words.
    It runs over the whole vocabulary because a later batch can segment a word that an earlier
    batch used as a root (Bahnhof inside Hauptbahnhof).
    """
    affixes = lexicon_meanings(language)
    overrides = load_root_overrides(language)
    stems = language_profile(language).stems
    with db.connect() as connection, connection.transaction():
        stored = db.segmented_words(connection, language=language)
        verbs = verb_infinitives([word for word, _segments in stored])
        updated = []
        for word, segments in stored:
            lead, body = split_lead(segments)
            stem = "".join(segment.word_part for segment in body)
            body = postprocess_stem(
                word, stem, tidy_segments(body, language), affixes=affixes, overrides=overrides
            )
            # German verb roots are named by the infinitive and renamed to the stem here; Spanish
            # and Portuguese stems come from the model already.
            if not stems:
                body = use_verb_stems(word, body, verbs)
            updated.append((word, lead + body))
        result = make_roots_consistent(updated)
        # Report every word that differs from what is stored, whichever step changed it.
        final = {change.word.id: change.after for change in result.changes}
        result = ConsistencyResult(
            [
                RootChange(word, before, final.get(word.id, after))
                for (word, before), (_word, after) in zip(stored, updated, strict=True)
                if final.get(word.id, after) != before
            ],
            result.unresolved,
        )
        if not dry_run:
            for change in result.changes:
                db.replace_word_segments(connection, word=change.word, segments=change.after)
            db.sync_affix_meanings(connection, language=language, meanings=affixes)
            db.update_morpheme_spellings(
                connection,
                shown_spellings(db.morpheme_parts(connection, language=language), language),
            )
    return result


def _numbered(spelling: str, number: str) -> str:
    """Put an entry's number into a spelling the way entries are named: in2-, -al1, cerc1-."""
    if spelling.endswith("-"):
        return f"{spelling[:-1]}{number}-"
    return f"{spelling}{number}"


def shown_spellings(
    parts: dict[tuple[int, str, str], list[str]], language: str
) -> dict[int, list[str]]:
    """The spellings the site shows for each used morpheme, most used first.

    A listed entry shows the spellings its words use: in2- is in- (im-, i-) when no word has ir-.
    Any other morpheme shows its name. Morphemes of one type that would show the same first
    spelling are numbered in the order of their names, as in1- and in2- both show in-; a number
    on a spelling no other morpheme shows would tell a reader nothing, so it is left out.
    """
    forms = lexicon_forms(language)
    shown: dict[int, list[str]] = {}
    names: dict[int, str] = {}
    firsts: dict[tuple[str, str], list[int]] = {}
    for (morpheme_id, morpheme_type, name), word_parts in parts.items():
        spellings = forms.get((morpheme_type, name), ())
        counts: Counter[str] = Counter()
        for part in word_parts:
            form = next((f for f in spellings if _spells(part, f, more_follow=True)), None)
            if form is not None:
                counts[form] += 1
        used = sorted(counts, key=lambda form: (-counts[form], spellings.index(form)))
        shown[morpheme_id] = used or [re.sub(r"\d", "", name)]
        names[morpheme_id] = name
        firsts.setdefault((morpheme_type, shown[morpheme_id][0]), []).append(morpheme_id)
    for ids in firsts.values():
        if len(ids) < 2:
            continue
        for number, morpheme_id in enumerate(sorted(ids, key=names.__getitem__), start=1):
            first, *rest = shown[morpheme_id]
            shown[morpheme_id] = [_numbered(first, str(number)), *rest]
    return shown


def generate_tts_audio(
    config: Config,
    *,
    language: str,
    offset: int,
    limit: int | None,
    force: bool,
    input_path: Path | None = None,
) -> TaskResult:
    setup_logging("tts_audio", language)
    accent = language_profile(language).accent
    summary = RunSummary("tts_audio", language)
    with db.connect() as connection:
        selected_word_ids: list[int] | None = None
        if input_path is not None:
            with connection.transaction():
                selected_words = db.import_vocabulary(
                    connection,
                    read_vocabulary(
                        input_path,
                        language=language,
                        offset=offset,
                        limit=limit,
                    ),
                )
            selected_word_ids = [word.id for word in selected_words]
        targets = db.audio_targets_for_words(
            connection,
            language=language,
            accent=accent,
            limit=limit,
            force=force,
            word_ids=selected_word_ids,
        )
    if not targets:
        summary.write()
        return TaskResult(0, 0)
    voice_name = config.providers.tts.voices.get(language, "")
    if not voice_name or voice_name.startswith("<"):
        raise SettingsError(f"Set providers.tts.voices.{language} in config.yaml")
    storage = AudioStorage(get_settings())
    with model_client(get_settings()) as client:
        providers = [
            (
                create_tts(client, config),
                Voice(voice_name, config.providers.tts.instructions.get(language)),
            )
        ]
        fallback = create_fallback_tts(client, config)
        if fallback is not None and config.providers.tts.fallback_voice:
            providers.append((fallback, Voice(config.providers.tts.fallback_voice)))

        def work(target: AudioTarget) -> tuple[AudioResult, bool]:
            last_error: ProviderError | None = None
            for tts, voice in providers:
                try:
                    content = tts.synthesize(target.text, voice)
                    if not content:
                        raise ProviderError("TTS returned empty audio")
                except ProviderError as error:
                    last_error = error
                    continue
                result = AudioResult(
                    owner_type=target.owner_type,
                    owner_id=target.owner_id,
                    path=storage.upload(content, language, target.owner_type),
                    voice=voice.label,
                    model=tts.model,
                )
                with db.connect() as connection, connection.transaction():
                    db.upsert_audio(connection, result=result, accent=accent)
                return result, False
            raise last_error or ProviderError("no TTS provider configured")

        _, failed = _run_many(
            targets,
            work,
            lambda target: target.text,
            summary,
            config.tts_concurrency,
        )
    summary.write()
    return TaskResult(len(targets) - failed, failed)


def import_vocabulary(
    *,
    language: str,
    input_path: Path,
    offset: int = 0,
    limit: int | None = None,
) -> int:
    """Import CSV rows as draft words and examples without calling any model."""
    items = read_vocabulary(input_path, language=language, offset=offset, limit=limit)
    with db.connect() as connection, connection.transaction():
        return len(db.import_vocabulary(connection, items))


def publish_vocabulary(
    *,
    language: str,
    input_path: Path,
    offset: int = 0,
    limit: int | None = None,
) -> tuple[int, int]:
    """Publish an imported CSV batch so the public frontend can read it."""
    items = read_vocabulary(input_path, language=language, offset=offset, limit=limit)
    with db.connect() as connection, connection.transaction():
        return db.publish_vocabulary(connection, items=items)


def export_review_data(
    *,
    language: str,
    input_path: Path,
    output_dir: Path,
    offset: int = 0,
    limit: int | None = None,
    file_stem: str | None = None,
) -> tuple[Path, Path]:
    items = read_vocabulary(input_path, language=language, offset=offset, limit=limit)
    with db.connect() as connection:
        metadata = db.review_metadata(connection, language=language)
    return export_review_files(
        items=items,
        metadata=metadata,
        output_dir=output_dir,
        source_name=input_path.stem,
        file_stem=file_stem,
    )
