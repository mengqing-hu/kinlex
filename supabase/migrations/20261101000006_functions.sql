create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger set_words_updated_at
  before update on public.words
  for each row execute function public.set_updated_at();

create trigger set_user_word_state_updated_at
  before update on public.user_word_state
  for each row execute function public.set_updated_at();

create trigger set_user_stats_updated_at
  before update on public.user_stats
  for each row execute function public.set_updated_at();

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
  select words.*
  from public.words
  where words.language = p_language
    and words.status = 'published'
    and btrim(p_query) <> ''
  order by greatest(
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
  ) desc,
  words.freq_rank asc nulls last,
  words.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.search_words_fuzzy(text, text, integer) from public;
grant execute on function public.search_words_fuzzy(text, text, integer)
  to anon, authenticated;

create or replace function public.refresh_user_stats(
  p_user_id uuid,
  p_today date
)
returns public.user_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stats public.user_stats;
begin
  if p_user_id is null or p_today is null then
    raise exception 'User ID and current date are required'
      using errcode = '22004';
  end if;

  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'Cannot refresh statistics for another user'
      using errcode = '42501';
  end if;

  with active_dates as (
    select distinct daily_study_time.date
    from public.daily_study_time
    where daily_study_time.user_id = p_user_id
      and (
        daily_study_time.active_seconds > 0
        or daily_study_time.words_viewed > 0
      )
  ),
  grouped_dates as (
    select
      active_dates.date,
      active_dates.date
        - row_number() over (order by active_dates.date)::integer as group_id
    from active_dates
  ),
  streaks as (
    select
      min(grouped_dates.date) as start_date,
      max(grouped_dates.date) as end_date,
      count(*)::integer as day_count
    from grouped_dates
    group by grouped_dates.group_id
  ),
  summary as (
    select
      (select count(*)::integer from active_dates) as total_days,
      coalesce(
        max(streaks.day_count) filter (
          where streaks.end_date between p_today - 1 and p_today
        ),
        0
      )::integer as current_streak,
      coalesce(max(streaks.day_count), 0)::integer as longest_streak
    from streaks
  )
  insert into public.user_stats (
    user_id,
    total_days,
    current_streak,
    longest_streak
  )
  select
    p_user_id,
    summary.total_days,
    summary.current_streak,
    summary.longest_streak
  from summary
  on conflict (user_id) do update
  set total_days = excluded.total_days,
      current_streak = excluded.current_streak,
      longest_streak = excluded.longest_streak
  returning * into v_stats;

  return v_stats;
end;
$$;

revoke execute on function public.refresh_user_stats(uuid, date)
  from public, anon, authenticated;

create or replace function public.update_daily_study_time(
  p_user_id uuid,
  p_date date,
  p_language text,
  p_active_seconds integer default 0,
  p_words_viewed integer default 0
)
returns public.daily_study_time
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daily_study_time public.daily_study_time;
  v_today date;
begin
  if p_user_id is null or p_date is null then
    raise exception 'User ID and study date are required'
      using errcode = '22004';
  end if;

  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'Cannot update study time for another user'
      using errcode = '42501';
  end if;

  if p_language is null or p_language !~ '^[a-z]{2,3}$' then
    raise exception 'Language must be a two- or three-letter lowercase code'
      using errcode = '22023';
  end if;

  if p_active_seconds < 0 or p_words_viewed < 0 then
    raise exception 'Study time increments cannot be negative'
      using errcode = '22023';
  end if;

  select (now() at time zone profiles.timezone)::date
  into v_today
  from public.profiles
  where profiles.user_id = p_user_id;

  if v_today is null then
    raise exception 'User profile does not exist'
      using errcode = 'P0002';
  end if;

  insert into public.daily_study_time (
    user_id,
    date,
    language,
    active_seconds,
    words_viewed
  )
  values (
    p_user_id,
    p_date,
    p_language,
    p_active_seconds,
    p_words_viewed
  )
  on conflict (user_id, date, language) do update
  set active_seconds = daily_study_time.active_seconds + excluded.active_seconds,
      words_viewed = daily_study_time.words_viewed + excluded.words_viewed
  returning * into v_daily_study_time;

  perform public.refresh_user_stats(p_user_id, v_today);

  return v_daily_study_time;
end;
$$;

revoke execute on function public.update_daily_study_time(
  uuid,
  date,
  text,
  integer,
  integer
) from public, anon;
grant execute on function public.update_daily_study_time(
  uuid,
  date,
  text,
  integer,
  integer
) to authenticated;
