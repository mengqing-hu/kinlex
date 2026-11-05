-- Lets a learner start over on the words of one list: clear the familiarity or the favorites of
-- every word the list's filters match.

-- Every word id a word list's filters match, as one array, so a whole level or topic comes back
-- in a single value instead of running into the row cap on API responses. p_marked keeps only the
-- words the caller has given a familiarity ('familiarity') or marked as a favorite ('favorites').
create function public.list_all_word_ids(
  p_language text,
  p_level text default null,
  p_query text default null,
  p_word_class_patterns text[] default null,
  p_word_ids bigint[] default null,
  p_topic text default null,
  p_marked text default null
)
returns bigint[]
language plpgsql
stable
set search_path = ''
as $$
declare
  ids bigint[] := '{}';
  page bigint[];
begin
  if p_marked is not null and p_marked not in ('familiarity', 'favorites') then
    raise exception 'Marked must be familiarity or favorites'
      using errcode = '22023';
  end if;

  -- list_word_ids hands out at most 101 ids a call, so page through it.
  loop
    page := array(
      select id
      from public.list_word_ids(
        p_language,
        'frequency',
        false,
        p_level,
        p_query,
        p_word_class_patterns,
        p_word_ids,
        p_topic,
        coalesce(array_length(ids, 1), 0),
        101
      ) as id
    );
    ids := ids || page;
    exit when coalesce(array_length(page, 1), 0) < 101;
  end loop;

  if p_marked is null then
    return ids;
  end if;

  return coalesce((
    select array_agg(word_id)
    from public.user_word_state
    where user_id = (select auth.uid())
      and word_id = any (ids)
      and case p_marked when 'familiarity' then familiarity > 0 else favorited end
  ), '{}');
end;
$$;

revoke execute on function public.list_all_word_ids(
  text, text, text, text[], bigint[], text, text
) from public;
grant execute on function public.list_all_word_ids(
  text, text, text, text[], bigint[], text, text
) to anon, authenticated;

-- Clears the caller's familiarity ('familiarity') or favorite mark ('favorites') on the given
-- words and returns the ids that changed. Runs as the caller, so it only reaches their own rows.
create function public.reset_word_state(p_field text, p_word_ids bigint[])
returns bigint[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  changed bigint[];
begin
  if p_field = 'familiarity' then
    with updated as (
      update public.user_word_state
      set familiarity = 0
      where user_id = (select auth.uid())
        and word_id = any (p_word_ids)
        and familiarity > 0
      returning word_id
    )
    select coalesce(array_agg(word_id), '{}') into changed from updated;
  elsif p_field = 'favorites' then
    with updated as (
      update public.user_word_state
      set favorited = false
      where user_id = (select auth.uid())
        and word_id = any (p_word_ids)
        and favorited
      returning word_id
    )
    select coalesce(array_agg(word_id), '{}') into changed from updated;
  else
    raise exception 'Field must be familiarity or favorites'
      using errcode = '22023';
  end if;

  return changed;
end;
$$;

revoke execute on function public.reset_word_state(text, bigint[]) from public;
grant execute on function public.reset_word_state(text, bigint[]) to authenticated;
