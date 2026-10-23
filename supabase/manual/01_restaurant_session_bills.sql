-- Restaurant session bill publishing (transactional, permissions checked)
-- Run only after the existing base, app_functions, and restaurant_portal migrations.
-- This adds a restaurant-to-session link and two protected RPCs. It does not change
-- existing rows or payment credentials.

begin;

create table if not exists public.restaurant_sessions (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  group_id uuid not null unique references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, group_id)
);

alter table public.restaurant_sessions enable row level security;
grant select on public.restaurant_sessions to authenticated;
drop policy if exists "restaurant members read their sessions" on public.restaurant_sessions;
create policy "restaurant members read their sessions"
  on public.restaurant_sessions for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create or replace function public.create_restaurant_session(_restaurant_id uuid, _name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if not public.is_restaurant_member(_restaurant_id) then
    raise exception 'You are not a member of this restaurant' using errcode = '42501';
  end if;
  if not exists (select 1 from public.restaurants r where r.id = _restaurant_id and r.status = 'approved') then
    raise exception 'Restaurant approval is required before creating sessions' using errcode = '42501';
  end if;
  if nullif(trim(_name), '') is null then
    raise exception 'Enter a name for this session';
  end if;
  insert into public.groups (name, created_by) values (trim(_name), auth.uid()) returning id into _group_id;
  insert into public.restaurant_sessions (restaurant_id, group_id, created_by)
  values (_restaurant_id, _group_id, auth.uid());
  return _group_id;
end;
$$;
revoke all on function public.create_restaurant_session(uuid, text) from public, anon;
grant execute on function public.create_restaurant_session(uuid, text) to authenticated;

create or replace function public.create_restaurant_bill(
  _restaurant_id uuid,
  _group_id uuid,
  _merchant text,
  _total_cents bigint,
  _participants jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _expense_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if not public.is_restaurant_member(_restaurant_id)
     or public.restaurant_role_for(_restaurant_id) not in ('owner', 'manager') then
    raise exception 'Only a restaurant owner or manager can publish a bill' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.restaurants r
    where r.id = _restaurant_id and r.status = 'approved'
  ) then
    raise exception 'Restaurant approval is required before publishing bills' using errcode = '42501';
  end if;

  if not public.is_group_member(_group_id) then
    raise exception 'You are not a member of this session' using errcode = '42501';
  end if;
  if not exists (select 1 from public.restaurant_sessions s
                 where s.restaurant_id = _restaurant_id and s.group_id = _group_id) then
    raise exception 'This session does not belong to this restaurant' using errcode = '42501';
  end if;

  if nullif(trim(_merchant), '') is null or _total_cents is null or _total_cents <= 0 then
    raise exception 'Enter a bill description and a valid total';
  end if;
  if _total_cents % 100 <> 0 then
    raise exception 'Restaurant bill totals must be in whole Kenyan shillings for M-Pesa';
  end if;
  if jsonb_typeof(coalesce(_participants, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Guest shares must be sent as a list';
  end if;
  if jsonb_array_length(coalesce(_participants, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one guest share';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_participants) as participant(value)
    where coalesce(participant.value ->> 'amount_due_cents', '') !~ '^[0-9]+$'
  ) then
    raise exception 'Each guest share needs a valid amount';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_participants) as participant(value)
    where (participant.value ->> 'amount_due_cents')::bigint <= 0
       or (participant.value ->> 'amount_due_cents')::bigint % 100 <> 0
  ) then
    raise exception 'Each restaurant share must be a positive whole-shilling amount';
  end if;
  if (select sum((participant.value ->> 'amount_due_cents')::bigint)
      from jsonb_array_elements(_participants) as participant(value)) <> _total_cents then
    raise exception 'Guest shares must add up to the restaurant bill total';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(_participants, '[]'::jsonb)) as participant(value)
    where nullif(participant.value ->> 'user_id', '')::uuid = auth.uid()
  ) then
    raise exception 'The restaurant account cannot be included as a guest share';
  end if;

  _expense_id := public.create_expense(
    jsonb_build_object(
      'group_id', _group_id,
      'merchant', trim(_merchant),
      'category', 'Dining',
      'currency', 'KES',
      'subtotal_cents', _total_cents,
      'service_cents', 0,
      'tax_cents', 0,
      'total_cents', _total_cents,
      'split_mode', 'equal'
    ),
    '[]'::jsonb,
    coalesce(_participants, '[]'::jsonb)
  );

  update public.expenses
  set restaurant_id = _restaurant_id
  where id = _expense_id;

  return _expense_id;
end;
$$;

revoke all on function public.create_restaurant_bill(uuid, uuid, text, bigint, jsonb)
  from public, anon;
grant execute on function public.create_restaurant_bill(uuid, uuid, text, bigint, jsonb)
  to authenticated;

commit;
