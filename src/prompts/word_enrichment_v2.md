Complete the missing dictionary metadata for this German vocabulary entry.

Word: $word
Word class: $word_class
English meaning: $word_meaning
Example sentence: $example_sentence
Sentence meaning: $sentence_meaning

Plural rule:
- `plural` is the standard plural form of a singular noun, without an article. Give it whenever
  a dictionary lists one, even if the noun is often uncountable: Zeit is "Zeiten", Papier is
  "Papiere". Use null only for verbs, adjectives, phrases, plural-only nouns, and nouns that
  have no plural at all.

Segmentation rules:
- Segment only `$stem`. The `word_part` values, joined in order, must spell `$stem` exactly,
  including spaces. A noun's article and a reflexive verb's "sich" are not part of it.
- `morpheme_type` is `prefix`, `root`, `suffix`, or null. A word can have several prefixes,
  roots, and suffixes; list every part in the order it appears.
  Example: Unabhängigkeit is "Un" (un-) + "ab" (ab-) + "häng" (hängen) + "ig" (-ig) + "keit" (-keit).
- `word_part` is the exact spelling inside the word. `morpheme` is the canonical form shared by
  every word that contains it:
  - Prefixes are lowercase and end with a hyphen: "ver-", "fern-". Suffixes are lowercase and
    start with a hyphen: "-keit", "-ung". Never put a hyphen on both sides.
  - A root is the dictionary form of the word it comes from, even when the spelling inside the
    word differs. Verbs use the infinitive, nouns the capitalized nominative singular, and
    adjectives the base form: "ständ" in Missverständnis is "stehen", "Bäck" in Bäckerei is
    "backen", "gefähr" in gefährlich is "Gefahr", "klär" in Erklärung is "klar".
- When a noun is the bare stem of a verb, the verb is the root, also inside other words:
  Spiel is root "spielen", Antwort is "antworten", Arbeit is "arbeiten", Schlaf is "schlafen",
  Zahl is "zahlen". Beispiel is "Bei" (bei-) + "spiel" (spielen).
  This holds even when the noun's meaning has drifted from the verb's: Laden (shop) is root
  "laden", Bad is "baden", Flug is "fliegen".
- Every root must be a real German word. Never cut out a fragment that is not a word, such as
  "stud" in studieren; leave such a word unsplit. Do not use folk etymology: Freitag is not
  frei + Tag, so it is a single root.
- Never invent a root. Kasse is one root "Kasse", not a verb "kassen", which does not exist.
- Choose the root a learner knows today, not a historical form: Mädchen is one root "Mädchen",
  not "Mäd" (Magd) + "chen" (-chen).
- A root is never an inflected or nominalized form. In Krankenhaus the root is the adjective:
  "Krank" (krank) + "en" (null) + "haus" (Haus), not "Kranke".
- A full word at the start of a compound is a root, not a prefix: Großmutter is "Groß" (groß) +
  "mutter" (Mutter). Prefixes are only bound elements such as ver-, be-, ent-, or the verb
  particles an-, auf-, weg-.
- A single letter that abbreviates a word is not a morpheme: U-Bahn is "U-" (null) +
  "Bahn" (Bahn).
- Split a compound all the way down: Hauptbahnhof is "Haupt" (Haupt) + "bahn" (Bahn) +
  "hof" (Hof), never "Haupt" + "bahnhof" (Bahnhof).
- A verb root keeps its infinitive ending: sehen is one root segment "sehen"; fernsehen is
  "fern" (fern-) + "sehen" (sehen). Never split "-en" or "-n" off a verb.
- The first part of a compound verb is a root, not a prefix, when it is itself a word:
  kennenlernen is "kennen" (kennen) + "lernen" (lernen).
- Use null for linking elements and inflectional endings: Lebensmittel is "Leben" (Leben) +
  "s" (null) + "mittel" (Mittel); Kinderzimmer is "Kind" (Kind) + "er" (null) + "zimmer" (Zimmer).
- Split stacked suffixes into their parts: -igkeit is "-ig" + "-keit"; Bäckerei is "Bäck" +
  "er" (-er) + "ei" (-ei).
- The verb-forming suffix of loan verbs is one segment: telefonieren is "telefon" (Telefon) +
  "ieren" (-ieren). Never split it into "-ier-" and "-en". When the part before "ieren" is not
  a word, as in studieren or reparieren, the verb is unsplit. Verbs whose "ieren" is not this
  suffix, such as verlieren or frieren, are not segmented this way.
- A word that cannot be split is one root segment in its dictionary form. This includes simple
  words (Kirche, Geld), loanwords (Computer, Papier, Kasse), words whose parts no longer carry their
  meaning (vergessen, beginnen, gewinnen, verlieren), and any word whose analysis is uncertain.
  Never force an uncertain split.
- Only a phrase, an idiom, or a function word (article, pronoun, preposition, conjunction,
  particle, interjection) is one segment with `morpheme_type` null.
- `morpheme_meaning` is a short English meaning of the morpheme itself that fits every word
  using it, not the meaning of this word: "-er" is "person or thing that does the action".

Reply with JSON only:
{
  "plural": null,
  "segments": [
    {
      "word_part": "...",
      "morpheme_type": null,
      "morpheme": null,
      "morpheme_meaning": null
    }
  ]
}
