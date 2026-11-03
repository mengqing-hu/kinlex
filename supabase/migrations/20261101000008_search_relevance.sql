create or replace function public.search_words_fuzzy(
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
      greatest(
        extensions.similarity(lower(words.lemma), lower(btrim(p_query))),
        coalesce(
          (
            select max(
              extensions.similarity(lower(word_forms.form), lower(btrim(p_query)))
            )
            from public.word_forms
            where word_forms.word_id = words.id
          ),
          0
        )
      ) as search_score,
      lower(words.lemma) like '%' || lower(btrim(p_query)) || '%'
        or exists (
          select 1
          from public.word_forms
          where word_forms.word_id = words.id
            and lower(word_forms.form) like '%' || lower(btrim(p_query)) || '%'
        ) as contains_query
    from public.words
    where words.language = p_language
      and words.status = 'published'
      and btrim(p_query) <> ''
  )
  select
    ranked_words.id,
    ranked_words.language,
    ranked_words.entry_type,
    ranked_words.lemma,
    ranked_words.slug,
    ranked_words.pos,
    ranked_words.gender,
    ranked_words.plural,
    ranked_words.ipa,
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
