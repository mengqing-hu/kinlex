begin;

insert into public.words (
  language,
  word,
  slug,
  word_class,
  gender,
  plural,
  level,
  level_source,
  freq_rank,
  status,
  source
)
values
  ('de', 'ablehnen', 'ablehnen', 'verb', null, null, 'B1', 'estimated', 2100, 'published', 'kinlex_seed'),
  ('de', 'ansprechen', 'ansprechen', 'verb', null, null, 'B1', 'estimated', 1800, 'published', 'kinlex_seed'),
  ('de', 'Ausland', 'ausland', 'noun', 'das', null, 'A2', 'estimated', 1500, 'published', 'kinlex_seed'),
  ('de', 'Beziehung', 'beziehung', 'noun', 'die', 'Beziehungen', 'B1', 'estimated', 1300, 'published', 'kinlex_seed'),
  ('de', 'entscheiden', 'entscheiden', 'verb', null, null, 'B1', 'estimated', 900, 'published', 'kinlex_seed'),
  ('de', 'Erfahrung', 'erfahrung', 'noun', 'die', 'Erfahrungen', 'B1', 'estimated', 1100, 'published', 'kinlex_seed'),
  ('de', 'gemeinsam', 'gemeinsam', 'adjective', null, null, 'A2', 'estimated', 1400, 'published', 'kinlex_seed'),
  ('de', 'Gespräch', 'gespraech', 'noun', 'das', 'Gespräche', 'A2', 'estimated', 1600, 'published', 'kinlex_seed'),
  ('de', 'Herausforderung', 'herausforderung', 'noun', 'die', 'Herausforderungen', 'B2', 'estimated', 3200, 'published', 'kinlex_seed'),
  ('de', 'kennenlernen', 'kennenlernen', 'verb', null, null, 'A2', 'estimated', 2400, 'published', 'kinlex_seed'),
  ('de', 'Möglichkeit', 'moeglichkeit', 'noun', 'die', 'Möglichkeiten', 'A2', 'estimated', 700, 'published', 'kinlex_seed'),
  ('de', 'notwendig', 'notwendig', 'adjective', null, null, 'A2', 'estimated', 2300, 'published', 'kinlex_seed'),
  ('de', 'plötzlich', 'ploetzlich', 'adverb', null, null, 'B1', 'estimated', 1700, 'published', 'kinlex_seed'),
  ('de', 'unabhängig', 'unabhaengig', 'adjective', null, null, 'B2', 'estimated', 2900, 'published', 'kinlex_seed'),
  ('de', 'unterstützen', 'unterstuetzen', 'verb', null, null, 'B1', 'estimated', 1900, 'published', 'kinlex_seed'),
  ('de', 'Verantwortung', 'verantwortung', 'noun', 'die', 'Verantwortungen', 'B1', 'estimated', 2200, 'published', 'kinlex_seed'),
  ('de', 'verstehen', 'verstehen', 'verb', null, null, 'A1', 'estimated', 400, 'published', 'kinlex_seed'),
  ('de', 'vielleicht', 'vielleicht', 'adverb', null, null, 'A1', 'estimated', 300, 'published', 'kinlex_seed'),
  ('de', 'wichtig', 'wichtig', 'adjective', null, null, 'A1', 'estimated', 500, 'published', 'kinlex_seed'),
  ('de', 'Zusammenarbeit', 'zusammenarbeit', 'noun', 'die', null, 'B1', 'estimated', 3600, 'published', 'kinlex_seed')
on conflict (language, word, word_class) do update
set slug = excluded.slug,
    gender = excluded.gender,
    plural = excluded.plural,
    level = excluded.level,
    level_source = excluded.level_source,
    freq_rank = excluded.freq_rank,
    status = excluded.status,
    source = excluded.source;

