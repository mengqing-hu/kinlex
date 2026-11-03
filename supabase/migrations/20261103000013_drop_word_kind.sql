-- word_kind is no longer generated or stored; word_class already marks multi-word expressions.
-- The search function returns the words row type, so it is recreated around the column drop.

drop function if exists public.search_words_fuzzy(text, text, integer);

alter table public.words drop column word_kind;

create function public.search_words_fuzzy(
  p_language text,
  p_query text,
  p_limit integer default 20
)
returns setof public.words
language sql
stable
set search_path = ''
as $$
  with ranked_words as (
    select
      words.*,
      extensions.similarity(lower(words.word), lower(btrim(p_query))) as search_score,
      lower(words.word) like '%' || lower(btrim(p_query)) || '%' as contains_query
    from public.words
    where words.language = p_language
      and words.status = 'published'
      and btrim(p_query) <> ''
  )
  select
    ranked_words.id,
    ranked_words.language,
    ranked_words.word,
    ranked_words.slug,
    ranked_words.word_class,
    ranked_words.gender,
    ranked_words.plural,
    ranked_words.level,
    ranked_words.level_source,
    ranked_words.freq_rank,
    ranked_words.status,
    ranked_words.source,
    ranked_words.model_info,
    ranked_words.created_at,
    ranked_words.updated_at
  from ranked_words
  where ranked_words.contains_query or ranked_words.search_score >= 0.2
  order by
    ranked_words.contains_query desc,
    ranked_words.search_score desc,
    ranked_words.freq_rank asc nulls last,
    ranked_words.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.search_words_fuzzy(text, text, integer) from public;
grant execute on function public.search_words_fuzzy(text, text, integer)
  to anon, authenticated;
