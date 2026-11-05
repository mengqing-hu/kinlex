-- Uploaded profile pictures. The files live in a public storage bucket, one folder per user named
-- after the user id; the profile keeps the path of the current one.

alter table public.profiles
  add column avatar_path text check (avatar_path is null or btrim(avatar_path) <> '');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/png', 'image/jpeg']);

create policy avatars_read_own
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete_own
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