insert into public.senses (word_id, meaning_language, word_meaning, sort_order)
select words.id, 'en', seed.word_meaning, 0
from (
  values
    ('ablehnen', 'verb', 'to reject or decline'),
    ('ansprechen', 'verb', 'to address or speak to someone'),
    ('Ausland', 'noun', 'a foreign country; abroad'),
    ('Beziehung', 'noun', 'a relationship or connection'),
    ('entscheiden', 'verb', 'to decide'),
    ('Erfahrung', 'noun', 'experience or practical knowledge'),
    ('gemeinsam', 'adjective', 'shared or together'),
    ('Gespräch', 'noun', 'a conversation'),
    ('Herausforderung', 'noun', 'a challenge'),
    ('kennenlernen', 'verb', 'to get to know someone or something'),
    ('Möglichkeit', 'noun', 'a possibility or opportunity'),
    ('notwendig', 'adjective', 'necessary'),
    ('plötzlich', 'adverb', 'suddenly'),
    ('unabhängig', 'adjective', 'independent'),
    ('unterstützen', 'verb', 'to support'),
    ('Verantwortung', 'noun', 'responsibility'),
    ('verstehen', 'verb', 'to understand'),
    ('vielleicht', 'adverb', 'perhaps or maybe'),
    ('wichtig', 'adjective', 'important'),
    ('Zusammenarbeit', 'noun', 'cooperation or collaboration')
) as seed (word, word_class, word_meaning)
join public.words
  on words.language = 'de'
  and words.word = seed.word
  and words.word_class = seed.word_class
on conflict (word_id, meaning_language, sort_order) do update
set word_meaning = excluded.word_meaning;

insert into public.morphemes (
  language,
  morpheme,
  morpheme_type,
  morpheme_meaning,
  is_separable,
  slug
)
values
  ('de', 'ab-', 'prefix', 'away or off', true, 'ab-prefix'),
  ('de', 'an-', 'prefix', 'toward or at', true, 'an-prefix'),
  ('de', 'aus-', 'prefix', 'out or outside', true, 'aus-prefix'),
  ('de', 'be-', 'prefix', 'forms a transitive verb or related noun', false, 'be-prefix'),
  ('de', 'ent-', 'prefix', 'away or out of', false, 'ent-prefix'),
  ('de', 'er-', 'prefix', 'reaching a result', false, 'er-prefix'),
  ('de', 'ge-', 'prefix', 'collective or completed formation', false, 'ge-prefix'),
  ('de', 'heraus-', 'prefix', 'outward from a place', true, 'heraus-prefix'),
  ('de', 'un-', 'prefix', 'not or opposite', false, 'un-prefix'),
  ('de', 'unter-', 'prefix', 'under or among', false, 'unter-prefix'),
  ('de', 'ver-', 'prefix', 'change or completion', false, 'ver-prefix'),
  ('de', 'zusammen-', 'prefix', 'together', true, 'zusammen-prefix'),
  ('de', 'lehn', 'root', 'lean or decline', null, 'lehn-root'),
  ('de', 'sprech', 'root', 'speak', null, 'sprech-root'),
  ('de', 'land', 'root', 'land or country', null, 'land-root'),
  ('de', 'zieh', 'root', 'pull or relate', null, 'zieh-root'),
  ('de', 'scheid', 'root', 'separate or distinguish', null, 'scheid-root'),
  ('de', 'fahr', 'root', 'travel or experience', null, 'fahr-root'),
  ('de', 'gemein', 'root', 'shared or common', null, 'gemein-root'),
  ('de', 'forder', 'root', 'demand or require', null, 'forder-root'),
  ('de', 'kennen', 'root', 'know or be familiar with', null, 'kennen-root'),
  ('de', 'lern', 'root', 'learn', null, 'lern-root'),
  ('de', 'möglich', 'root', 'possible', null, 'moeglich-root'),
  ('de', 'not', 'root', 'need or necessity', null, 'not-root'),
  ('de', 'wend', 'root', 'turn or apply', null, 'wend-root'),
  ('de', 'häng', 'root', 'hang or depend', null, 'haeng-root'),
  ('de', 'stütz', 'root', 'support', null, 'stuetz-root'),
  ('de', 'antwort', 'root', 'answer', null, 'antwort-root'),
  ('de', 'steh', 'root', 'stand', null, 'steh-root'),
  ('de', 'wicht', 'root', 'weight or importance', null, 'wicht-root'),
  ('de', 'arbeit', 'root', 'work', null, 'arbeit-root'),
  ('de', '-ung', 'suffix', 'forms an action or result noun', null, 'ung-suffix'),
  ('de', '-sam', 'suffix', 'having a quality', null, 'sam-suffix'),
  ('de', '-keit', 'suffix', 'forms an abstract noun', null, 'keit-suffix'),
  ('de', '-ig', 'suffix', 'having a quality', null, 'ig-suffix')
