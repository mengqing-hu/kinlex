"""Process a YouTube video in stages: download, captions, translations, word meanings.

The video is saved beside its study file and played from there. Its official captions are used
when it has them in the language; otherwise Whisper transcribes its speech. Words are split and
matched to the vocabulary as example sentences are (core.annotation), so a clicked word already
has its dictionary form, its entry when there is one, and its meaning in this sentence. Every
model answer is cached, so a failed run is retried by running it again.
"""

import threading
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Literal

from pydantic import Field

from config import Config, get_settings
from core.annotation import Lexicon, gloss_batches, load_spacy, request_glosses, tokenize
from core.languages import language_profile
from core.meaning_languages import language_name
from core.models import Record, TokenToGloss
from core.pipeline import PipelineError, _run_many
from services import db, example_tokens
from services.clients import LLMProvider, create_llm, create_stt, model_client
from utils.runtime import Cache, RunSummary, get_logger
from video import youtube
from video.captions import (
    CaptionLine,
    cues_from_words,
    lines_from_cues,
    official_cues,
    timed_words,
)
from video.timing import time_words
from video.transcription import cues_from_transcript, transcript
from video.translation import translate_lines

# Where the captions come from: the video's own track, YouTube's recognition of the speech, or
# a transcription of the sound with Whisper.
CaptionSource = Literal["official", "automatic", "whisper"]
Stage = Literal[
    "metadata", "download", "captions", "transcription", "translation", "meanings", "timing"
]
# Told each stage as it starts, and how much of it is done (0 to 1) where that is known.
Report = Callable[[Stage, float | None], None]


def _ignore(_stage: Stage, _done: float | None) -> None:
    pass


def _counter(total: int, stage: Stage, report: Report) -> Callable[[], None]:
    """A callback for each finished batch of a stage whose batches run in parallel."""
    done = 0
    lock = threading.Lock()

    def finished() -> None:
        nonlocal done
        with lock:
            done += 1
            report(stage, done / total)

    return finished


class NoCaptionsError(PipelineError):
    pass


class LineToken(Record):
    """A word of a sentence; start and end are character offsets in its text, end exclusive, and
    start_ms and end_ms when it is said."""

    start: int
    end: int
    surface: str
    lemma: str
    word_id: int | None = None
    gloss: str | None = None
    start_ms: int | None = None
    end_ms: int | None = None


class StudyLine(CaptionLine):
    translation: str | None = None
    tokens: list[LineToken] = Field(default_factory=list)


class StudyVideo(Record):
    video_id: str
    title: str
    duration_ms: int | None
    language: str
    meaning_language: str
    caption_source: CaptionSource
    # The official or automatic track's code (es, es-419), or the speech recognition model.
    caption_track: str
    lines: list[StudyLine]


def _annotate(
    lines: Sequence[CaptionLine],
    translations: dict[int, str],
    *,
    llm: LLMProvider,
    language: str,
    meaning_language: str,
    config: Config,
    report: Report,
) -> dict[int, list[LineToken]]:
    profile = language_profile(language)
    nlp = load_spacy(profile.spacy_model)
    with db.connect() as connection:
        entries = example_tokens.lexicon_entries(
            connection, language=language, meaning_language=meaning_language
        )
    lexicon = Lexicon(entries, profile)
    tokens = {line.position: tokenize(nlp, lexicon, line.text) for line in lines}
    pending = [
        TokenToGloss(
            example_id=line.position,
            sentence=line.text,
            translation=translations.get(line.position),
            position=token.position,
            surface=token.surface,
            lemma=token.lemma,
            word_id=token.word_id,
        )
        for line in lines
        for token in tokens[line.position]
        if token.lexicon_gloss is None
    ]
    get_logger().info("%d of the words need a meaning from the model", len(pending))
    summary = RunSummary("video_glosses", language)
    cache = Cache(language, "token_glosses")
    batches = gloss_batches(pending)
    finished = _counter(len(batches), "meanings", report)

    def gloss(batch: list[TokenToGloss]) -> tuple[dict[tuple[int, int], str], bool]:
        result = request_glosses(
            llm,
            batch,
            lexicon,
            language=language,
            meaning_language=meaning_language,
            cache=cache,
            config=config,
            summary=summary,
        )
        finished()
        return result

    results, failed = _run_many(
        batches,
        gloss,
        lambda batch: f"sentences {batch[0].example_id}-{batch[-1].example_id}",
        summary,
        config.llm_concurrency,
    )
    summary.write()
    if failed:
        raise PipelineError(f"{failed} word meaning batches failed; run again to retry them")
    glosses = {key: gloss for result in results for key, gloss in result.items()}
    return {
        position: [
            LineToken(
                start=token.start,
                end=token.end,
                surface=token.surface,
                lemma=token.lemma,
                word_id=token.word_id,
                gloss=token.lexicon_gloss or glosses.get((position, token.position)),
            )
            for token in line_tokens
        ]
        for position, line_tokens in tokens.items()
    }


