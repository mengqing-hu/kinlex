-- The word list filter needs the distinct word classes. Selecting every word and deduplicating in
-- the client stops at the API row limit (1000), which left only the first class in the filter.

create function public.word_class_options(p_language text)
returns setof text
language sql
stable
set search_path = ''
as $$
  select distinct words.word_class
  from public.words
  where words.language = p_language
    and words.status = 'published'
  order by words.word_class;
$$;

revoke execute on function public.word_class_options(text) from public;
grant execute on function public.word_class_options(text) to anon, authenticated;
