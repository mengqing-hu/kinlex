-- How many words each word list filter option holds, within the page the list is on: the words of
-- a root, the favorites, a topic or a level. The level options count across every level, since
-- choosing one moves to that level's page.

create function public.word_filter_counts(
  p_language text,
  p_level text default null,
  p_topic text default null,
  p_word_ids bigint[] default null
)
returns table (facet text, value text, word_count integer)
language sql
stable
set search_path = ''
as $$
  with scoped as (
    select words.id, words.level, words.word_class
    from public.words
    where words.language = p_language
      and words.status = 'published'
      and (p_word_ids is null or words.id = any (p_word_ids))
      and (
        p_topic is null
        or exists (
          select 1
          from public.word_tags
          join public.tags on tags.id = word_tags.tag_id
          where word_tags.word_id = words.id
            and tags.type = 'topic'
            and tags.slug = p_topic
        )
      )
  ),
  leveled as (
    select scoped.id, scoped.word_class
    from scoped
    where p_level is null or scoped.level = p_level
  ),
  word_topics as (
    select word_tags.word_id, tags.slug
    from public.word_tags
    join public.tags on tags.id = word_tags.tag_id
    where tags.type = 'topic'
  )
  select 'level', scoped.level, count(*)::integer
  from scoped
  group by scoped.level
  union all
  select 'word_class', leveled.word_class, count(*)::integer
  from leveled
  group by leveled.word_class
  union all
  -- Words without any topic are counted as 'other'.
  select 'topic', coalesce(word_topics.slug, 'other'), count(*)::integer
  from leveled
  left join word_topics on word_topics.word_id = leveled.id
  group by coalesce(word_topics.slug, 'other');
$$;

revoke execute on function public.word_filter_counts(text, text, text, bigint[]) from public;
grant execute on function public.word_filter_counts(text, text, text, bigint[]) to anon, authenticated;
