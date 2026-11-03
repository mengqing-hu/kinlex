create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  delete from auth.users where id = current_user_id;
end;
$$;

revoke execute on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;
