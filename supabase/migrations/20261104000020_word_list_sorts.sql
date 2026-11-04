-- How often and how recently a learner opened each word, kept up to date from the view_word events
-- the site already records, so the word list can sort by them. Also a function that sorts the word
-- list by these and the other per-learner values, which PostgREST cannot order words by.

alter table public.user_word_state
  add column view_count integer not null default 0 check (view_count >= 0),
  add column last_viewed_at timestamptz;

create function public.count_word_view()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Events can name words that were removed since; those have nothing to count against.
  if new.event_type <> 'view_word'
    or new.target_type is distinct from 'word'
    or not exists (select 1 from public.words where words.id = new.target_id)
  then
    return new;
  end if;

  insert into public.user_word_state (user_id, word_id, view_count, last_viewed_at)
  values (new.user_id, new.target_id, 1, new.occurred_at)
  on conflict (user_id, word_id) do update
  set view_count = user_word_state.view_count + 1,
      last_viewed_at = greatest(user_word_state.last_viewed_at, excluded.last_viewed_at);

  return new;
end;
$$;

revoke execute on function public.count_word_view() from public, anon, authenticated;

create trigger count_word_view
  after insert on public.activity_events
  for each row execute function public.count_word_view();

insert into public.user_word_state (user_id, word_id, view_count, last_viewed_at)
select activity_events.user_id, activity_events.target_id, count(*), max(activity_events.occurred_at)
from public.activity_events
join public.words on words.id = activity_events.target_id
where activity_events.event_type = 'view_word'
  and activity_events.target_type = 'word'
group by activity_events.user_id, activity_events.target_id
on conflict (user_id, word_id) do update
set view_count = excluded.view_count,
    last_viewed_at = excluded.last_viewed_at;

-- One page of the word list in a sort order other than the default (most common first, which
-- the site pages through by frequency rank instead). The caller resolves topic, root and favorite
-- filters to p_word_ids beforehand (null means no such filter). p_sort is one of 'frequency',
-- 'views', 'familiarity', 'last_viewed', 'mistakes' and 'alphabetical'; ties fall back to the
-- default order. Words without a frequency rank count as the rarest. Per-learner values only count for the signed-in user, so a guest gets zeros.
create function public.list_word_ids(
  p_language text,
  p_sort text,
  p_descending boolean,
  p_level text default null,
  p_query text default null,
  p_word_class_patterns text[] default null,
  p_word_ids bigint[] default null,
  p_offset integer default 0,
  p_limit integer default 20
)
returns setof bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_sort is null
    or p_sort not in ('frequency', 'views', 'familiarity', 'last_viewed', 'mistakes', 'alphabetical')
  then
    raise exception 'Unknown sort %', p_sort
      using errcode = '22023';
  end if;

  return query
  with ranked as (
    select
      words.id,
      words.freq_rank,
      case p_sort
        when 'frequency' then coalesce(words.freq_rank, 2147483647)
        when 'views' then coalesce(user_word_state.view_count, 0)
        when 'familiarity' then coalesce(user_word_state.familiarity, 0)
        when 'mistakes' then coalesce(user_word_state.learning_count, 0)
      end as number_key,
      case p_sort
        when 'last_viewed' then user_word_state.last_viewed_at
      end as time_key,
      case p_sort
        when 'alphabetical'
          then regexp_replace(words.word, '^(der|die|das|sich) ', '', 'i') collate "de-x-icu"
      end as text_key
    from public.words
    -- Defined as security definer for guests, who may not read user_word_state; the join is
    -- limited to the caller's own rows.
    left join public.user_word_state
      on user_word_state.word_id = words.id
      and user_word_state.user_id = (select auth.uid())
    where words.language = p_language
      and words.status = 'published'
      and (p_level is null or words.level = p_level)
      and (p_query is null or words.word ilike '%' || p_query || '%')
      and (
        p_word_class_patterns is null
        or words.word_class ilike any (p_word_class_patterns)
      )
      and (p_word_ids is null or words.id = any (p_word_ids))
  )
  select ranked.id
  from ranked
  order by
    case when not p_descending then ranked.number_key end asc,
    case when p_descending then ranked.number_key end desc,
    -- Words never opened stay last whichever way the list runs.
    ranked.time_key is null,
    case when not p_descending then ranked.time_key end asc,
    case when p_descending then ranked.time_key end desc,
    case when not p_descending then ranked.text_key end asc,
    case when p_descending then ranked.text_key end desc,
    ranked.freq_rank asc nulls last,
    -- Without frequency ranks the default order is the vocabulary's own (by id), so reversing
    -- the default order has to reverse that too.
    case when p_sort = 'frequency' and p_descending then ranked.id end desc,
    ranked.id asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 101);
end;
$$;

revoke execute on function public.list_word_ids(
  text, text, boolean, text, text, text[], bigint[], integer, integer
) from public;
grant execute on function public.list_word_ids(
  text, text, boolean, text, text, text[], bigint[], integer, integer
) to anon, authenticated;