on conflict (language, morpheme_type, morpheme) do update
set morpheme_meaning = excluded.morpheme_meaning,
    is_separable = excluded.is_separable,
    slug = excluded.slug;

insert into public.word_morphemes (word_id, position, word_part, morpheme_id)
select words.id, seed.position, seed.word_part, morphemes.id
from (
  values
    ('ablehnen', 'verb', 0, 'ab', 'prefix', 'ab-'),
    ('ablehnen', 'verb', 1, 'lehn', 'root', 'lehn'),
    ('ablehnen', 'verb', 2, 'en', null, null),
    ('ansprechen', 'verb', 0, 'an', 'prefix', 'an-'),
    ('ansprechen', 'verb', 1, 'sprech', 'root', 'sprech'),
    ('ansprechen', 'verb', 2, 'en', null, null),
    ('Ausland', 'noun', 0, 'Aus', 'prefix', 'aus-'),
    ('Ausland', 'noun', 1, 'land', 'root', 'land'),
    ('Beziehung', 'noun', 0, 'Be', 'prefix', 'be-'),
    ('Beziehung', 'noun', 1, 'zieh', 'root', 'zieh'),
    ('Beziehung', 'noun', 2, 'ung', 'suffix', '-ung'),
    ('entscheiden', 'verb', 0, 'ent', 'prefix', 'ent-'),
    ('entscheiden', 'verb', 1, 'scheid', 'root', 'scheid'),
    ('entscheiden', 'verb', 2, 'en', null, null),
    ('Erfahrung', 'noun', 0, 'Er', 'prefix', 'er-'),
    ('Erfahrung', 'noun', 1, 'fahr', 'root', 'fahr'),
    ('Erfahrung', 'noun', 2, 'ung', 'suffix', '-ung'),
    ('gemeinsam', 'adjective', 0, 'gemein', 'root', 'gemein'),
    ('gemeinsam', 'adjective', 1, 'sam', 'suffix', '-sam'),
    ('Gespräch', 'noun', 0, 'Ge', 'prefix', 'ge-'),
    ('Gespräch', 'noun', 1, 'spräch', 'root', 'sprech'),
    ('Herausforderung', 'noun', 0, 'Heraus', 'prefix', 'heraus-'),
    ('Herausforderung', 'noun', 1, 'forder', 'root', 'forder'),
    ('Herausforderung', 'noun', 2, 'ung', 'suffix', '-ung'),
    ('kennenlernen', 'verb', 0, 'kennen', 'root', 'kennen'),
    ('kennenlernen', 'verb', 1, 'lern', 'root', 'lern'),
    ('kennenlernen', 'verb', 2, 'en', null, null),
    ('Möglichkeit', 'noun', 0, 'Möglich', 'root', 'möglich'),
    ('Möglichkeit', 'noun', 1, 'keit', 'suffix', '-keit'),
    ('notwendig', 'adjective', 0, 'not', 'root', 'not'),
    ('notwendig', 'adjective', 1, 'wend', 'root', 'wend'),
    ('notwendig', 'adjective', 2, 'ig', 'suffix', '-ig'),
    ('unabhängig', 'adjective', 0, 'un', 'prefix', 'un-'),
    ('unabhängig', 'adjective', 1, 'ab', 'prefix', 'ab-'),
    ('unabhängig', 'adjective', 2, 'häng', 'root', 'häng'),
    ('unabhängig', 'adjective', 3, 'ig', 'suffix', '-ig'),
    ('unterstützen', 'verb', 0, 'unter', 'prefix', 'unter-'),
    ('unterstützen', 'verb', 1, 'stütz', 'root', 'stütz'),
    ('unterstützen', 'verb', 2, 'en', null, null),
    ('Verantwortung', 'noun', 0, 'Ver', 'prefix', 'ver-'),
    ('Verantwortung', 'noun', 1, 'antwort', 'root', 'antwort'),
    ('Verantwortung', 'noun', 2, 'ung', 'suffix', '-ung'),
    ('verstehen', 'verb', 0, 'ver', 'prefix', 'ver-'),
    ('verstehen', 'verb', 1, 'steh', 'root', 'steh'),
    ('verstehen', 'verb', 2, 'en', null, null),
    ('wichtig', 'adjective', 0, 'wicht', 'root', 'wicht'),
    ('wichtig', 'adjective', 1, 'ig', 'suffix', '-ig'),
    ('Zusammenarbeit', 'noun', 0, 'Zusammen', 'prefix', 'zusammen-'),
    ('Zusammenarbeit', 'noun', 1, 'arbeit', 'root', 'arbeit')
) as seed (word, word_class, position, word_part, morpheme_type, morpheme)
join public.words
  on words.language = 'de'
  and words.word = seed.word
  and words.word_class = seed.word_class
