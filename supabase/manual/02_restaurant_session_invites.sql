-- Secure, shareable restaurant-session invitations.
-- Run after 01_restaurant_session_bills.sql. Invite tokens expire after 14 days,
-- are stored only as hashes, and allow up to 100 new members.

begin;

create table if not exists public.restaurant_session_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  group_id uuid not null,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  use_count integer not null default 0 check (use_count >= 0),
  max_uses integer not null default 100 check (max_uses > 0),
  foreign key (restaurant_id, group_id)
    references public.restaurant_sessions(restaurant_id, group_id) on delete cascade
);

alter table public.restaurant_session_invites enable row level security;
revoke all on public.restaurant_session_invites from anon, authenticated;
revoke all on public.restaurant_session_invites from public;

-- A new token replaces earlier active links for the same session.
create or replace function public.create_restaurant_session_invite(_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _restaurant_id uuid;
  _token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select s.restaurant_id into _restaurant_id
  from public.restaurant_sessions s
  where s.group_id = _group_id
  for update;

  if _restaurant_id is null
     or not public.is_restaurant_member(_restaurant_id)
     or not public.is_group_admin(_group_id) then
    raise exception 'Only a session administrator can create its invite' using errcode = '42501';
  end if;

  update public.restaurant_session_invites
  set revoked_at = now()
  where group_id = _group_id and revoked_at is null;

  _token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/', '-_'
  );

  insert into public.restaurant_session_invites (
    restaurant_id, group_id, token_hash, created_by
  ) values (
    _restaurant_id, _group_id,
    encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex'),
    auth.uid()
  );

  return _token;
end;
$$;

revoke all on function public.create_restaurant_session_invite(uuid) from public, anon;
grant execute on function public.create_restaurant_session_invite(uuid) to authenticated;

-- Public preview exposes only the session and restaurant names, never member data.
create or replace function public.get_restaurant_session_invite(_token text)
returns table (session_name text, restaurant_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, r.name, i.expires_at
  from public.restaurant_session_invites i
  join public.groups g on g.id = i.group_id
  join public.restaurants r on r.id = i.restaurant_id
  where i.token_hash = encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex')
    and i.revoked_at is null
    and i.expires_at > now()
    and i.use_count < i.max_uses
    and r.status = 'approved'
  limit 1;
$$;

revoke all on function public.get_restaurant_session_invite(text) from public;
grant execute on function public.get_restaurant_session_invite(text) to anon, authenticated;

-- Joining is authenticated and serialized per invite so its usage cap cannot be raced.
create or replace function public.join_restaurant_session(_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _invite public.restaurant_session_invites%rowtype;
  _rows integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join this session' using errcode = '42501';
  end if;
  if _token is null or length(_token) > 100 then
    raise exception 'This session invite is invalid or expired';
  end if;

  select * into _invite
  from public.restaurant_session_invites i
  where i.token_hash = encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex')
  for update;

  if not found or _invite.revoked_at is not null or _invite.expires_at <= now()
     or _invite.use_count >= _invite.max_uses
     or not exists (
       select 1 from public.restaurants r
       where r.id = _invite.restaurant_id and r.status = 'approved'
     ) then
    raise exception 'This session invite is invalid or expired';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (_invite.group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;
  get diagnostics _rows = row_count;

  if _rows > 0 then
    update public.restaurant_session_invites
    set use_count = use_count + 1
    where id = _invite.id;
  end if;

  return _invite.group_id;
end;
$$;

revoke all on function public.join_restaurant_session(text) from public, anon;
grant execute on function public.join_restaurant_session(text) to authenticated;

commit;
