"""Sort vocabulary entries into topics, for the website's topic filter and topic pages.

The language model gives each word zero, one or two of a fixed list of topics, in batches of
words. A word with no topic is still marked as sorted, so a rerun only asks about words that are
new or were sorted with an older prompt. A dry run asks the model (and caches the replies) but
writes nothing, and its report shows whether the topic list fits the vocabulary.
"""

import json
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from config import Config, get_settings
from core.models import WordForTopics, WordTopics, WordTopicsReply
from core.pipeline import ValidationError, _generate_json, _run_many
from services import db, word_topics
from services.clients import LLMProvider, create_llm, model_client
from utils.runtime import Cache, RunSummary, get_logger, read_prompt, setup_logging

PROMPT = "word_topics_v2"
MEANING_LANGUAGE = "en"
WORDS_PER_CALL = 40
MAX_TOPICS = 2
# Whether a word gets a topic is often a close call; without sampling, a rerun decides it the same
# way, so a change to the prompt shows in the results instead of drowning in chance.
TEMPERATURE = 0.0
SAMPLE_SIZE = 60

# The topic ids the prompt lists, with the names the website shows.
TOPICS: dict[str, str] = {
    "people": "People & family",
    "health": "Body & health",
    "food": "Food & drink",
    "housing": "Housing",
    "clothing": "Clothing",
    "shopping": "Shopping & money",
    "work": "Work",
    "education": "Education",
    "travel": "Travel & transport",
    "places": "City & places",
    "nature": "Nature, weather & wildlife",
    "time": "Time & dates",
    "leisure": "Leisure & sport",
    "media": "Media & technology",
    "communication": "Communication",
    "feelings": "Feelings & character",
    "society": "Society & authorities",
    "numbers": "Numbers, colours & measures",
    "law": "Law & politics",
    "economy": "Economy & business",
    "science": "Science & research",
    "environment": "Environment",
    "culture": "Culture & arts",
    "history": "History & religion",
    "concepts": "Ideas & concepts",
}


class _FixedTemperature:
    def __init__(self, llm: LLMProvider, temperature: float) -> None:
        self.llm = llm
        self.temperature = temperature

    def complete(
        self, model: str, system: str, prompt: str, temperature: float | None = None
    ) -> str:
        return self.llm.complete(model, system, prompt, self.temperature)


@dataclass(frozen=True)
class TopicsResult:
    sorted: int
    failed: int
    report: Path


def _request(batch: Sequence[WordForTopics]) -> str:
    return json.dumps(
        [
            {
                "id": word.id,
                "word": word.word,
                "word_class": word.word_class,
                "meaning": word.meaning or "not provided",
                "example": word.example_sentence or "not provided",
            }
            for word in batch
        ],
        ensure_ascii=False,
        indent=1,
    )


def _validate_reply(reply: WordTopicsReply, batch: Sequence[WordForTopics]) -> None:
    expected = sorted(word.id for word in batch)
    answered = sorted(item.id for item in reply.words)
    if answered != expected:
        raise ValidationError("the reply must list every word of the batch exactly once")
    for item in reply.words:
        if len(item.topics) > MAX_TOPICS or len(set(item.topics)) != len(item.topics):
            raise ValidationError(f"word {item.id} needs at most {MAX_TOPICS} distinct topics")
        unknown = [topic for topic in item.topics if topic not in TOPICS]
        if unknown:
            raise ValidationError(f"word {item.id} has unknown topics {unknown}")


def _batches(words: Sequence[WordForTopics]) -> list[list[WordForTopics]]:
    return [
        list(words[start : start + WORDS_PER_CALL])
        for start in range(0, len(words), WORDS_PER_CALL)
    ]


