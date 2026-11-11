Review word families of a $language vocabulary for learners. Each root below was given to its
words one word at a time, so some words may have landed under a root they do not belong to. A
learner opens a root to see the words that share it, so every word there must share its meaning.

For each root you get its name, its meaning, whether it is a listed Latin or Greek root, and its
words with the part of the word that spells the root and the word's English meaning.

1. List as an outlier every word whose meaning cannot be told from the root's meaning in one short
   phrase that still fits the word today, or that comes from a different word spelled alike:
   - pasar (to pass) and paso (step) under pass- (suffer, feel), whose words are pasión and
     compasión: they come from pasar, not from the root of pasión.
   - primo (cousin) under prim- (first): a learner cannot see "first" in cousin.
   - enloquecer (to go mad) under loqu- (speak): it comes from loco (mad).
   - arquitecto (architect) under teg- (cover), whose words are techo and sin techo.
   For each outlier give `root`, the stem it should have instead, written like the roots here
   (with a final hyphen when it needs an ending: pas-, loc-), and `root_meaning`, a short English
   meaning of that stem. When several outliers of one root belong together (pasar, paso, pasillo,
   repasar), give them the same stem and meaning.
2. Keep a word whose link can be told in one short phrase, even if its meaning moved: verdura
   (green things) under verd-, pastilla (a little piece of paste) under past-, envase (what goods
   are put into) under vas-. Keep idioms and phrases built on a word of the family: dar con la
   tecla under dar, ser uña y carne under carn-.
3. When the words that stay are a family but the root's meaning does not describe them all, give
   a better short `meaning`: one that fits every word that stays and favours neither gender
   (sibling, not brother). Never change the meaning of a listed Latin or Greek root. Use null
   when the meaning is fine.
4. Report only real problems. A root with no outlier and a fitting meaning gets an empty list and
   null.

Roots:
$roots

Reply with JSON only, one entry for every root id above:
{
  "roots": [
    {
      "id": 0,
      "outliers": [
        {"word": "...", "reason": "...", "root": "...", "root_meaning": "..."}
      ],
      "meaning": null
    }
  ]
}
