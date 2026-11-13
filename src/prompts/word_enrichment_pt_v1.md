Complete the missing dictionary metadata for this Brazilian Portuguese vocabulary entry.

Word: $word
Word class: $word_class
English meaning: $word_meaning
Example sentence: $example_sentence
Sentence meaning: $sentence_meaning

Noun rules (`plural` is null when the entry is not a noun, adjectives included):
- `gender` and `article` are always null; the word class already states them.
- `plural` is the standard Brazilian plural form without an article: cidade is "cidades", mão is
  "mãos", pão is "pães", coração is "corações", animal is "animais", lápis is "lápis", fim de
  semana is "fins de semana". Use null for nouns used only in the plural and nouns that have no
  plural.

Segmentation rules:
- Segment `$stem`. The `word_part` values, joined in order, must spell `$stem` exactly, including
  spaces, hyphens and accents. Copy each `word_part` letter by letter from `$stem`, even where the
  morpheme is spelled differently. Before replying, join the parts and compare them with `$stem`.
- `morpheme_type` is `prefix`, `root`, `suffix`, or null. List every part in the order it appears.

Roots are stems:
- A root is the stem a learner sees in the whole word family, written with a final hyphen when it
  needs an ending to be a word: avô and avó stay whole, but irm- (irmão, irmã, irmandade), trabalh-
  (trabalho, trabalhar, trabalhador). A root that is a complete word by itself has no hyphen:
  papel, mulher, homem, sol.
- Nouns, adjectives and adverbs ending in an unstressed -o or -a are the stem plus that vowel as a
  null segment, whether or not the word has a partner of the other gender:
  - menino is "menin" (menin-) + "o" (null); menina is "menin" (menin-) + "a" (null)
  - família is "famíli" (famíli-) + "a" (null); bonita is "bonit" (bonit-) + "a" (null)
  - casa is "cas" (cas-) + "a" (null); livro is "livr" (livr-) + "o" (null)
  When the stem left would have fewer than 3 letters, the word stays one root: dia is "dia"
  (dia), rio is "rio" (rio). Pairs that differ only in -o/-a are split even then: tio is "ti"
  (ti-) + "o" (null), tia is "ti" (ti-) + "a" (null).
- Nouns and adjectives ending in -ão or -ã stay whole by default: pão is "pão" (pão), mão is "mão"
  (mão), manhã is "manhã" (manhã). Cut the ending off as a null segment only when related words
  use the stem without it: irmão is "irm" (irm-) + "ão" (null) and irmã is "irm" (irm-) + "ã"
  (null), as in irmandade. The listed suffixes are different: -ção in educação, and the
  augmentative -ão in carrão, are suffixes, not null endings.
- Verbs are the stem plus the infinitive ending "-ar", "-er" or "-ir" as a null segment. A
  reflexive verb's final "-se", with its hyphen, is one more null segment: falar is "fal" (fal-) +
  "ar" (null); vender is "vend" (vend-) + "er" (null); chamar-se is "cham" (cham-) + "ar" (null)
  + "-se" (null). A verb whose stem would have fewer than 2 letters stays whole: ir, ser, ver,
  dar, ter, vir, ler, crer, rir; ir-se is "ir" (ir) + "-se" (null). pôr stays whole as "pôr"
  (pôr), and its compounds are a prefix plus "por" (pôr): compor is "com" (con-) + "por" (pôr).
  The compounds of ter, ver and vir follow the same pattern when the prefix is plain to a
  learner: conter is "con" (con-) + "ter" (ter); prever is "pre" (pré-) + "ver" (ver).
- A verb formed with a listed verb suffix keeps the infinitive inside that suffix, with nothing
  after it: envelhecer is "en" (en-) + "velh" (velh-) + "ecer" (-ecer), as in velho; anoitecer is
  "a" (a1-) + "noit" (noct-) + "ecer" (-ecer); organizar is "organ" (organ-) + "izar" (-izar).
- Words ending in -e stay whole by default: pente is "pente" (pente). Cut the -e off as a null
  segment only when related words use the stem without it: grande is "grand" (grand-) + "e"
  (null), as in grandeza; noite is "noit" (noit-) + "e" (null), as in anoitecer.
- Words ending in a consonant, including -m, are their own root: mulher is "mulher" (mulher);
  homem is "homem" (homem); papelaria is "papel" (papel) + "aria" (-aria). A word ending in -a
  whose stem is such a word follows the -o/-a rule, and the stem keeps no hyphen: senhora is
  "senhor" (senhor) + "a" (null). Where the family changes z to c, the root is written with c:
  feliz is "feliz" (felic-), felicidade is "felic" (felic-) + "i" (null) + "dade" (-dade), capaz
  is "capaz" (capac-).
