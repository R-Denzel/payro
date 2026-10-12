-- Payro initial schema: profiles, roles, groups, expenses, splits, payments, share links, notifications.
-- Money is stored as integer minor units (cents), matching src/lib/split-store.ts.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'support', 'user');
create type public.group_role as enum ('admin', 'member');
create type public.split_mode as enum ('items', 'equal', 'custom');
create type public.expense_status as enum ('draft', 'open', 'settled');
create type public.participant_status as enum ('pending', 'reminded', 'paid');
create type public.payment_status as enum ('pending', 'success', 'failed', 'cancelled');
create type public.payment_provider as enum ('mpesa', 'airtel', 'mtn', 'card', 'cash');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text unique,
  avatar_url text,
  country text not null default 'KE',
  currency text not null default 'KES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Create a profile row automatically on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- App-level roles (kept off profiles so users can't grant themselves roles)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- Security-definer membership checks avoid recursive RLS on group_members.
create or replace function public.is_group_member(_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Creator becomes group admin automatically.
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_group_created
after insert on public.groups
for each row execute function public.handle_new_group();

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete set null,
  creator_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  merchant text not null default '',
  currency text not null default 'KES',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  service_cents bigint not null default 0 check (service_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  split_mode public.split_mode not null default 'equal',
  status public.expense_status not null default 'draft',
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_group_idx on public.expenses (group_id);
create index expenses_creator_idx on public.expenses (creator_id);

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  name text not null,
  price_cents bigint not null check (price_cents >= 0),
  qty integer not null default 1 check (qty > 0),
  created_at timestamptz not null default now()
);

create index expense_items_expense_idx on public.expense_items (expense_id);

-- A participant is either a registered user or a guest (name/phone) invited via link.
create table public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  guest_name text,
  guest_phone text,
  share_weight numeric not null default 1 check (share_weight >= 0),
  amount_due_cents bigint not null default 0 check (amount_due_cents >= 0),
  amount_paid_cents bigint not null default 0 check (amount_paid_cents >= 0),
  status public.participant_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_identity check (user_id is not null or guest_name is not null),
  constraint participant_user_unique unique (expense_id, user_id)
);

create index expense_participants_user_idx on public.expense_participants (user_id);

create trigger expense_participants_set_updated_at
before update on public.expense_participants
for each row execute function public.set_updated_at();

create table public.item_claims (
  item_id uuid not null references public.expense_items (id) on delete cascade,
  participant_id uuid not null references public.expense_participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, participant_id)
);

-- Can the current user see/act on this expense? (creator, participant, or group member)
create or replace function public.can_access_expense(_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = _expense_id
      and (
        e.creator_id = auth.uid()
        or (e.group_id is not null and public.is_group_member(e.group_id))
        or exists (
          select 1 from public.expense_participants p
          where p.expense_id = e.id and p.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_expense_creator(_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expenses where id = _expense_id and creator_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Payments (written by server/webhooks with the service role, read by users)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete restrict,
  participant_id uuid references public.expense_participants (id) on delete set null,
  payer_id uuid references public.profiles (id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'KES',
  provider public.payment_provider not null,
  provider_ref text,
  idempotency_key text not null unique,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_expense_idx on public.payments (expense_id);
create index payments_payer_idx on public.payments (payer_id);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Share links (public claim links resolve by opaque token only)
-- ---------------------------------------------------------------------------
create table public.share_links (
  token text primary key default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_participants enable row level security;
alter table public.item_claims enable row level security;
alter table public.payments enable row level security;
alter table public.share_links enable row level security;
alter table public.notifications enable row level security;

-- profiles: anyone signed in can read (needed to show group members); only self can update.
create policy "profiles readable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- user_roles: users see their own roles; admins see all. Writes only via service role.
create policy "users read own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- groups
create policy "members read groups"
  on public.groups for select to authenticated
  using (created_by = auth.uid() or public.is_group_member(id));
create policy "users create groups"
  on public.groups for insert to authenticated
  with check (created_by = auth.uid());
create policy "admins update groups"
  on public.groups for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "admins delete groups"
  on public.groups for delete to authenticated
  using (public.is_group_admin(id));

-- group_members
create policy "members read membership"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy "admins add members"
  on public.group_members for insert to authenticated
  with check (public.is_group_admin(group_id));
create policy "admins update members"
  on public.group_members for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "admins remove members or self leave"
  on public.group_members for delete to authenticated
  using (public.is_group_admin(group_id) or user_id = auth.uid());

-- expenses
create policy "read accessible expenses"
  on public.expenses for select to authenticated
  using (public.can_access_expense(id));
create policy "create own expenses"
  on public.expenses for insert to authenticated
  with check (
    creator_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );
create policy "creator updates expense"
  on public.expenses for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "creator deletes expense"
  on public.expenses for delete to authenticated
  using (creator_id = auth.uid());

-- expense_items
create policy "read items of accessible expenses"
  on public.expense_items for select to authenticated
  using (public.can_access_expense(expense_id));
create policy "creator manages items"
  on public.expense_items for all to authenticated
  using (public.is_expense_creator(expense_id))
  with check (public.is_expense_creator(expense_id));

-- expense_participants
create policy "read participants of accessible expenses"
  on public.expense_participants for select to authenticated
  using (public.can_access_expense(expense_id));
create policy "creator manages participants"
  on public.expense_participants for all to authenticated
  using (public.is_expense_creator(expense_id))
  with check (public.is_expense_creator(expense_id));

-- item_claims: participants claim their own items; creator can manage all.
create policy "read claims of accessible expenses"
  on public.item_claims for select to authenticated
  using (
    exists (
      select 1 from public.expense_items i
      where i.id = item_id and public.can_access_expense(i.expense_id)
    )
  );
create policy "participants manage own claims"
  on public.item_claims for all to authenticated
  using (
    exists (
      select 1 from public.expense_participants p
      where p.id = participant_id
        and (p.user_id = auth.uid() or public.is_expense_creator(p.expense_id))
    )
  )
  with check (
    exists (
      select 1 from public.expense_participants p
      join public.expense_items i on i.expense_id = p.expense_id
      where p.id = participant_id
        and i.id = item_id
        and (p.user_id = auth.uid() or public.is_expense_creator(p.expense_id))
    )
  );

-- payments: read-only to users; inserts/updates come from the server (service role).
create policy "read own or expense payments"
  on public.payments for select to authenticated
  using (payer_id = auth.uid() or public.is_expense_creator(expense_id));

-- share_links: creator manages; public resolution goes through a server function.
create policy "creator manages share links"
  on public.share_links for all to authenticated
  using (created_by = auth.uid() and public.is_expense_creator(expense_id))
  with check (created_by = auth.uid() and public.is_expense_creator(expense_id));

-- notifications: users read and mark their own as read.
create policy "users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "users update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (RLS still applies to authenticated; anon gets nothing)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.has_role(uuid, public.app_role),
  public.is_group_member(uuid),
  public.is_group_admin(uuid),
  public.can_access_expense(uuid),
  public.is_expense_creator(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for receipt images (private; path prefix = user id)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "users upload own receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