def _report(
    words: Sequence[WordForTopics],
    answers: dict[int, list[str]],
    *,
    model: str,
    dry_run: bool,
    failed: int,
) -> str:
    sorted_words = [word for word in words if word.id in answers]
    per_topic = Counter(topic for word in sorted_words for topic in answers[word.id])
    no_topic = [word for word in sorted_words if not answers[word.id]]
    no_topic_classes = Counter(word.word_class for word in no_topic)
    class_totals = Counter(word.word_class for word in sorted_words)
    two_topics = sum(len(answers[word.id]) == MAX_TOPICS for word in sorted_words)
    total = len(sorted_words) or 1

    lines = [
        "# Topic sorting report",
        "",
        f"- prompt: `{PROMPT}`, model: `{model}`",
        f"- words sorted: {len(sorted_words)}, failed batches: {failed}"
        + (" (dry run: nothing written)" if dry_run else ""),
        f"- no topic: {len(no_topic)} ({len(no_topic) / total:.0%}), "
        f"two topics: {two_topics} ({two_topics / total:.0%})",
        "",
        "## Words per topic",
        "",
        "| topic | words |",
        "|---|---|",
        *(
            f"| {topic} | {per_topic[topic]} |"
            for topic in sorted(TOPICS, key=lambda t: -per_topic[t])
        ),
        "",
        "## Words without a topic, by word class",
        "",
        "| word class | without a topic | of all |",
        "|---|---|---|",
        *(
            f"| {word_class} | {count} | {class_totals[word_class]} |"
            for word_class, count in no_topic_classes.most_common()
        ),
        "",
        "## Nouns without a topic",
        "",
        "Nearly every noun should have a topic; these show what the list or the prompt misses.",
        "",
        *(
            f"- {word.word} ({word.meaning or '?'})"
            for word in no_topic
            if word.word_class == "noun"
        ),
        "",
        f"## Sample of {SAMPLE_SIZE} words",
        "",
        "| word | class | level | meaning | topics |",
        "|---|---|---|---|---|",
        *(
            f"| {word.word} | {word.word_class} | {word.level or ''} | {word.meaning or ''} "
            f"| {', '.join(answers[word.id]) or '—'} |"
            for word in sorted_words[:SAMPLE_SIZE]
        ),
        "",
    ]
    return "\n".join(lines)


def classify_topics(
    config: Config,
    *,
    language: str,
    limit: int | None,
    force: bool,
    dry_run: bool,
    report_path: Path,
) -> TopicsResult:
    setup_logging("word_topics", language)
    summary = RunSummary("word_topics", language)
    with db.connect() as connection:
        words = word_topics.words_to_classify(
            connection,
            language=language,
            meaning_language=MEANING_LANGUAGE,
            prompt=PROMPT,
            force=force,
            limit=limit,
        )
        if words and not dry_run:
            with connection.transaction():
                word_topics.sync_topic_tags(connection, TOPICS)
    get_logger().info("%d words to sort into topics", len(words))

    model = config.providers.llm.model
    template = read_prompt(PROMPT)
    cache = Cache(language, "word_topics")
    answers: dict[int, list[str]] = {}
    failed = 0
    if words:
        with model_client(get_settings()) as client:
            llm = _FixedTemperature(create_llm(client, config), TEMPERATURE)

            def sort_batch(batch: list[WordForTopics]) -> tuple[list[WordTopics], bool]:
                reply, cached = _generate_json(
                    llm=llm,
                    cache=cache,
                    word=f"words {batch[0].id}..{batch[-1].id}",
                    model=model,
                    prompt=template.substitute(words=_request(batch)),
                    schema=WordTopicsReply,
                    validate=lambda value: _validate_reply(value, batch),
                    config=config,
                    summary=summary,
                )
                if not dry_run:
                    with db.connect() as connection, connection.transaction():
                        for item in reply.words:
                            word_topics.replace_word_topics(
                                connection,
                                word_id=item.id,
                                topics=item.topics,
                                model=model,
                                prompt=PROMPT,
                            )
                return reply.words, cached

            results, failed = _run_many(
                _batches(words),
                sort_batch,
                lambda batch: f"words {batch[0].id}..{batch[-1].id}",
                summary,
                config.llm_concurrency,
            )
        answers = {item.id: item.topics for batch in results for item in batch}

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        _report(words, answers, model=model, dry_run=dry_run, failed=failed), encoding="utf-8"
    )
    summary.write()
    return TopicsResult(sorted=len(answers), failed=failed, report=report_path)
