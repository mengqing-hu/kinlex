alter table public.words enable row level security;
alter table public.word_slug_redirects enable row level security;
alter table public.senses enable row level security;
alter table public.word_forms enable row level security;
alter table public.morphemes enable row level security;
alter table public.word_morphemes enable row level security;
alter table public.examples enable row level security;
alter table public.example_translations enable row level security;
alter table public.example_links enable row level security;
alter table public.audio enable row level security;
alter table public.tags enable row level security;
alter table public.word_tags enable row level security;
alter table public.word_embeddings enable row level security;

create policy words_read_published
  on public.words
  for select
  to anon, authenticated
  using (status = 'published');

create policy word_slug_redirects_read_published
  on public.word_slug_redirects
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.words
      where words.id = word_slug_redirects.word_id
        and words.status = 'published'
    )
  );

create policy senses_read_published
  on public.senses
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.words
      where words.id = senses.word_id
        and words.status = 'published'
    )
  );

create policy word_forms_read_published
  on public.word_forms
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.words
      where words.id = word_forms.word_id
        and words.status = 'published'
    )
  );

create policy morphemes_read_published
  on public.morphemes
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.word_morphemes
      join public.words on words.id = word_morphemes.word_id
      where word_morphemes.morpheme_id = morphemes.id
        and words.status = 'published'
    )
  );

create policy word_morphemes_read_published
  on public.word_morphemes
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.words
      where words.id = word_morphemes.word_id
        and words.status = 'published'
    )
  );

create policy examples_read_published
  on public.examples
  for select
  to anon, authenticated
  using (status = 'published');

create policy example_translations_read_published
  on public.example_translations
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.examples
      where examples.id = example_translations.example_id
        and examples.status = 'published'
    )
  );

create policy example_links_read_published
  on public.example_links
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.examples
      where examples.id = example_links.example_id
        and examples.status = 'published'
    )
  );

create policy audio_read_published
  on public.audio
  for select
  to anon, authenticated
  using (
    (
      owner_type = 'word'
      and exists (
        select 1
        from public.words
        where words.id = audio.owner_id
          and words.status = 'published'
      )
    )
    or (
      owner_type = 'example'
      and exists (
        select 1
        from public.examples
        where examples.id = audio.owner_id
          and examples.status = 'published'
      )
    )
  );

create policy tags_read_published
  on public.tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.word_tags
      join public.words on words.id = word_tags.word_id
      where word_tags.tag_id = tags.id
        and words.status = 'published'
    )
  );

create policy word_tags_read_published
  on public.word_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.words
      where words.id = word_tags.word_id
        and words.status = 'published'
    )
  );

revoke all on table
  public.words,
  public.word_slug_redirects,
  public.senses,
  public.word_forms,
  public.morphemes,
  public.word_morphemes,
  public.examples,
  public.example_translations,
  public.example_links,
  public.audio,
  public.tags,
  public.word_tags,
  public.word_embeddings
from anon, authenticated;

grant select on table
  public.words,
  public.word_slug_redirects,
  public.senses,
  public.word_forms,
  public.morphemes,
  public.word_morphemes,
  public.examples,
  public.example_translations,
  public.example_links,
  public.audio,
  public.tags,
  public.word_tags
to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_languages enable row level security;
alter table public.user_word_state enable row level security;
alter table public.activity_events enable row level security;
alter table public.daily_study_time enable row level security;
alter table public.user_stats enable row level security;
alter table public.user_language_stats enable row level security;
alter table public.feedback enable row level security;

create policy profiles_read_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy profiles_delete_own
  on public.profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_languages_manage_own
  on public.user_languages
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_word_state_manage_own
  on public.user_word_state
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy activity_events_read_own
  on public.activity_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy activity_events_insert_own
  on public.activity_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy daily_study_time_read_own
  on public.daily_study_time
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_stats_read_own
  on public.user_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_language_stats_read_own
  on public.user_language_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy feedback_insert
  on public.feedback
  for insert
  to anon, authenticated
  with check (user_id is null or (select auth.uid()) = user_id);

create policy feedback_read_own
  on public.feedback
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table
  public.profiles,
  public.user_languages,
  public.user_word_state,
  public.activity_events,
  public.daily_study_time,
  public.user_stats,
  public.user_language_stats,
  public.feedback
from anon, authenticated;

grant select, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table
  public.user_languages,
  public.user_word_state
to authenticated;
grant select on table public.activity_events to authenticated;
grant insert (
  user_id,
  client_event_id,
  language,
  event_type,
  target_type,
  target_id,
  value,
  occurred_at
) on public.activity_events to authenticated;
grant select on table
  public.daily_study_time,
  public.user_stats,
  public.user_language_stats
to authenticated;
grant select on table public.feedback to authenticated;
grant insert (user_id, word_id, message) on public.feedback to anon, authenticated;

grant usage on sequence public.activity_events_id_seq to authenticated;
grant usage on sequence public.feedback_id_seq to anon, authenticated;
