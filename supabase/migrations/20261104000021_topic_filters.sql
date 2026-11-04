-- The word list filtered by topic, including "other" for words without one, and the number of
-- words per topic. Both used to read every word-topic row through the API, which returns at
-- most 1000 rows, so large topics lost words and topics went missing from the filter.

drop function public.list_word_ids(
  text, text, boolean, text, text, text[], bigint[], integer, integer
);

-- As before, plus p_topic: a topic slug, 'other' for words without any topic, or null for all.
create function public.list_word_ids(
  p_language text,
  p_sort text,
  p_descending boolean,
  p_level text default null,
  p_query text default null,
  p_word_class_patterns text[] default null,
  p_word_ids bigint[] default null,
  p_topic text default null,
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
      and (
        p_topic is null
        or (p_topic = 'other') = not exists (
          select 1
          from public.word_tags
          join public.tags on tags.id = word_tags.tag_id
          where word_tags.word_id = words.id
            and tags.type = 'topic'
            and (p_topic = 'other' or tags.slug = p_topic)
        )
      )
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
  text, text, boolean, text, text, text[], bigint[], text, integer, integer
) from public;
grant execute on function public.list_word_ids(
  text, text, boolean, text, text, text[], bigint[], text, integer, integer
) to anon, authenticated;

create function public.topic_counts(p_language text)
returns table (id bigint, slug text, name text, icon text, word_count integer)
language sql
stable
set search_path = ''
as $$
  select tags.id, tags.slug, tags.name, tags.icon, count(words.id)::integer
  from public.tags
  left join public.word_tags on word_tags.tag_id = tags.id
  left join public.words
    on words.id = word_tags.word_id
    and words.language = p_language
    and words.status = 'published'
  where tags.type = 'topic'
  group by tags.id
  order by tags.name;
$$;

revoke execute on function public.topic_counts(text) from public;
grant execute on function public.topic_counts(text) to anon, authenticated;
