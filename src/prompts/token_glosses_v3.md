Give the $language meaning of selected words in $source_language sentences, as each word is used
in its sentence. A learner sees the meaning when hovering or clicking the word, so it must be
short.

Rules:
- Translate the word as it reads in this sentence, matching the given $language translation where
  it has a counterpart there. In German, "Der Zug fährt durch eine wunderschöne Landschaft."
  ("The train travels through a beautiful landscape.") gives fährt "travels" and wunderschöne
  "beautiful" in English.
- When `options` lists the dictionary meanings, pick the one that fits and shorten it to what
  this sentence uses: German von with options "from, of" is "of" in "die Mutter von Lisa".
- Keep it as short as a dictionary entry: one to four words, or the few characters a $language
  reader needs. No explanations, grammar labels, quotes, or brackets.
- Articles and pronouns get their $language counterpart where it has one. A word with no
  counterpart, such as an article where $language has none, a separable prefix already covered by
  its verb, a reflexive pronoun that belongs to its verb, or "es" in German "es gibt", gets the
  meaning of the expression it belongs to.
- Names stay as a $language text would write them.

Sentences (JSON). Each word has its position `i` in the sentence, its spelling, and its
dictionary form:

$sentences

Reply with one JSON object only, giving a meaning for every listed position of every sentence:

{"sentences": [{"id": 12, "glosses": {"0": "...", "4": "..."}}]}