- Words ending in a stressed vowel stay whole: café, sofá, bebê, avô, avó, chá, você.
- When the spelling of the stem changes inside the family, copy the letters of this word and name
  the root by the infinitive's stem. This covers c/qu, g/gu, c/ç and g/j as well as irregular
  stems: choque is "choqu" (choc-) + "e" (null), as in chocar; feito is "feit" (fac-) + "o"
  (null), as in fazer; dito is "dit" (dic-) + "o" (null), as in dizer; leitor is "lei" (leg2-) +
  "tor" (-dor), as in ler.
- An adverb in -mente is built on the feminine adjective: rapidamente is "rapid" (rápid-) + "a"
  (null) + "mente" (-mente); facilmente is "facil" (fácil) + "mente" (-mente).
- Nouns and verbs of one family share the stem: trabalho is "trabalh" (trabalh-) + "o" (null),
  trabalhador is "trabalh" (trabalh-) + "a" (null) + "dor" (-dor). A past participle used as an
  adjective or noun shares its verb's stem: cansado is "cans" (cans-) + "a" (null) + "do" (-do),
  as in cansar and descansar; casado is "cas" (cas1-) + "a" (null) + "do" (-do). A derived word always uses the
  shortest stem of its family, with every suffix after it: livraria is "livr" (livr-) + "aria"
  (-aria), as in livro.
- `morpheme_meaning` of a root fits every word of its family and favours neither gender: menin-
  is "child", irm- is "sibling", ti- is "uncle or aunt".

Null segments besides the endings above:
- A linking vowel between a stem and a suffix: falador is "fal" (fal-) + "a" (null) + "dor"
  (-dor); operação is "oper" (oper-) + "a" (null) + "ção" (-ção); crescimento is "cresc"
  (cresc-) + "i" (null) + "mento" (-mento); sociedade is "soci" (soci-) + "e" (null) + "dade"
  (-dade). A suffix never starts with the linking vowel; the suffix part is spelled exactly like
  the listed suffix. Past participles and -vel follow the same pattern: falado is "fal" (fal-) +
  "a" (null) + "do" (-do); comida is "com" (com-) + "i" (null) + "da" (-do); aceitável is
  "aceit" (aceit-) + "á" (null) + "vel" (-vel).
- A linking vowel inside a compound: aeronave is "aer" (aer-) + "o" (null) + "nav" (nav-) + "e"
  (null).
- The plural ending of an entry used only in the plural: óculos is "ócul" (ocul-) + "o" (null) +
  "s" (null); férias is "féri" (féri-) + "a" (null) + "s" (null).

Prefixes, suffixes and Latin and Greek roots:
- Prefixes, suffixes and Latin and Greek roots come from the lists below. Each line is one entry:
  its name, the other spellings it takes ("also"), and its meaning. `morpheme` is the entry's
  name, exactly as listed with any number; `word_part` is the letters in the word, which must be
  one of the entry's spellings: impossível is "im" (in2-) + "poss" (poss-) + "í" (null) + "vel"
  (-vel);
  irresponsável is "ir" (in2-) + "respons" (respons-) + "á" (null) + "vel" (-vel); diálogo is
  "diá" (di-) + "log" (log-) + "o" (null). Prefixes end with a hyphen ("des-"), suffixes start
  with one ("-aria"). A suffix may end in -a where the spelling has -o: característica is
  "caracter" (caracter-) + "ística" (-ístico).
- Some spellings belong to several entries with different meanings. Choose the entry whose
  meaning fits this word: imigrante is "i" (in1-, in, into) + "migr" (migr-) + "ante" (-ante),
  where in- before m is written with one m; incapaz has in2- (not); aproximar has a1-
  (toward), ateu has a2- (not); diálogo has di- (through), difusão has dis- (apart). A name
  without its number is invalid. This holds for roots too: manual is "manu" (man2-, hand) + "al"
  (-al1); salário is "sal" (sal1-, salt) + "ário" (-ário). When several entries list the letters
  of a part, `morpheme` is the name of the one entry that fits, never the shared spelling: sentir
  is "sent" (sens-, feel) + "ir" (null); sentar is "sent" (sed-, sit) + "ar" (null).