left join public.morphemes
  on morphemes.language = 'de'
  and morphemes.morpheme_type = seed.morpheme_type
  and morphemes.morpheme = seed.morpheme
on conflict (word_id, position) do update
set word_part = excluded.word_part,
    morpheme_id = excluded.morpheme_id;

insert into public.examples (language, example_sentence, level, status, source)
values
  ('de', 'Ich [lehne] das Angebot [ab].', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Wir [sprechen] das Problem morgen [an].', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Sie lebt seit zwei Jahren im [Ausland].', 'A2', 'published', 'kinlex_seed'),
  ('de', 'Sie haben eine gute [Beziehung].', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Wir müssen heute [entscheiden].', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Das war eine interessante [Erfahrung].', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Wir lernen [gemeinsam].', 'A2', 'published', 'kinlex_seed'),
  ('de', 'Das [Gespräch] war sehr hilfreich.', 'A2', 'published', 'kinlex_seed'),
  ('de', 'Diese Aufgabe ist eine große [Herausforderung].', 'B2', 'published', 'kinlex_seed'),
  ('de', 'Wir möchten unsere Nachbarn [kennenlernen].', 'A2', 'published', 'kinlex_seed'),
  ('de', 'Gibt es eine andere [Möglichkeit]?', 'A2', 'published', 'kinlex_seed'),
  ('de', 'Ein Pass ist für die Reise [notwendig].', 'A2', 'published', 'kinlex_seed'),
  ('de', '[Plötzlich] begann es zu regnen.', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Sie arbeitet sehr [unabhängig].', 'B2', 'published', 'kinlex_seed'),
  ('de', 'Meine Freunde [unterstützen] mich.', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Er übernimmt die [Verantwortung].', 'B1', 'published', 'kinlex_seed'),
  ('de', 'Ich kann die Frage gut [verstehen].', 'A1', 'published', 'kinlex_seed'),
  ('de', '[Vielleicht] komme ich morgen.', 'A1', 'published', 'kinlex_seed'),
  ('de', 'Schlaf ist für die Gesundheit [wichtig].', 'A1', 'published', 'kinlex_seed'),
  ('de', 'Gute [Zusammenarbeit] braucht Vertrauen.', 'B1', 'published', 'kinlex_seed')
on conflict (language, example_sentence) do update
set level = excluded.level,
    status = excluded.status,
    source = excluded.source;

insert into public.example_translations (example_id, meaning_language, sentence_meaning)
select examples.id, 'en', seed.sentence_meaning
from (
  values
    ('Ich [lehne] das Angebot [ab].', 'I decline the offer.'),
    ('Wir [sprechen] das Problem morgen [an].', 'We will address the problem tomorrow.'),
    ('Sie lebt seit zwei Jahren im [Ausland].', 'She has lived abroad for two years.'),
    ('Sie haben eine gute [Beziehung].', 'They have a good relationship.'),
    ('Wir müssen heute [entscheiden].', 'We have to decide today.'),
    ('Das war eine interessante [Erfahrung].', 'That was an interesting experience.'),
    ('Wir lernen [gemeinsam].', 'We learn together.'),
    ('Das [Gespräch] war sehr hilfreich.', 'The conversation was very helpful.'),
    ('Diese Aufgabe ist eine große [Herausforderung].', 'This task is a major challenge.'),
    ('Wir möchten unsere Nachbarn [kennenlernen].', 'We would like to get to know our neighbors.'),
    ('Gibt es eine andere [Möglichkeit]?', 'Is there another possibility?'),
    ('Ein Pass ist für die Reise [notwendig].', 'A passport is necessary for the trip.'),
    ('[Plötzlich] begann es zu regnen.', 'Suddenly it began to rain.'),
    ('Sie arbeitet sehr [unabhängig].', 'She works very independently.'),
    ('Meine Freunde [unterstützen] mich.', 'My friends support me.'),
    ('Er übernimmt die [Verantwortung].', 'He takes responsibility.'),
    ('Ich kann die Frage gut [verstehen].', 'I can understand the question well.'),
    ('[Vielleicht] komme ich morgen.', 'Maybe I will come tomorrow.'),
    ('Schlaf ist für die Gesundheit [wichtig].', 'Sleep is important for health.'),
    ('Gute [Zusammenarbeit] braucht Vertrauen.', 'Good collaboration requires trust.')
) as seed (example_sentence, sentence_meaning)
join public.examples
  on examples.language = 'de'
  and examples.example_sentence = seed.example_sentence
on conflict (example_id, meaning_language) do update
set sentence_meaning = excluded.sentence_meaning;

insert into public.example_links (example_id, target_type, target_id, sort_order)
select examples.id, 'word', words.id, 0
from (
  values
    ('Ich [lehne] das Angebot [ab].', 'ablehnen', 'verb'),
    ('Wir [sprechen] das Problem morgen [an].', 'ansprechen', 'verb'),
    ('Sie lebt seit zwei Jahren im [Ausland].', 'Ausland', 'noun'),
    ('Sie haben eine gute [Beziehung].', 'Beziehung', 'noun'),
    ('Wir müssen heute [entscheiden].', 'entscheiden', 'verb'),
    ('Das war eine interessante [Erfahrung].', 'Erfahrung', 'noun'),
    ('Wir lernen [gemeinsam].', 'gemeinsam', 'adjective'),
    ('Das [Gespräch] war sehr hilfreich.', 'Gespräch', 'noun'),
    ('Diese Aufgabe ist eine große [Herausforderung].', 'Herausforderung', 'noun'),
    ('Wir möchten unsere Nachbarn [kennenlernen].', 'kennenlernen', 'verb'),
    ('Gibt es eine andere [Möglichkeit]?', 'Möglichkeit', 'noun'),
    ('Ein Pass ist für die Reise [notwendig].', 'notwendig', 'adjective'),
    ('[Plötzlich] begann es zu regnen.', 'plötzlich', 'adverb'),
    ('Sie arbeitet sehr [unabhängig].', 'unabhängig', 'adjective'),
    ('Meine Freunde [unterstützen] mich.', 'unterstützen', 'verb'),
    ('Er übernimmt die [Verantwortung].', 'Verantwortung', 'noun'),
    ('Ich kann die Frage gut [verstehen].', 'verstehen', 'verb'),
    ('[Vielleicht] komme ich morgen.', 'vielleicht', 'adverb'),
    ('Schlaf ist für die Gesundheit [wichtig].', 'wichtig', 'adjective'),
    ('Gute [Zusammenarbeit] braucht Vertrauen.', 'Zusammenarbeit', 'noun')
) as seed (example_sentence, word, word_class)
join public.examples
  on examples.language = 'de'
  and examples.example_sentence = seed.example_sentence
join public.words
  on words.language = 'de'
  and words.word = seed.word
  and words.word_class = seed.word_class
on conflict (example_id, target_type, target_id) do update
set sort_order = excluded.sort_order;

commit;
