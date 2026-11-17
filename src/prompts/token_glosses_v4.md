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

Some words are marked `"find_form": true`: the dictionary form given for them may be wrong, and
the word was not found in the dictionary. For each of them, also give under `forms`:
- `lemma`: its $source_language dictionary form, as a dictionary lists it: the infinitive of a
  verb (Spanish "puedas" is "poder", "olvides" is "olvidar", "hacerlo" is "hacer"), the masculine
  singular of an adjective ("malas" is "malo"), the singular of a noun ("pañales" is "pañal").
  Lowercase unless the word is always capitalized. No article, no pronoun.
- `kind`: "word" for an ordinary $source_language word; "name" for a person, place, brand or
  other name; "interjection" for a sound or filler such as "ah", "mmm", "wow"; "foreign" for a
  word of another language, such as English "okay" or "web" in a Spanish sentence; "number" for
  a number, amount or unit, such as "30", "kg" or "$$".

Sentences (JSON). Each word has its position `i` in the sentence, its spelling, and its
dictionary form:

$sentences

Reply with one JSON object only, giving a meaning for every listed position of every sentence,
and a form for every word marked `"find_form": true`:

{"sentences": [{"id": 12, "glosses": {"0": "...", "4": "..."},
  "forms": {"4": {"lemma": "...", "kind": "word"}}}]}
