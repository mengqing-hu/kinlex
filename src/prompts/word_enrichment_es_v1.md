Complete the missing dictionary metadata for this Spanish vocabulary entry.

Word: $word
Word class: $word_class
English meaning: $word_meaning
Example sentence: $example_sentence
Sentence meaning: $sentence_meaning

Noun rules (use null for all three when the entry is not a noun):
- `gender` is "m" or "f". Use "m/f" only for a noun used with both articles for a man and a
  woman: el/la estudiante, el/la periodista.
- `article` is the singular definite article said before the noun: "el", "la", or "el/la" for
  "m/f" nouns. It follows the sound, not only the gender: agua is gender "f" with article "el".
  A noun used only in the plural takes "los" or "las": las gafas, las patatas fritas.
- `plural` is the standard plural form without an article: ciudad is "ciudades", lápiz is
  "lápices", fin de semana is "fines de semana", crisis is "crisis". Use null for nouns used only
  in the plural and nouns that have no plural.

Segmentation rules:
- Segment `$stem`. The `word_part` values, joined in order, must spell `$stem` exactly, including
  spaces and accents. Copy each `word_part` letter by letter from `$stem`, even where the morpheme
  is spelled differently: in enfriar the root part is "fri" (frío), in teléfono the prefix part is
  "telé" (tele-). Before replying, join the parts and compare them with `$stem`.
- `morpheme_type` is `prefix`, `root`, `suffix`, or null. List every part in the order it appears.
- A root is a modern Spanish word that a learner knows, in its dictionary form: nouns in the
  singular, adjectives in the masculine singular, verbs in the infinitive. Examples:
  - incapaz is "in" (in²-) + "capaz" (capaz)
  - deshacer is "des" (des-) + "hac" (hacer) + "er" (null)
  - acercar is "a" (a¹-) + "cerc" (cerca) + "ar" (null); cercano is "cerc" (cerca) + "ano" (-ano)
  - frutería is "frut" (fruta) + "ería" (-ería)
  - enamorarse is "en" (en-) + "amor" (amor) + "ar" (null) + "se" (null)
- Only when a part is not a modern Spanish word, use one of the Latin and Greek roots listed
  below, written exactly as listed, with its hyphen and any number. A word may mix both kinds:
  - teléfono is "telé" (tele-) + "fon" (fon-) + "o" (null)
  - biología is "bio" (bio-) + "logía" (-logía)
  - aeropuerto is "aer" (aer-) + "o" (null) + "puerto" (puerto)
  - filántropo is "fil" (fil-) + "ántrop" (antrop-) + "o" (null)
  Never write a hyphenated root that is not in the list; use a modern word or leave the word
  unsplit instead.
- Use the Latin and Greek roots only for learned and technical words whose parts a learner meets
  in other words, such as tele-, bio-, fon- and -logía. Never take an everyday word apart by its
  history: cabeza, compañero, novio, cuerpo and familia are each one root.
- Prefixes and suffixes come from the lists below. Use the listed spelling that matches the
  letters in the word: imposible is "im" (im²-) + "posible" (posible), not in²-. Prefixes end
  with a hyphen ("des-"), suffixes start with one ("-ería"); never put a hyphen on both sides.
- Some spellings have several numbered entries with different meanings. Choose the number whose
  meaning fits this word: importar has im¹- (in, into), imposible has im²- (not); acercar has a¹-
  (toward), ateo has a²- (not). A listed spelling without its number is invalid.
- Split a prefix off only when a learner can still see it and the rest is a Spanish word or a
  listed root. Words whose prefix has merged into the word stay one root: acceder, aportar,
  asistir, entrar, enseñar, entender, encontrar, empezar, conocer. Never force an uncertain split.
- A verb's infinitive ending "-ar", "-er" or "-ir" is its own segment with `morpheme_type` null:
  hablar is "habl" (hablar) + "ar" (null). A reflexive verb's final "se" is one more null segment
  after it: levantarse is "levant" (levantar) + "ar" (null) + "se" (null). Verbs too short to have
  a stem stay whole: ir, ser, ver, dar; irse is "ir" (ir) + "se" (null). A verb-forming suffix
  keeps its ending: envejecer is "en" (en-) + "vej" (viejo) + "ecer" (-ecer).
- Do not split a noun's or adjective's final -o or -a: niño is one root "niño", bonita is one root
  "bonito". When a suffix follows, the vowel is dropped and the root keeps its dictionary form:
  cercano is "cerc" (cerca) + "ano" (-ano).
- A feminine noun that is the counterpart of a masculine one has the masculine noun as its root
  and stays one part: hija is "hija" (hijo), amiga is "amiga" (amigo), novia is "novia" (novio),
  señora is "señora" (señor). A noun that is its own word keeps its own root: madre, mujer.
- A plural ending in an entry used only in the plural is a null segment: cercanías is "cerc"
  (cerca) + "an" (-ano) + "ía" (-ía) + "s" (null).
- When a noun is the bare stem of a verb, the verb is the root and the noun stays one part:
  trabajo is "trabajo" (trabajar), compra is "compra" (comprar), cuento is "cuento" (contar).
- A word made from an adjective or noun with a prefix has that adjective or noun as its root when
  the prefix alone does not leave a verb: engordar is "en" (en-) + "gord" (gordo) + "ar" (null);
  empeorar is "em" (em-) + "peor" (peor) + "ar" (null).
- Do not use folk etymology, and do not choose a root by spelling alone: cercar (to fence in)
  comes from cerca (fence), not from cerca (near). Choose the root a learner knows today.
- An entry of several words is segmented word by word. Content words are segmented as above.
  Function words (articles, prepositions, conjunctions, pronouns) and the spaces between words
  are null segments, with the spaces attached to them:
  - fin de semana is "fin" (fin) + " de " (null) + "semana" (semana)
  - cerca de is "cerca" (cerca) + " de" (null); de cerca is "de " (null) + "cerca" (cerca)
  - correo electrónico is "correo" (correo) + " " (null) + "electrónico" (electrónico)
  A word that has merged into a phrase with a new meaning stays one root: acerca de is "acerca"
  (acerca) + " de" (null).
- A single function word or interjection is one segment with `morpheme_type` null: de, que, el,
  hola.
- A word that cannot be split is one root segment in its dictionary form: casa, mesa, papel,
  and any word whose analysis is uncertain.
- `morpheme_meaning` is a short English meaning of the morpheme itself that fits every word using
  it, not the meaning of this word: "-ería" is "shop; quality, act". For listed prefixes,
  suffixes and roots, copy the listed meaning.

Prefixes:
$prefixes

Suffixes:
$suffixes

Latin and Greek roots:
$etymological_roots

Reply with JSON only:
{
  "gender": null,
  "article": null,
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
