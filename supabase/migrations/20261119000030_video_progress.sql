-- How far each learner has watched each of their videos, so a video opens where they left it and
-- the library shows which are done. finished stays true once set: watching a finished video again
-- moves position_ms but keeps it marked.
create table public.video_progress (
  owner_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null references public.videos (id) on delete cascade,
  position_ms integer not null check (position_ms >= 0),
  finished boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, video_id)
);

alter table public.video_progress enable row level security;

create policy video_progress_owner_access
  on public.video_progress for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- The website saves the progress as the learner watches.
revoke all on table public.video_progress from anon, authenticated;
grant select, insert, update on table public.video_progress to authenticated;
