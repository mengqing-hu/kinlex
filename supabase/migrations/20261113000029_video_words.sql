-- Videos move from study files into the database. A video belongs to the learner who added it, and
-- so do the words and example sentences it adds: their rows carry owner_id, while vocabulary
-- entries and examples keep owner_id null and stay shared.

-- Words and examples a video adds belong to the video's owner. Uniqueness is split: the shared
-- vocabulary is unique as before, and each owner's own rows are unique among themselves.
alter table public.words add column owner_id uuid references auth.users (id) on delete cascade;
alter table public.words drop constraint if exists words_language_slug_key;
alter table public.words drop constraint if exists words_language_lemma_pos_key;
create unique index words_catalog_slug_key
  on public.words (language, slug) where owner_id is null;
create unique index words_owner_slug_key
  on public.words (owner_id, language, slug) where owner_id is not null;
create unique index words_catalog_word_class_key
  on public.words (language, word, word_class) where owner_id is null;
create unique index words_owner_word_class_key
  on public.words (owner_id, language, word, word_class) where owner_id is not null;
create index words_owner_idx on public.words (owner_id) where owner_id is not null;

alter table public.examples add column owner_id uuid references auth.users (id) on delete cascade;
alter table public.examples drop constraint if exists examples_language_sentence_key;
alter table public.examples drop constraint if exists examples_language_example_sentence_key;
create unique index examples_catalog_sentence_key
  on public.examples (language, example_sentence) where owner_id is null;
create unique index examples_owner_sentence_key
  on public.examples (owner_id, language, example_sentence) where owner_id is not null;

-- Words the learner sees: the shared vocabulary and their own.
drop policy if exists words_read_published on public.words;
create policy words_read_published
  on public.words for select to anon, authenticated
  using (status = 'published' and (owner_id is null or owner_id = (select auth.uid())));
drop policy if exists examples_read_published on public.examples;
create policy examples_read_published
  on public.examples for select to anon, authenticated
  using (status = 'published' and (owner_id is null or owner_id = (select auth.uid())));

-- The inflected forms seen in videos, written back so later videos and searches find them.
-- source says where a form came from (vocabulary, video or manual); a form from a video or a
-- correction belongs to that learner.
create table public.word_forms (
  language text not null check (language ~ '^[a-z]{2,3}$'),
  form text not null check (btrim(form) <> ''),
  word_id bigint not null references public.words (id) on delete cascade,
  form_type text,
  source text not null default 'vocabulary' check (source in ('vocabulary', 'video', 'manual')),
  owner_id uuid references auth.users (id) on delete cascade,
  primary key (language, form, word_id)
);
create index word_forms_word_id_idx on public.word_forms (word_id);
create index word_forms_owner_idx on public.word_forms (owner_id) where owner_id is not null;

alter table public.word_forms enable row level security;
create policy word_forms_read_published
  on public.word_forms for select to anon, authenticated
  using (
    (owner_id is null or owner_id = (select auth.uid()))
    and exists (
      select 1 from public.words
      where words.id = word_forms.word_id and words.status = 'published'
    )
  );
create policy word_forms_server_only
  on public.word_forms as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));
revoke all on table public.word_forms from anon, authenticated;
grant select on table public.word_forms to anon, authenticated;

-- An example can have a TTS recording and the original sound from each video it comes from
-- (model 'original', voice 'video:<video id>'). TTS keeps one recording per accent, replaced when
-- it is generated again; the original sound is one per video.
alter table public.audio drop constraint if exists audio_owner_type_owner_id_accent_key;
create unique index audio_tts_accent_key
  on public.audio (owner_type, owner_id, accent) where model <> 'original';
create unique index audio_original_voice_key
  on public.audio (owner_type, owner_id, voice) where model = 'original';

create table public.videos (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  title text not null check (btrim(title) <> ''),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  provider text not null check (provider = 'youtube'),
  provider_video_id text not null,
  source_url text not null,
  -- The downloaded video; null once the video is archived.
  media_path text,
  status text not null check (status in ('processing', 'done', 'failed', 'archived')),
  failed_stage text,
  created_at timestamptz not null default now(),
  unique (owner_id, provider, provider_video_id)
);
create index videos_owner_status_idx on public.videos (owner_id, status, created_at desc);

create table public.video_lines (
  video_id text not null references public.videos (id) on delete cascade,
  position integer not null check (position >= 0),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms >= start_ms),
  text text not null,
  -- The line's language when it is not the video's.
  language text,
  primary key (video_id, position)
);

create table public.video_line_translations (
  video_id text not null,
  position integer not null,
  meaning_language text not null,
  translation text not null,
  primary key (video_id, position, meaning_language),
  foreign key (video_id, position) references public.video_lines (video_id, position)
    on delete cascade
);

create table public.video_tokens (
  video_id text not null,
  line integer not null,
  position integer not null check (position >= 0),
  start integer not null check (start >= 0),
  "end" integer not null check ("end" > start),
  surface text not null,
  lemma text not null,
  morph text,
  -- How word_id was found; 'filtered' when the token was left out of the vocabulary on purpose.
  match_source text check (
    match_source in ('word_forms', 'spacy', 'surface', 'model', 'manual', 'filtered')
  ),
  word_id bigint references public.words (id) on delete set null,
  filter_reason text,
  start_ms integer check (start_ms is null or start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= start_ms),
  primary key (video_id, line, position),
  foreign key (video_id, line) references public.video_lines (video_id, position) on delete cascade
);
create index video_tokens_word_idx on public.video_tokens (word_id) where word_id is not null;