def video_path(directory: Path, identifier: str) -> Path:
    return directory / f"{identifier}.mp4"


def process_video(
    config: Config,
    url: str,
    *,
    language: str,
    meaning_language: str,
    directory: Path,
    captions: CaptionSource | None = None,
    report: Report = _ignore,
    on_video: Callable[[str, int | None], None] | None = None,
) -> StudyVideo:
    """Download the video into directory, unless it is there already, and study its captions.

    captions picks where they come from; without it, the official track when there is one and
    Whisper otherwise. A source the video lacks raises NoCaptionsError.
    """
    language_profile(language)
    language_name(meaning_language)
    log = get_logger()

    identifier = youtube.video_id(url)
    report("metadata", None)
    info = youtube.read_video(identifier)
    log.info("video %s: %s%s", identifier, info.title, " (signed in)" if info.signed_in else "")
    if on_video:
        on_video(info.title, info.duration_ms)
    path = video_path(directory, identifier)
    if not path.is_file():
        log.info("downloading the video")
        report("download", 0)
        youtube.download_video(
            identifier, path, lambda done: report("download", done), signed_in=info.signed_in
        )

    with model_client(get_settings()) as client:
        llm = create_llm(client, config)
        track = youtube.pick_track(info, language)
        speech = youtube.pick_speech_track(info, language)
        source: CaptionSource = captions or ("official" if track is not None else "whisper")
        # YouTube's recognition of the speech times the words of any captions, so it is read once.
        heard = (
            timed_words(youtube.download_track(speech, signed_in=info.signed_in)) if speech else []
        )
        if source == "official":
            if track is None:
                raise NoCaptionsError(f"{identifier} has no official {language} captions")
            report("captions", None)
            log.info("captions: official track %s", track.code)
            caption_track = track.code
            data = youtube.download_track(track, signed_in=info.signed_in)
            lines = lines_from_cues(official_cues(data))
        elif source == "automatic":
            if speech is None:
                raise NoCaptionsError(f"{identifier} has no automatic {language} captions")
            report("captions", None)
            log.info("captions: YouTube's automatic track %s", speech.code)
            caption_track = speech.code
            lines = lines_from_cues(cues_from_words(heard))
        else:
            stt = create_stt(client, config)
            log.info("transcribing the %s speech with %s", language, stt.model)
            caption_track = stt.model
            report("transcription", 0)
            result = transcript(
                path,
                stt=stt,
                language=language,
                cache=Cache(language, "transcription"),
                on_progress=lambda done: report("transcription", done),
            )
            lines = lines_from_cues(cues_from_transcript(result))
        if not lines:
            raise NoCaptionsError(f"no {language} speech found in {identifier}")
        log.info("%d sentences", len(lines))

        translations: dict[int, str] = {}
        if meaning_language != language:
            summary = RunSummary("video_translation", language)
            report("translation", 0)
            translations = translate_lines(
                lines,
                llm=llm,
                language=language,
                meaning_language=meaning_language,
                cache=Cache(language, "caption_translation"),
                config=config,
                summary=summary,
                on_progress=lambda done: report("translation", done),
            )
            summary.write()

        report("meanings", 0)
        tokens = _annotate(
            lines,
            translations,
            llm=llm,
            language=language,
            meaning_language=meaning_language,
            config=config,
            report=report,
        )

    report("timing", None)
    log.info("timing words with %d words YouTube heard", len(heard))
    lines, word_times = time_words(
        lines, [[token.surface for token in tokens[line.position]] for line in lines], heard
    )
    for line, times in zip(lines, word_times, strict=True):
        tokens[line.position] = [
            token.model_copy(update={"start_ms": start, "end_ms": end})
            for token, (start, end) in zip(tokens[line.position], times, strict=True)
        ]

    return StudyVideo(
        video_id=identifier,
        title=info.title,
        duration_ms=info.duration_ms,
        language=language,
        meaning_language=meaning_language,
        caption_source=source,
        caption_track=caption_track,
        lines=[
            StudyLine(
                **line.model_dump(),
                translation=translations.get(line.position),
                tokens=tokens[line.position],
            )
            for line in lines
        ],
    )
