Translate the subtitles of a $source_language video into $language, for a learner who reads
$language and watches the video in $source_language. The learner sees each translation under its
sentence.

Rules:
- Translate each sentence on its own line, keeping its meaning, tone and register: spoken
  language stays spoken, slang stays casual.
- Stay close enough that the learner can match the $source_language words to the translation,
  but write natural $language, not word-for-word glosses.
- A sentence may be cut off where the speaker was interrupted or the subtitle split it. Translate
  what is there; do not finish it from the next sentence.
- Names of people, places and brands are written as a $language text would write them.
- One translation per sentence: no notes, quotes or alternatives.

The sentences just before these, for context only (do not translate them):

$context

Sentences to translate (JSON):

$sentences

Reply with one JSON object only, giving every sentence by its id:

{"items": [{"id": 12, "text": "..."}]}