create table public.video_token_glosses (
  video_id text not null,
  line integer not null,
  position integer not null,
  meaning_language text not null,
  gloss text not null,
  primary key (video_id, line, position, meaning_language),
  foreign key (video_id, line, position) references public.video_tokens (video_id, line, position)
    on delete cascade
);

-- Which stretch of a video an example sentence is. Sentences and caption lines do not match one to
-- one, so the example records the lines it spans.
create table public.video_examples (
  video_id text not null references public.videos (id) on delete cascade,
  example_id bigint not null references public.examples (id) on delete cascade,
  first_line integer not null,
  last_line integer not null check (last_line >= first_line),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms >= start_ms),
  primary key (video_id, example_id, first_line)
);
create index video_examples_example_idx on public.video_examples (example_id);

-- How often each word comes up in each learner's videos.
create view public.word_video_counts
with (security_invoker = true) as
select
  videos.owner_id,
  video_tokens.word_id,
  count(distinct video_tokens.video_id)::integer as video_count,
  count(*)::integer as occurrence_count,
  min(videos.created_at) as first_seen_at
from public.video_tokens
join public.videos on videos.id = video_tokens.video_id
where video_tokens.word_id is not null
group by videos.owner_id, video_tokens.word_id;

alter table public.videos enable row level security;
alter table public.video_lines enable row level security;
alter table public.video_line_translations enable row level security;
alter table public.video_tokens enable row level security;
alter table public.video_token_glosses enable row level security;
alter table public.video_examples enable row level security;

create policy videos_owner_access
  on public.videos for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy video_lines_owner_read
  on public.video_lines for select to authenticated
  using (exists (
    select 1 from public.videos where videos.id = video_id and videos.owner_id = (select auth.uid())
  ));
create policy video_line_translations_owner_read
  on public.video_line_translations for select to authenticated
  using (exists (
    select 1 from public.videos where videos.id = video_id and videos.owner_id = (select auth.uid())
  ));
create policy video_tokens_owner_read
  on public.video_tokens for select to authenticated
  using (exists (
    select 1 from public.videos where videos.id = video_id and videos.owner_id = (select auth.uid())
  ));
create policy video_token_glosses_owner_read
  on public.video_token_glosses for select to authenticated
  using (exists (
    select 1 from public.videos where videos.id = video_id and videos.owner_id = (select auth.uid())
  ));
create policy video_examples_owner_read
  on public.video_examples for select to authenticated
  using (exists (
    select 1 from public.videos where videos.id = video_id and videos.owner_id = (select auth.uid())
  ));

-- The website renames and archives videos; the pipeline writes everything else with the database
-- owner's connection.
revoke all on table
  public.videos,
  public.video_lines,
  public.video_line_translations,
  public.video_tokens,
  public.video_token_glosses,
  public.video_examples,
  public.word_video_counts
from anon, authenticated;
grant select on table
  public.video_lines,
  public.video_line_translations,
  public.video_tokens,
  public.video_token_glosses,
  public.video_examples,
  public.word_video_counts
to authenticated;
grant select, update on table public.videos to authenticated;

-- The flashcard source 'video' deals the words of the learner's own videos, the ones met most often
-- first. 'all' stays the shared vocabulary, so words a video added are not mixed into it.
drop function public.flashcard_deck(text, integer, text, text[]);
create function public.flashcard_deck(
  p_language text,
  p_limit integer default 20,
  p_source text default 'all',
  p_levels text[] default null
)
returns setof bigint
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_source is null or p_source not in ('all', 'favorites', 'learning', 'video') then
    raise exception 'Source must be all, favorites, learning or video'
      using errcode = '22023';
  end if;

  return query
  with round_size as (
    select least(greatest(coalesce(p_limit, 20), 1), 100) as n
  ),
  video_counts as (
    select word_video_counts.word_id, word_video_counts.occurrence_count
    from public.word_video_counts
    where p_source = 'video' and word_video_counts.owner_id = (select auth.uid())
  ),
  candidates as (
    select
      words.id,
      coalesce(user_word_state.status, 'new') = 'learning' as learning,
      -- Words met more often in videos come first; otherwise a random draw.
      case
        when p_source = 'video' then 1.0 / video_counts.occurrence_count
        else -ln(1 - random())
      end / (
        case coalesce(user_word_state.status, 'new')
          when 'learning' then least(1 + user_word_state.learning_count, 10)
          when 'mastered' then 0.25
          else 1
        end
        * case
          when user_word_state.last_reviewed_at > now() - interval '10 minutes' then 0.1
          else 1
        end
      ) as sort_key
    from public.words
    left join public.user_word_state
      on user_word_state.word_id = words.id
      and user_word_state.user_id = (select auth.uid())
    left join video_counts on video_counts.word_id = words.id
    where words.language = p_language
      and words.status = 'published'
      and (words.owner_id is null or words.owner_id = (select auth.uid()))
      and (coalesce(cardinality(p_levels), 0) = 0 or words.level = any(p_levels))
      and case p_source
        when 'favorites' then coalesce(user_word_state.favorited, false)
        when 'learning' then user_word_state.status = 'learning'
        when 'video' then video_counts.word_id is not null
        else words.owner_id is null
      end
  ),
  learning_picks as (
    select candidates.id
    from candidates
    where candidates.learning
    order by candidates.sort_key
    limit (select ceil(round_size.n / 2.0)::integer from round_size)
  ),
  round as (
    select candidates.id
    from candidates
    order by
      candidates.id in (select learning_picks.id from learning_picks) desc,
      candidates.sort_key
    limit (select round_size.n from round_size)
  )
  select round.id
  from round
  order by random();
end;
$$;
revoke execute on function public.flashcard_deck(text, integer, text, text[]) from public, anon;
grant execute on function public.flashcard_deck(text, integer, text, text[]) to authenticated;
