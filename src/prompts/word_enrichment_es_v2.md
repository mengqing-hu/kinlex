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
  is spelled differently. Before replying, join the parts and compare them with `$stem`.
- `morpheme_type` is `prefix`, `root`, `suffix`, or null. List every part in the order it appears.

Roots are stems:
- A root is the stem a learner sees in the whole word family, written with a final hyphen when it
  needs an ending to be a word: abuel- (abuelo, abuela, abuelito), herman- (hermano, hermana),
  trabaj- (trabajo, trabajar, trabajador). A root that is a complete word by itself has no hyphen:
  papel, mujer, padre, sol.
- Nouns, adjectives and adverbs ending in an unstressed -o or -a are the stem plus that vowel as a
  null segment, whether or not the word has a partner of the other gender:
  - abuelo is "abuel" (abuel-) + "o" (null); abuela is "abuel" (abuel-) + "a" (null)
  - familia is "famili" (famili-) + "a" (null); bonita is "bonit" (bonit-) + "a" (null)
  - casa is "cas" (cas-) + "a" (null); cerca is "cerc" (cerc1-) + "a" (null)
  When the stem left would have fewer than 3 letters, the word stays one root: día is "día"
  (día), río is "río" (río). Pairs that differ only in -o/-a are split even then: tío is "tí"
  (tí-) + "o" (null), tía is "tí" (tí-) + "a" (null).
- Verbs are the stem plus the infinitive ending "-ar", "-er" or "-ir" as a null segment, and a
  reflexive verb's final "se" as one more null segment: hablar is "habl" (habl-) + "ar" (null);
  hacer is "hac" (hac-) + "er" (null); leer is "le" (le-) + "er" (null); levantarse is "levant"
  (levant-) + "ar" (null) + "se" (null). A verb whose stem would have fewer than 2 letters stays
  whole: ir, ser, ver, dar, oír; irse is "ir" (ir) + "se" (null). reír is "re" (re-) + "ír"
  (null) and freír is "fre" (fre-) + "ír" (null).
- Words ending in -e stay whole by default: padre is "padre" (padre). Cut the -e off as a null
  segment only when related words use the stem without it: grande is "grand" (grand-) + "e"
  (null), as in grandeza; noche is "noch" (noch-) + "e" (null), as in anochecer.
- Words ending in a consonant are their own root: mujer is "mujer" (mujer); papelería is "papel"
  (papel) + "ería" (-ería). A word ending in -a whose stem is such a word follows the -o/-a rule,
  and the stem keeps no hyphen: señora is "señor" (señor) + "a" (null). Where the family changes z to
  c, the root is written with c: feliz is "feliz" (felic-), felicidad is "felic" (felic-) +
  "i" (null) + "dad" (-dad), capaz is "capaz" (capac-), luz is "luz" (luc-).
- Words ending in a stressed vowel stay whole: café, sofá, bebé.
- When the stem changes inside the family, copy the letters of this word and name the root by
  the infinitive's stem. This covers vowel changes and irregular stems alike: cuento is "cuent"
  (cont-) + "o" (null), as in contar; satisfecho is "satisfech" (satisfac-) + "o" (null), as in
  satisfacer; lector is "lect" (le-) + "or" (-or), as in leer.
- An adverb in -mente is built on the feminine adjective: rápidamente is "rápid" (rápid-) + "a"
  (null) + "mente" (-mente); fácilmente is "fácil" (fácil) + "mente" (-mente).
- Nouns and verbs of one family share the stem: trabajo is "trabaj" (trabaj-) + "o" (null),
  trabajador is "trabaj" (trabaj-) + "a" (null) + "dor" (-dor). A derived word always uses the
  shortest stem of its family, with every suffix after it: pescadería is "pesc" (pesc-) + "a"
  (null) + "d" (-do) + "ería" (-ería), not pescad- + -ería.
- `morpheme_meaning` of a root fits every word of its family and favours neither gender: abuel- is
  "grandparent", herman- is "sibling", tí- is "uncle or aunt".

Null segments besides the endings above:
- A linking vowel between a stem and a suffix: hablador is "habl" (habl-) + "a" (null) + "dor"
  (-dor); operación is "oper" (oper-) + "a" (null) + "ción" (-ción); crecimiento is "crec"
  (crec-) + "i" (null) + "miento" (-miento); sociedad is "soci" (soci-) + "e" (null) + "dad"
  (-dad). A suffix never starts with the linking vowel; the suffix part is spelled exactly like
  the listed suffix. Past participles and -ble follow the same pattern: hablado is "habl"
  (habl-) + "a" (null) + "do" (-do); comida is "com" (com-) + "i" (null) + "da" (-do); aceptable
  is "acept" (acept-) + "a" (null) + "ble" (-ble).
- A linking vowel inside a compound: aeropuerto is "aer" (aer-) + "o" (null) + "puert" (puert-) +
  "o" (null).