- Link a word to a stem, through a prefix or a suffix, only when the connection can be told in
  one short phrase that still fits the word's meaning today: verdura (green things) is "verd"
  (verd-) + "ura" (-ura); pedreiro (who works with stone) is "pedr" (pedr-) + "eiro" (-eiro).
  When the link needs history to understand, the word keeps its own stem: armário (wardrobe) is
  "armári" (armári-) + "o" (null), not arm- (weapon) + -ário.
- Split a prefix off only when a learner can still see it, the rest is a common Portuguese word or
  stem, and the word's meaning still follows from its parts: desfazer is "des" (des-) + "faz"
  (fac-) + "er" (null). Words whose prefix has merged into the word keep it in the stem: aceitar
  is "aceit" (aceit-) + "ar" (null); acontecer, aprender, assistir, entrar, ensinar, entender,
  encontrar, começar, conhecer, manter and importar likewise. Never force an uncertain split.
- Use the Latin and Greek roots only for learned and technical words whose parts a learner meets
  in other words: telefone is "tele" (tele-) + "fon" (fon-) + "e" (null); biologia is "bio"
  (bio-) + "logia" (-logia); democracia is "dem" (dem-) + "o" (null) + "cracia" (-cracia). A
  listed suffix is used whole, never rebuilt from a root and a shorter suffix. Never take an everyday word apart by its history: cabeça is "cabeç"
  (cabeç-) + "a" (null), not cab- + -eça; educação comes from educar: "educ" (educ-) + "a"
  (null) + "ção" (-ção).
- A modern stem spelled like a listed Latin or Greek root takes that entry only when the meanings
  match, as manual takes man2- (hand). When they do not match, the word stays one root: fila
  (row) is "fila" (fila), because the listed fil- means love.
- Do not use folk etymology. Modern stems spelled alike but unrelated are listed below with
  numbers, and the Latin and Greek roots spelled like them carry numbers too; a stem written
  without its number is invalid. Use the number that fits this word: casa is "cas" (cas1-) + "a"
  (null), not cad- (fall); porta is "port" (port2-, door) + "a" (null); porto is "port" (port3-,
  harbour) + "o" (null); transporte is "trans" (trans-) + "port" (port1-, carry) + "e" (null);
  ficar is "fic" (fic1-) + "ar" (null), not fac- (make).

Compounds, hyphens and phrases:
- A hyphen is a null segment of its own, except in a reflexive "-se". A hyphenated compound is
  segmented part by part: segunda-feira is "segund" (segund-) + "a" (null) + "-" (null) + "feir"
  (feir-) + "a" (null); recém-nascido is "recém" (recém-) + "-" (null) + "nasc" (nat-) + "i"
  (null) + "do" (-do); ex-presidente is "ex" (ex-) + "-" (null) + "presid" (presid-) + "ente"
  (-ante).
- A compound of a verb and a noun: guarda-chuva is "guard" (guard-) + "a" (null) + "-" (null) +
  "chuv" (chuv-) + "a" (null). In porta-malas, porta-voz and porta-retrato the first word is
  the verb portar (to carry), not porta (door): porta-malas is "port" (port1-) + "a" (null) + "-"
  (null) + "mal" (mal-, suitcase) + "a" (null) + "s" (null); this root mal- is the stem of mala,
  not the prefix mal- (badly). The para- of para-choque and para-brisa is the listed prefix
  para2- (from parar): para-choque is "para" (para2-) + "-" (null) + "choqu" (choc-) + "e" (null).
- A prefix whose last vowel meets the same vowel keeps both letters in Portuguese; segment them as
  written: reescrever is "re" (re-) + "escrev" (screv-) + "er" (null). Where a letter was dropped,
  copy what is written: restabelecer is "re" (re-) + "stabelec" (estabelec-) + "er" (null), as in
  estabelecer.
- An entry of several words is segmented word by word. Function words (articles, prepositions and
  their contractions such as do, da, no, na, ao, pelo, pronouns, conjunctions) and the spaces
  between words are null segments, with the spaces attached to them: fim de semana is "fim" (fim)
  + " de " (null) + "seman" (seman-) + "a" (null); café da manhã is "café" (café) + " da "
  (null) + "manhã" (manhã); perto de is "pert" (pert-) + "o" (null) + " de" (null).
- An entry made only of function words is one null segment: o que, por isso, para que.
- A word that has merged into a phrase with a new meaning stays one root: acerca de is "acerca"
  (acerca) + " de" (null).
- A single function word or interjection is one null segment: de, que, o, a, oi, olá. Pronouns
  and determiners are function words even when they end in -o or -a: muito, todo, outro, nosso,
  meu, minha, este, esta. Numerals are content words and follow the -o/-a rule: quatro is
  "quatr" (quatr-) + "o" (null).
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
