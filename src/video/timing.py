"""Time each word of the captions, so the page can follow the speech word by word.

YouTube's recognition of the speech times every word it heard. Its words are matched in order to
the words of the captions shown; a matched word takes the heard word's time. A word with no match
(misheard, or said differently) shares the time between its matched neighbours by its length, and
without a recognition track every word shares its sentence's time that way. A sentence then runs
from its first word to its last, and ends by the time the next one starts.
"""

from collections.abc import Sequence
from difflib import SequenceMatcher

from video.captions import CaptionLine, TimedWord, spelling


def _spread(
    times: list[tuple[int, int] | None], lengths: Sequence[int], start_ms: int, end_ms: int
) -> None:
    """Fill each run of untimed words between start_ms (or the timed word before the run) and
    end_ms (or the timed word after it), in proportion to the words' lengths."""
    index = 0
    while index < len(times):
        if times[index] is not None:
            index += 1
            continue
        run_end = index
        while run_end < len(times) and times[run_end] is None:
            run_end += 1
        previous = times[index - 1] if index > 0 else None
        following = times[run_end] if run_end < len(times) else None
        begin = previous[1] if previous else start_ms
        finish = following[0] if following else end_ms
        finish = max(finish, begin)
        total = sum(lengths[index:run_end]) or 1
        done = 0
        for position in range(index, run_end):
            word_start = begin + (finish - begin) * done // total
            done += lengths[position]
            times[position] = (word_start, begin + (finish - begin) * done // total)
        index = run_end


def time_words(
    lines: Sequence[CaptionLine],
    words: Sequence[Sequence[str]],
    heard: Sequence[TimedWord],
) -> tuple[list[CaptionLine], list[list[tuple[int, int]]]]:
    """The sentences with their times taken from their words, and each word's start and end.

    words holds each sentence's words in order, as split for clicking.
    """
    shown = [spelling(word) for sentence in words for word in sentence]
    matched: dict[int, TimedWord] = {}
    if heard:
        matcher = SequenceMatcher(None, shown, [spelling(word.text) for word in heard], False)
        for block in matcher.get_matching_blocks():
            for offset in range(block.size):
                matched[block.a + offset] = heard[block.b + offset]

    timed_lines: list[CaptionLine] = []
    word_times: list[list[tuple[int, int]]] = []
    flat = 0
    for line, sentence in zip(lines, words, strict=True):
        times: list[tuple[int, int] | None] = []
        for _word in sentence:
            word = matched.get(flat)
            times.append((word.start_ms, word.end_ms) if word else None)
            flat += 1
        _spread(times, [len(word) for word in sentence], line.start_ms, line.end_ms)
        filled = [time for time in times if time is not None]
        word_times.append(filled)
        if filled:
            line = line.model_copy(update={"start_ms": filled[0][0], "end_ms": filled[-1][1]})
        timed_lines.append(line)
    _end_before_next(timed_lines, word_times)
    return timed_lines, word_times


def _end_before_next(lines: list[CaptionLine], word_times: list[list[tuple[int, int]]]) -> None:
    """A sentence ends by the time the next one starts. The last heard word of a sentence runs on
    until the next heard word, which can be inside a following sentence the recognition missed."""
    for index in range(len(lines) - 1):
        line, following = lines[index], lines[index + 1].start_ms
        if line.start_ms < following < line.end_ms:
            lines[index] = line.model_copy(update={"end_ms": following})
            word_times[index] = [
                (min(start, following), min(end, following)) for start, end in word_times[index]
            ]
