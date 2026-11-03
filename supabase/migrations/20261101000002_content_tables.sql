-- Published dictionary content is immutable by identifier. Content changes use upserts or status
-- transitions so existing URLs and user references remain valid.

create table public.words (
  id bigint generated always as identity primary key,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  entry_type text not null default 'word'
    check (entry_type in ('word', 'phrase', 'idiom')),
  lemma text not null check (btrim(lemma) <> ''),
  slug text not null check (btrim(slug) <> ''),
  pos text not null check (btrim(pos) <> ''),
  gender text,
  plural text,
  ipa text,
  level text check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  level_source text check (level_source in ('goethe', 'estimated')),
  freq_rank integer check (freq_rank is null or freq_rank > 0),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'rejected', 'retired')),
  source text not null check (btrim(source) <> ''),
  model_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language, slug),
  unique (language, lemma, pos)
);

create index words_published_level_rank_idx
  on public.words (language, level, freq_rank)
  where status = 'published';
create index words_lemma_trgm_idx
  on public.words using gin (lemma extensions.gin_trgm_ops);

create table public.word_slug_redirects (
  language text not null check (language ~ '^[a-z]{2,3}$'),
  old_slug text not null check (btrim(old_slug) <> ''),
  word_id bigint not null references public.words (id) on delete cascade,
  primary key (language, old_slug)
);

create index word_slug_redirects_word_id_idx
  on public.word_slug_redirects (word_id);

create table public.senses (
  id bigint generated always as identity primary key,
  word_id bigint not null references public.words (id) on delete cascade,
  gloss_language text not null check (gloss_language ~ '^[a-z]{2,3}$'),
  gloss text not null check (btrim(gloss) <> ''),
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (word_id, gloss_language, sort_order)
);

create index senses_word_language_order_idx
  on public.senses (word_id, gloss_language, sort_order);

create table public.word_forms (
  language text not null check (language ~ '^[a-z]{2,3}$'),
  form text not null check (btrim(form) <> ''),
  word_id bigint not null references public.words (id) on delete cascade,
  form_type text,
  primary key (language, form, word_id)
);

create index word_forms_word_id_idx on public.word_forms (word_id);

create table public.morphemes (
  id bigint generated always as identity primary key,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  text text not null check (btrim(text) <> ''),
  type text not null check (type in ('prefix', 'root', 'suffix')),
  meaning text not null check (btrim(meaning) <> ''),
  separable boolean,
  slug text not null check (btrim(slug) <> ''),
  check (separable is not true or type = 'prefix'),
  unique (language, type, text),
  unique (language, slug)
);

create table public.word_morphemes (
  word_id bigint not null references public.words (id) on delete cascade,
  position integer not null check (position >= 0),
  surface text not null check (surface <> ''),
  morpheme_id bigint references public.morphemes (id) on delete restrict,
  primary key (word_id, position)
);

create index word_morphemes_morpheme_id_idx
  on public.word_morphemes (morpheme_id)
  where morpheme_id is not null;

create table public.examples (
  id bigint generated always as identity primary key,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  sentence text not null check (btrim(sentence) <> ''),
  level text check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'rejected', 'retired')),
  source text not null check (btrim(source) <> ''),
  model_info jsonb,
  unique (language, sentence)
);

create index examples_published_language_idx
  on public.examples (language, id)
  where status = 'published';

create table public.example_translations (
  example_id bigint not null references public.examples (id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  text text not null check (btrim(text) <> ''),
  primary key (example_id, language)
);

-- target_id is polymorphic and is validated by the publishing service.
create table public.example_links (
  example_id bigint not null references public.examples (id) on delete cascade,
  target_type text not null check (target_type in ('word', 'grammar')),
  target_id bigint not null check (target_id > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (example_id, target_type, target_id)
);

create index example_links_target_idx
  on public.example_links (target_type, target_id, sort_order);

-- owner_id is polymorphic and is validated by the publishing service.
create table public.audio (
  id bigint generated always as identity primary key,
  owner_type text not null check (owner_type in ('word', 'example')),
  owner_id bigint not null check (owner_id > 0),
  accent text not null check (btrim(accent) <> ''),
  voice text not null check (btrim(voice) <> ''),
  model text not null check (btrim(model) <> ''),
  path text not null check (btrim(path) <> ''),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  unique (owner_type, owner_id, accent)
);

create index audio_owner_idx on public.audio (owner_type, owner_id);

create table public.tags (
  id bigint generated always as identity primary key,
  type text not null check (type in ('topic', 'exam', 'list')),
  slug text not null check (btrim(slug) <> ''),
  name text not null check (btrim(name) <> ''),
  icon text,
  unique (type, slug)
);

create table public.word_tags (
  word_id bigint not null references public.words (id) on delete cascade,
  tag_id bigint not null references public.tags (id) on delete cascade,
  primary key (word_id, tag_id)
);

create index word_tags_tag_id_idx on public.word_tags (tag_id);

create table public.word_embeddings (
  word_id bigint not null references public.words (id) on delete cascade,
  model text not null check (btrim(model) <> ''),
  embedding extensions.vector,
  primary key (word_id, model)
);