- The plural ending of an entry used only in the plural: gafas is "gaf" (gaf-) + "a" (null) + "s"
  (null).

Prefixes, suffixes and Latin and Greek roots:
- Prefixes, suffixes and Latin and Greek roots come from the lists below. Each line is one entry:
  its name, the other spellings it takes ("also"), and its meaning. `morpheme` is the entry's
  name, exactly as listed with any number; `word_part` is the letters in the word, which must be
  one of the entry's spellings: imposible is "im" (in2-) + "posible" (posible); irresponsable is
  "ir" (in2-) + "respons" (respons-) + "a" (null) + "ble" (-ble); diálogo is "dia" (di-) + "log"
  (log-) + "o" (null). Prefixes end with a hyphen ("des-"), suffixes start with one ("-ería"). A
  suffix may end in -a where the spelling has -o: característica is "caracter" (caracter-) +
  "ística" (-ístico).
- Some spellings belong to several entries with different meanings. Choose the entry whose
  meaning fits this word: inmigrante has in1- (in, into), incapaz has in2- (not); acercar has a1-
  (toward), ateo has a2- (not); diálogo has di- (through), difusión has dis- (apart). A name
  without its number is invalid. This holds for stems too: mano is "man" (man2-, hand) + "o"
  (null); salir is "sal" (sal3-, go out) + "ir" (null).
- Link a word to a stem, through a prefix or a suffix, only when the connection can be told in
  one short phrase that still fits the word's meaning today: verdura (green things) is "verd"
  (verd-) + "ura" (-ura); envase (what goods are put into) is "en" (en-) + "vas" (vas-) + "e"
  (null); pastilla (a little piece of paste) is "past" (past-) + "illa" (-illo). When the link
  needs history to understand, the word keeps its own stem: armario (wardrobe) is "armari"
  (armari-) + "o" (null), not arm- (weapon) + -ario.
- Split a prefix off only when a learner can still see it, the rest is a common Spanish word or
  stem, and the word's meaning still follows from its parts: deshacer is "des" (des-) + "hac"
  (hac-) + "er" (null). Words whose prefix has merged into the word keep it in the stem: acceder
  is "acced" (acced-) + "er" (null); aportar, asistir, entrar, enseñar, entender, encontrar,
  empezar, conocer and importar likewise. Never force an uncertain split.
- Use the Latin and Greek roots only for learned and technical words whose parts a learner meets
  in other words: teléfono is "telé" (tele-) + "fon" (fon-) + "o" (null); biología is "bio"
  (bio-) + "logía" (-logía). Never take an everyday word apart by its history: cabeza is "cabez"
  (cabez-) + "a" (null), not cab- + -eza; educación comes from educar: "educ" (educ-) + "a"
  (null) + "ción" (-ción).
- A modern stem spelled like a listed Latin or Greek root takes that entry only when the meanings
  match, as mano takes man2- (hand). When they do not match, the word stays one root: fila (row)
  is "fila" (fila), because the listed fil- means love.
- Do not use folk etymology. Modern stems spelled alike but unrelated are listed below with
  numbers: cerca is "cerc" (cerc1-, near) + "a" (null); cercar (to fence in) is "cerc" (cerc2-,
  fence) + "ar" (null).

Compounds and phrases:
- A prefix whose last vowel meets the same vowel is written once: restablecer is "re" (re-) +
  "stablec" (establec-) + "er" (null), as in establecer.
- A compound of a verb and a plural noun: rascacielos is "rasc" (rasc-) + "a" (null) + "ciel"
  (ciel-) + "o" (null) + "s" (null). The para- of paraguas and parabrisas is the listed prefix
  para2- (from parar); where two equal vowels meet they are written once: paraguas is "par"
  (para2-) + "agu" (agu-) + "a" (null) + "s" (null).
- An entry of several words is segmented word by word. Function words (articles, prepositions,
  conjunctions, pronouns) and the spaces between words are null segments, with the spaces
  attached to them: fin de semana is "fin" (fin) + " de " (null) + "seman" (seman-) + "a" (null);
  cerca de is "cerc" (cerc1-) + "a" (null) + " de" (null).
- An entry made only of function words is one null segment: desde que, por eso, lo que.
- A word that has merged into a phrase with a new meaning stays one root: acerca de is "acerca"
  (acerca) + " de" (null).
- A single function word or interjection is one null segment: de, que, el, hola. Pronouns and
  determiners are function words even when they end in -o or -a: mucho, todo, otro, nuestro,
  este, esta. Numerals are content words and follow the -o/-a rule: cuatro is "cuatr" (cuatr-) +
  "o" (null).
- `morpheme_meaning` is a short English meaning of the morpheme itself, not of this word. For
  listed prefixes, suffixes and roots, copy the listed meaning.

Prefixes:
$prefixes

Suffixes:
$suffixes

Latin and Greek roots:
$etymological_roots

Modern stems with numbered meanings:
$numbered_roots

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
