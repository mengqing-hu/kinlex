Sort German vocabulary entries into topics, so a learner can browse and practise the words that
belong to one area of life. A word is useful under a topic only if a learner studying that topic
would expect to meet it there.

Topics (use these ids only):
- `people`: family, relatives, friends, partners, age and stages of life, kinds of people.
  Mutter, Nachbar, heiraten, das Kind.
- `health`: the body, illness, injury, doctors, medicine, hospitals, hygiene. Kopf, Fieber,
  Apotheke, sich erkälten.
- `food`: food, drink, cooking, meals, restaurants, cafés. Brot, kochen, Speisekarte, satt.
- `housing`: homes, rooms, furniture, household items and chores, renting, moving house.
  Miete, Küche, Schrank, aufräumen.
- `clothing`: clothes, shoes, accessories, dressing, sizes of clothes. Hose, anziehen, Mantel.
- `shopping`: buying and paying as a customer, shops, prices, personal money and banking. Preis,
  bezahlen, Kasse, günstig, sparen.
- `work`: jobs, workplaces, colleagues, applying for work, working conditions. Beruf, Chef,
  Bewerbung, Gehalt, Überstunden.
- `education`: school, university, courses, exams, learning and teaching. Prüfung, Lehrer,
  Unterricht, studieren.
- `travel`: getting around and travelling: vehicles, public transport, roads, trips, hotels,
  luggage. Zug, Fahrkarte, Flughafen, Doppelzimmer, umsteigen.
- `places`: towns, buildings, streets, countries, directions and position in a place. Rathaus,
  Kreuzung, Dorf, links, Ausland.
- `nature`: weather, seasons, landscapes, plants and animals. Regen, Wald, Hund, blühen.
- `time`: clock times, days, months, dates, frequency, how long or how early something is.
  Montag, Uhr, morgen, Jahrhundert, pünktlich.
- `leisure`: hobbies, sport, games, going out, holidays as free time. Fußball, wandern, Hobby,
  Freizeit.
- `media`: devices, computers, the internet, phones, television, press, technical equipment.
  Handy, E-Mail, Bildschirm, Zeitung, herunterladen.
- `communication`: talking, writing, asking, answering, discussing, arguing, letters and
  messages as acts of communication. sagen, Gespräch, erklären, Brief, sich beschweren.
- `feelings`: emotions, moods, personality and behaviour towards others. Angst, glücklich,
  ehrlich, tolerant, sich ärgern.
- `society`: public offices, paperwork, police, social services, social life and social issues.
  Amt, Formular, Polizei, Gesellschaft, Ausländer, Versicherung.
- `numbers`: numbers, colours, sizes, weights, quantities, units. zwölf, rot, Kilo, Meter, halb.
- `law`: laws, courts, crime and punishment, rights, government, elections, parties. Gericht,
  Gesetz, wählen, Regierung, Diebstahl.
- `economy`: businesses, markets, trade, industry, the economy as a whole. Firma, Umsatz,
  Konkurrenz, Export, Inflation.
- `science`: research, experiments, scientific fields and their terms. Forschung, Experiment,
  Chemie, Theorie.
- `environment`: pollution, climate change, waste, energy use, protecting nature. Umweltschutz,
  Müll, recyceln, Klimawandel.
- `culture`: music, literature, film, theatre, art, museums, festivals and customs. Konzert,
  Roman, Ausstellung, Weihnachten.
- `history`: historical periods and events, war and peace in history, religion and belief.
  Krieg, Mittelalter, Kirche, beten.
- `concepts`: thinking, knowing, judging and reasoning, and general ideas and principles.
  Gedanke, Idee, Meinung, Begriff, Zweifel, Annahme, meinen, erkennen, überlegen, logisch.

Where two topics are close, choose by these boundaries:
- `nature` is weather, plants, animals and landscape; `environment` is harm to nature and
  protecting it.
- `shopping` is what a person buys and pays; `economy` is what businesses and markets do.
- `society` is offices, paperwork and social life; `law` is laws, courts and government.
- `education` is schools, courses and exams; `science` is research and scientific fields.
- `media` is devices, networks and news; `communication` is the act of talking or writing,
  whatever the channel.
- `culture` is the arts and traditions; `leisure` is hobbies, sport and free time.
- `concepts` is how people think and the ideas they think with; `communication` is saying them
  to someone, `science` is research. Do not put a word in `concepts` only because it is
  abstract: Ergebnis, Unterschied and Zustand are not about thinking. An abstract word keeps any
  other topic that fits (Rede and Vorschlag are `communication`, Frist is `time`) and gets no
  topic only when none does.

Rules:
- Give each word zero, one or two topics, the one that fits best first. Add a second topic only
  when the word is just as central to it: Doppelzimmer is `travel` (hotels), not `housing`;
  wandern is `leisure` and `nature`.
- Judge the word by its own meaning. The English meaning and the example sentence only show
  which sense is meant; they do not add topics: gehen in "Ich gehe nach Hause." is not
  `housing`.
- When the English meaning lists senses from different areas, judge by the first one: Folge
  ("consequence, episode") is about a consequence, so it gets no topic, not `media`.
- Give a topic whenever one fits the word's meaning, even when the word is abstract, formal or
  rare: a learner working through that topic should find the word useful there. Urteil is `law`,
  Antrag is `society`, Verabredung is `time`, Ausflug is `leisure`.
- Leave the list empty only for words that no topic fits:
  - grammar words such as articles, pronouns, prepositions, conjunctions and particles: der, ab,
    weil, vielleicht, doch;
  - general verbs that can be about anything: machen, bestehen, vorkommen, beginnen;
  - general adjectives and adverbs that can describe anything: schnell, frei, richtig, rasant,
    plötzlich;
  - abstract words about no particular area: Ergebnis, Unterschied, Zustand.
- A word of these kinds still gets a topic when one sense is clearly about it: kostenlos is
  `shopping`, ehrlich is `feelings`, pünktlich is `time`.
- Use only the ids listed above, written exactly as shown.

Words (JSON). Each has its `id`, the word with its article for nouns, its word class, its English
meaning and an example sentence:

$words

Reply with one JSON object only, listing every word above, including those with no topic:

{"words": [{"id": 12, "topics": ["food"]}, {"id": 13, "topics": ["leisure", "nature"]}, {"id": 14, "topics": []}]}
