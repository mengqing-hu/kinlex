-- Use field names that are understandable without linguistic or database-specific terminology.

alter table public.words rename column entry_type to word_kind;
alter table public.words rename column lemma to word;
alter table public.words rename column pos to word_class;

alter table public.senses rename column gloss_language to meaning_language;
alter table public.senses rename column gloss to word_meaning;

alter table public.morphemes rename column text to morpheme;
alter table public.morphemes rename column type to morpheme_type;
alter table public.morphemes rename column meaning to morpheme_meaning;
alter table public.morphemes rename column separable to is_separable;

alter table public.word_morphemes rename column surface to word_part;

alter table public.examples rename column sentence to example_sentence;

alter table public.example_translations rename column language to meaning_language;
alter table public.example_translations rename column text to sentence_meaning;

alter index public.words_lemma_trgm_idx rename to words_word_trgm_idx;
alter index public.senses_word_language_order_idx rename to senses_word_meaning_order_idx;
