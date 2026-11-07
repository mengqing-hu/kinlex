-- Word part meanings in the other languages a learner can use the site in, translated from the
-- English one. English stays in morphemes.morpheme_meaning, which the pipeline writes while
-- segmenting, and is what the site shows when a language has no meaning here yet.

create table public.morpheme_meanings (
  morpheme_id bigint not null references public.morphemes (id) on delete cascade,
  meaning_language text not null check (meaning_language ~ '^[a-z]{2,3}$' and meaning_language <> 'en'),
  meaning text not null check (btrim(meaning) <> ''),
  -- The English meaning it was translated from, so a changed English meaning is translated again.
  source_meaning text not null,
  primary key (morpheme_id, meaning_language)
);

alter table public.morpheme_meanings enable row level security;

create policy morpheme_meanings_read_published
  on public.morpheme_meanings
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.word_morphemes
      join public.words on words.id = word_morphemes.word_id
      where word_morphemes.morpheme_id = morpheme_meanings.morpheme_id
        and words.status = 'published'
    )
  );

create policy morpheme_meanings_server_only
  on public.morpheme_meanings as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

revoke all on table public.morpheme_meanings from anon, authenticated;
grant select on table public.morpheme_meanings to anon, authenticated;
