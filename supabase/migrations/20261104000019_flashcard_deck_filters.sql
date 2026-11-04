-- Lets a flashcard round be drawn from part of the vocabulary: the learner's favorites or the
-- words they are still learning, and only some levels. The weighting is unchanged.

drop function public.flashcard_deck(text, integer);

-- p_source is 'all', 'favorites' or 'learning'; p_levels limits the round to those levels, and
-- null or an empty array means every level.
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
  if p_source is null or p_source not in ('all', 'favorites', 'learning') then
    raise exception 'Source must be all, favorites or learning'
      using errcode = '22023';
  end if;

  return query
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
      and (coalesce(cardinality(p_levels), 0) = 0 or words.level = any(p_levels))
      and case p_source
        when 'favorites' then coalesce(user_word_state.favorited, false)
        when 'learning' then user_word_state.status = 'learning'
        else true
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
