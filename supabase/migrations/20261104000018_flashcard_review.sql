-- Flashcard results per word. status holds the latest answer: 'learning' after "still learning",
-- 'mastered' after "know". The counts weight how often the word is drawn again.

alter table public.user_word_state
  add column know_count integer not null default 0 check (know_count >= 0),
  add column learning_count integer not null default 0 check (learning_count >= 0),
  add column last_reviewed_at timestamptz;

-- Draws a round of published words for the current user, in random order. Up to half the round
-- is words still being learned: weights alone cannot do this, because those words are a handful
-- among thousands. The rest is unseen words, with known words drawn rarely. Words answered in the
-- last ten minutes are pushed back so a new round does not repeat the one just finished. Sorting
-- by -ln(u) / weight and keeping the first rows is a weighted sample without replacement.
create function public.flashcard_deck(p_language text, p_limit integer default 20)
returns setof bigint
language sql
volatile
set search_path = ''
as $$
  with round_size as (
    select least(greatest(coalesce(p_limit, 20), 1), 100) as n
  ),
  candidates as (
    select
      words.id,
      coalesce(user_word_state.status, 'new') = 'learning' as learning,
      -ln(1 - random()) / (
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
    where words.language = p_language
      and words.status = 'published'
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
$$;

revoke execute on function public.flashcard_deck(text, integer) from public, anon;
grant execute on function public.flashcard_deck(text, integer) to authenticated;

-- Records one flashcard answer. An upsert from the client cannot increment a count, so this runs
-- the insert-or-increment in one statement.
create function public.record_flashcard_review(p_word_id bigint, p_result text)
returns public.user_word_state
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_state public.user_word_state;
begin
  if v_user_id is null then
    raise exception 'Sign in to review flashcards'
      using errcode = '42501';
  end if;

  if p_result is null or p_result not in ('know', 'learning') then
    raise exception 'Result must be know or learning'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.words
    where words.id = p_word_id
      and words.status = 'published'
  ) then
    raise exception 'Word does not exist'
      using errcode = 'P0002';
  end if;

  insert into public.user_word_state (
    user_id,
    word_id,
    status,
    know_count,
    learning_count,
    last_reviewed_at
  )
  values (
    v_user_id,
    p_word_id,
    case p_result when 'know' then 'mastered' else 'learning' end,
    case p_result when 'know' then 1 else 0 end,
    case p_result when 'learning' then 1 else 0 end,
    now()
  )
  on conflict (user_id, word_id) do update
  set status = excluded.status,
      know_count = user_word_state.know_count + excluded.know_count,
      learning_count = user_word_state.learning_count + excluded.learning_count,
      last_reviewed_at = excluded.last_reviewed_at
  returning * into v_state;

  return v_state;
end;
$$;

revoke execute on function public.record_flashcard_review(bigint, text) from public, anon;
grant execute on function public.record_flashcard_review(bigint, text) to authenticated;
