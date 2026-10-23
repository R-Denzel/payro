-- Restaurant accounts are separate memberships on shared Supabase Auth identities.
create type public.restaurant_role as enum ('owner', 'manager', 'staff');
create type public.restaurant_status as enum ('pending', 'approved', 'rejected');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  category text not null,
  location text not null,
  phone text not null,
  logo_url text,
  address text,
  accepted_payment_methods text[] not null default '{}',
  status public.restaurant_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.restaurant_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create or replace function public.is_restaurant_member(_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.restaurant_members m where m.restaurant_id = _restaurant_id and m.user_id = auth.uid());
$$;

create or replace function public.restaurant_role_for(_restaurant_id uuid)
returns public.restaurant_role language sql stable security definer set search_path = '' as $$
  select role from public.restaurant_members where restaurant_id = _restaurant_id and user_id = auth.uid() limit 1;
$$;
revoke all on function public.is_restaurant_member(uuid), public.restaurant_role_for(uuid) from public, anon;
grant execute on function public.is_restaurant_member(uuid), public.restaurant_role_for(uuid) to authenticated;

alter table public.expenses add column restaurant_id uuid references public.restaurants(id) on delete set null;
create index expenses_restaurant_idx on public.expenses(restaurant_id);

alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
grant select, update on public.restaurants to authenticated;
grant select on public.restaurant_members to authenticated;

-- Registration is atomic: a user can create a restaurant and only gain owner access
-- to the restaurant created by this invocation. New restaurants require approval.
create or replace function public.register_restaurant(
  _name text, _owner_name text, _category text, _location text, _phone text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare _restaurant_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if length(trim(_name)) < 2 or length(trim(_owner_name)) < 2 then raise exception 'Enter a valid business and owner name'; end if;
  insert into public.profiles(id, full_name) values (auth.uid(), trim(_owner_name))
  on conflict (id) do update set full_name = excluded.full_name;
  insert into public.restaurants(name, category, location, phone)
  values(trim(_name), trim(_category), trim(_location), trim(_phone)) returning id into _restaurant_id;
  insert into public.restaurant_members(restaurant_id, user_id, role) values(_restaurant_id, auth.uid(), 'owner');
  return _restaurant_id;
end;
$$;
revoke all on function public.register_restaurant(text,text,text,text,text) from public, anon;
grant execute on function public.register_restaurant(text,text,text,text,text) to authenticated;

-- Email confirmation may delay the first session; create the pending restaurant
-- from sign-up metadata so the owner can sign in after confirming their email.
create or replace function public.handle_restaurant_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
declare _restaurant_id uuid; _meta jsonb := new.raw_user_meta_data;
begin
  if nullif(trim(_meta ->> 'restaurant_name'), '') is null then return new; end if;
  insert into public.restaurants(name, category, location, phone)
  values(trim(_meta ->> 'restaurant_name'), coalesce(nullif(trim(_meta ->> 'restaurant_category'),''),'Restaurant'),
    coalesce(nullif(trim(_meta ->> 'restaurant_location'),''),'To be completed'),
    coalesce(nullif(trim(_meta ->> 'restaurant_phone'),''),'Pending')) returning id into _restaurant_id;
  insert into public.restaurant_members(restaurant_id,user_id,role) values(_restaurant_id,new.id,'owner');
  return new;
end;
$$;
create trigger on_restaurant_signup after insert on auth.users
for each row execute function public.handle_restaurant_signup();

create policy "members read restaurant profile" on public.restaurants for select to authenticated using (public.is_restaurant_member(id));
create policy "owners managers update restaurant profile" on public.restaurants for update to authenticated
 using (public.restaurant_role_for(id) in ('owner','manager')) with check (public.restaurant_role_for(id) in ('owner','manager'));
create policy "members read own restaurant membership" on public.restaurant_members for select to authenticated using (user_id = auth.uid() or public.is_restaurant_member(restaurant_id));

create or replace function public.protect_restaurant_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() <> 'service_role' and new.status is distinct from old.status then
    raise exception 'Only Payro administrators can change restaurant approval status' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger restaurant_approval_protected before update on public.restaurants
for each row execute function public.protect_restaurant_approval();

drop policy "read accessible expenses" on public.expenses;
create policy "read accessible expenses" on public.expenses for select to authenticated
 using (public.can_access_expense(id) or (restaurant_id is not null and public.is_restaurant_member(restaurant_id)));
drop policy "create own expenses" on public.expenses;
create policy "create own expenses" on public.expenses for insert to authenticated with check (
 creator_id = auth.uid() and (group_id is null or public.is_group_member(group_id))
 and (restaurant_id is null or (public.is_restaurant_member(restaurant_id)
   and public.restaurant_role_for(restaurant_id) in ('owner','manager')
   and exists(select 1 from public.restaurants r where r.id=restaurant_id and r.status='approved')))
);
drop policy "creator updates expense" on public.expenses;
create policy "creator updates expense" on public.expenses for update to authenticated
 using (creator_id = auth.uid() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id) and public.restaurant_role_for(restaurant_id) in ('owner','manager')))
 with check ((creator_id = auth.uid() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id) and public.restaurant_role_for(restaurant_id) in ('owner','manager')))
   and (restaurant_id is null or (public.is_restaurant_member(restaurant_id) and public.restaurant_role_for(restaurant_id) in ('owner','manager'))));
drop policy "creator deletes expense" on public.expenses;
create policy "creator deletes expense" on public.expenses for delete to authenticated
 using (creator_id = auth.uid() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id) and public.restaurant_role_for(restaurant_id) in ('owner','manager')));

create or replace function public.can_access_expense(_expense_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.expenses e where e.id = _expense_id and (
    e.creator_id = auth.uid() or (e.group_id is not null and public.is_group_member(e.group_id))
    or exists(select 1 from public.expense_participants p where p.expense_id=e.id and p.user_id=auth.uid())
    or (e.restaurant_id is not null and public.is_restaurant_member(e.restaurant_id))
  ));
$$;

create or replace function public.is_expense_creator(_expense_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.expenses e where e.id=_expense_id and (
   e.creator_id=auth.uid() or (e.restaurant_id is not null and public.is_restaurant_member(e.restaurant_id)
    and public.restaurant_role_for(e.restaurant_id) in ('owner','manager')
    and exists(select 1 from public.restaurants r where r.id=e.restaurant_id and r.status='approved'))
 ));
$$;
