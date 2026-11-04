-- The words of each example sentence, so the site can show what each one means in that sentence
-- when a learner hovers it. The pipeline's annotate step fills both tables: spaCy finds each
-- word's dictionary form and its vocabulary entry, and the meaning comes from that entry or, when
-- the entry has several meanings or there is none, from the language model.

create table public.example_tokens (
  example_id bigint not null references public.examples (id) on delete cascade,
  position smallint not null check (position >= 0),
  -- Character offsets into examples.example_sentence, end exclusive.
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  surface text not null check (btrim(surface) <> ''),
  lemma text not null check (btrim(lemma) <> ''),
  -- The vocabulary entry the word belongs to. Both parts of a separated verb ("hast ... vor")
  -- point to the same entry (vorhaben).
  word_id bigint references public.words (id) on delete set null,
  primary key (example_id, position)
);

create index example_tokens_word_idx
  on public.example_tokens (word_id)
  where word_id is not null;

create table public.example_token_glosses (
  example_id bigint not null,
  position smallint not null,
  meaning_language text not null check (meaning_language ~ '^[a-z]{2,3}$'),
  gloss text not null check (btrim(gloss) <> ''),
  -- 'lexicon' copies the entry's only meaning; 'model' is chosen for this sentence.
  source text not null check (source in ('lexicon', 'model')),
  primary key (example_id, position, meaning_language),
  foreign key (example_id, position)
    references public.example_tokens (example_id, position) on delete cascade
);

alter table public.example_tokens enable row level security;
alter table public.example_token_glosses enable row level security;

create policy example_tokens_read_published
  on public.example_tokens
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.examples
      where examples.id = example_tokens.example_id
        and examples.status = 'published'
    )
  );

create policy example_token_glosses_read_published
  on public.example_token_glosses
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.examples
      where examples.id = example_token_glosses.example_id
        and examples.status = 'published'
    )
  );
