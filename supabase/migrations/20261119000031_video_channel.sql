-- The YouTube channel each video comes from, so the library can show the videos of one channel.
-- Filtering goes by the id, which outlives a renamed channel; the name is what the page shows.
-- Videos processed before this have neither until scripts.backfill_video_channels fills them in.
alter table public.videos
  add column channel_id text,
  add column channel_name text;
