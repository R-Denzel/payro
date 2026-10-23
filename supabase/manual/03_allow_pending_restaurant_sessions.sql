-- Allow newly registered (pending) restaurants to create group sessions.
-- Restaurant membership and sign-in are still required. Rejected restaurants
-- cannot create new sessions. Bill publishing keeps its approval requirement.
-- Run this in the Payro Supabase SQL Editor after 01_restaurant_session_bills.sql.

create or replace function public.create_restaurant_session(_restaurant_id uuid, _name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if not public.is_restaurant_member(_restaurant_id) then
    raise exception 'You are not a member of this restaurant' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.restaurants r
    where r.id = _restaurant_id
      and r.status in ('pending', 'approved')
  ) then
    raise exception 'This restaurant account is not eligible to create sessions' using errcode = '42501';
  end if;

  if nullif(trim(_name), '') is null then
    raise exception 'Enter a name for this session';
  end if;

  insert into public.groups (name, created_by)
  values (trim(_name), auth.uid())
  returning id into _group_id;

  insert into public.restaurant_sessions (restaurant_id, group_id, created_by)
  values (_restaurant_id, _group_id, auth.uid());

  return _group_id;
end;
$$;

revoke all on function public.create_restaurant_session(uuid, text) from public, anon;
grant execute on function public.create_restaurant_session(uuid, text) to authenticated;
