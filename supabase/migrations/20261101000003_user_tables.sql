create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or btrim(display_name) <> ''),
  native_language text not null default 'en'
    check (native_language ~ '^[a-z]{2,3}$'),
  ui_language text not null default 'en'
    check (ui_language ~ '^[a-z]{2,3}$'),
  timezone text not null default 'Europe/Berlin'
    check (btrim(timezone) <> ''),
  profile_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_languages (
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  level text check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  started_at timestamptz not null default now(),
  primary key (user_id, language)
);

create table public.user_word_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id bigint not null references public.words (id) on delete cascade,
  favorited boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'learning', 'mastered')),
  due_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create index user_word_state_favorites_idx
  on public.user_word_state (user_id, word_id)
  where favorited;

create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_event_id uuid not null,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  event_type text not null
    check (
      event_type in (
        'view_word',
        'play_audio',
        'favorite',
        'unfavorite',
        'self_test',
        'study_heartbeat'
      )
    ),
  target_type text,
  target_id bigint check (target_id is null or target_id > 0),
  value integer,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create index activity_events_user_received_idx
  on public.activity_events (user_id, received_at desc);

create table public.daily_study_time (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  active_seconds integer not null default 0 check (active_seconds >= 0),
  words_viewed integer not null default 0 check (words_viewed >= 0),
  primary key (user_id, date, language)
);

create index daily_study_time_user_date_idx
  on public.daily_study_time (user_id, date desc);

create table public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_days integer not null default 0 check (total_days >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  updated_at timestamptz not null default now(),
  check (current_streak <= longest_streak)
);

create table public.user_language_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  words_mastered integer not null default 0 check (words_mastered >= 0),
  roots_mastered integer not null default 0 check (roots_mastered >= 0),
  primary key (user_id, language)
);

create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  word_id bigint references public.words (id) on delete set null,
  message text not null check (btrim(message) <> ''),
  created_at timestamptz not null default now()
);

create index feedback_user_created_idx
  on public.feedback (user_id, created_at desc)
  where user_id is not null;

create index feedback_word_id_idx
  on public.feedback (word_id)
  where word_id is not null;
