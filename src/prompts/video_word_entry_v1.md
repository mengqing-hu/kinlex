Write a short $source_language dictionary entry for a word a learner met in a video. The word is
not in the learner's dictionary yet.

Dictionary form given for it: $lemma
How it was written in the video: $forms

Sentences it appears in, with their translation:

$sentences

Rules:
- `word` is the headword as a $source_language dictionary lists it, without an article: the
  infinitive of a verb, the masculine singular of an adjective, the singular of a noun. Correct the
  given dictionary form when it is wrong.
- `phrase`: when the word only appears here as part of a fixed expression that a dictionary lists
  as one entry, give that expression ("favor" in "por favor" is "por favor", "supuesto" in "por
  supuesto" is "por supuesto"); otherwise null.
- `word_class` is one of: $word_classes.
- `level` is the CEFR level at which a learner usually meets the word: A1, A2, B1, B2, C1 or C2.
- `meanings` gives, for each of these languages: $meaning_languages, the word's meaning as a
  dictionary gives it: one to four words, or two or three common senses separated by commas
  ("fright, scare"). The sense used in the sentences comes first. No explanations or brackets.
- `is_word` is false when this is no $source_language dictionary word at all: a misspelling, a
  mis-heard word in automatic captions, or a fragment. Then the other fields may be empty.

Reply with one JSON object only:

{"word": "...", "phrase": null, "word_class": "...", "level": "A2",
 "meanings": {"en": "..."}, "is_word": true}
