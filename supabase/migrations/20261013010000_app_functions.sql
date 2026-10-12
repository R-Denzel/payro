-- Payro app functions: categories, group emoji, atomic expense creation, payment recording,
-- add-member-by-phone, notification triggers, and tighter profile visibility.

alter table public.expenses add column category text not null default 'Other';
alter table public.groups add column emoji text not null default '👥';

-- ---------------------------------------------------------------------------
-- Profiles: only visible to yourself and people you share a group or expense with.
-- ---------------------------------------------------------------------------
create or replace function public.shares_context_with(_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _other = auth.uid()
    or exists (
      select 1 from public.group_members a
      join public.group_members b on a.group_id = b.group_id
      where a.user_id = auth.uid() and b.user_id = _other
    )
    or exists (
      select 1 from public.expense_participants p
      join public.expenses e on e.id = p.expense_id
      where (e.creator_id = auth.uid() and p.user_id = _other)
         or (e.creator_id = _other and p.user_id = auth.uid())
    );
$$;

drop policy "profiles readable by authenticated users" on public.profiles;
create policy "profiles visible to self and contacts"
  on public.profiles for select to authenticated
  using (public.shares_context_with(id));

-- ---------------------------------------------------------------------------
-- Add a registered user to a group by phone number (admins only).
-- ---------------------------------------------------------------------------
create or replace function public.add_group_member_by_phone(_group_id uuid, _phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _digits text := regexp_replace(_phone, '\D', '', 'g');
  _user_id uuid;
begin
  if not public.is_group_admin(_group_id) then
    raise exception 'Only group admins can add members' using errcode = '42501';
  end if;

  -- Accept local Kenyan format (07..., 7...) as well as 2547...
  if _digits ~ '^0\d{9}$' then
    _digits := '254' || substr(_digits, 2);
  elsif _digits ~ '^\d{9}$' then
    _digits := '254' || _digits;
  end if;

  select id into _user_id from public.profiles where phone = _digits;
  if _user_id is null then
    raise exception 'No Payro account uses % yet. Ask them to sign up first.', _phone
      using errcode = 'P0002';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (_group_id, _user_id, 'member')
  on conflict do nothing;

  return _user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create an expense with items, participants and item claims in one transaction.
--   _expense:      {group_id?, merchant, category, currency, subtotal_cents, service_cents,
--                   tax_cents, total_cents, split_mode, receipt_url?}
--   _items:        [{name, price_cents, qty}]
--   _participants: [{user_id? | guest_name, guest_phone?, share_weight, amount_due_cents,
--                    item_indexes: [int]}]
-- The creator is assumed to have paid the bill; their own share is marked paid.
-- ---------------------------------------------------------------------------
create or replace function public.create_expense(_expense jsonb, _items jsonb, _participants jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _group_id uuid := nullif(_expense ->> 'group_id', '')::uuid;
  _subtotal bigint := coalesce((_expense ->> 'subtotal_cents')::bigint, 0);
  _service bigint := coalesce((_expense ->> 'service_cents')::bigint, 0);
  _tax bigint := coalesce((_expense ->> 'tax_cents')::bigint, 0);
  _total bigint := coalesce((_expense ->> 'total_cents')::bigint, 0);
  _expense_id uuid;
  _item_ids uuid[] := '{}';
  _item jsonb;
  _p jsonb;
  _p_user uuid;
  _p_due bigint;
  _participant_id uuid;
  _idx int;
  _due_sum bigint := 0;
begin
  if _uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if _group_id is not null and not public.is_group_member(_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  if _total <= 0 then
    raise exception 'Total must be greater than zero';
  end if;
  if _subtotal + _service + _tax <> _total then
    raise exception 'Subtotal + service + tax must equal total';
  end if;
  if jsonb_array_length(coalesce(_participants, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one person to split with';
  end if;

  select coalesce(sum((p ->> 'amount_due_cents')::bigint), 0) into _due_sum
  from jsonb_array_elements(_participants) p;
  if _due_sum <> _total then
    raise exception 'Shares (%) must add up to the total (%)', _due_sum, _total;
  end if;

  insert into public.expenses (
    group_id, creator_id, merchant, category, currency, subtotal_cents, service_cents,
    tax_cents, total_cents, split_mode, status, receipt_url
  ) values (
    _group_id, _uid,
    coalesce(nullif(trim(_expense ->> 'merchant'), ''), 'Expense'),
    coalesce(nullif(_expense ->> 'category', ''), 'Other'),
    coalesce(nullif(_expense ->> 'currency', ''), 'KES'),
    _subtotal, _service, _tax, _total,
    coalesce(nullif(_expense ->> 'split_mode', ''), 'equal')::public.split_mode,
    'open',
    nullif(_expense ->> 'receipt_url', '')
  ) returning id into _expense_id;

  for _item in select * from jsonb_array_elements(coalesce(_items, '[]'::jsonb)) loop
    insert into public.expense_items (expense_id, name, price_cents, qty)
    values (
      _expense_id,
      coalesce(nullif(trim(_item ->> 'name'), ''), 'Item'),
      (_item ->> 'price_cents')::bigint,
      greatest(coalesce((_item ->> 'qty')::int, 1), 1)
    ) returning id into _participant_id;
    _item_ids := _item_ids || _participant_id;
  end loop;

  for _p in select * from jsonb_array_elements(_participants) loop
    _p_user := nullif(_p ->> 'user_id', '')::uuid;
    _p_due := (_p ->> 'amount_due_cents')::bigint;

    if _p_user is not null and _p_user <> _uid then
      if _group_id is not null then
        if not exists (
          select 1 from public.group_members where group_id = _group_id and user_id = _p_user
        ) then
          raise exception 'Everyone in the split must be a member of the group';
        end if;
      elsif not public.shares_context_with(_p_user) then
        raise exception 'You can only split with people you share a group with';
      end if;
    end if;

    insert into public.expense_participants (
      expense_id, user_id, guest_name, guest_phone, share_weight,
      amount_due_cents, amount_paid_cents, status
    ) values (
      _expense_id, _p_user,
      case when _p_user is null then nullif(trim(_p ->> 'guest_name'), '') end,
      case when _p_user is null then nullif(trim(_p ->> 'guest_phone'), '') end,
      coalesce((_p ->> 'share_weight')::numeric, 1),
      _p_due,
      case when _p_user = _uid then _p_due else 0 end,
      case when _p_user = _uid or _p_due = 0 then 'paid' else 'pending' end::public.participant_status
    ) returning id into _participant_id;

    for _idx in select (value)::int from jsonb_array_elements_text(coalesce(_p -> 'item_indexes', '[]'::jsonb)) loop
      if _idx < 0 or _idx >= coalesce(array_length(_item_ids, 1), 0) then
        raise exception 'Invalid item index %', _idx;
      end if;
      insert into public.item_claims (item_id, participant_id)
      values (_item_ids[_idx + 1], _participant_id)
      on conflict do nothing;
    end loop;
  end loop;

  perform public.refresh_expense_status(_expense_id);
  return _expense_id;
end;
$$;

create or replace function public.refresh_expense_status(_expense_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.expenses e
  set status = case
    when not exists (
      select 1 from public.expense_participants p
      where p.expense_id = e.id and p.amount_paid_cents < p.amount_due_cents
    ) then 'settled'::public.expense_status
    else 'open'::public.expense_status
  end
  where e.id = _expense_id;
$$;

-- ---------------------------------------------------------------------------
-- Record a payment against a participant's share.
-- Payro does not move money yet: this records a payment made outside the app
-- (cash, M-Pesa send money, ...). Callable by the participant or the expense creator.
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(
  _participant_id uuid,
  _provider public.payment_provider,
  _amount_cents bigint default null,
  _provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _p public.expense_participants%rowtype;
  _creator uuid;
  _outstanding bigint;
  _amount bigint;
  _payment_id uuid;
begin
  select * into _p from public.expense_participants where id = _participant_id for update;
  if not found then
    raise exception 'Share not found';
  end if;
  select creator_id into _creator from public.expenses where id = _p.expense_id;

  if _uid is null or (_uid <> _creator and _uid is distinct from _p.user_id) then
    raise exception 'You cannot record a payment for this share' using errcode = '42501';
  end if;

  _outstanding := _p.amount_due_cents - _p.amount_paid_cents;
  if _outstanding <= 0 then
    raise exception 'This share is already paid';
  end if;
  _amount := coalesce(_amount_cents, _outstanding);
  if _amount <= 0 or _amount > _outstanding then
    raise exception 'Amount must be between 1 and %', _outstanding;
  end if;

  insert into public.payments (
    expense_id, participant_id, payer_id, amount_cents, currency, provider,
    provider_ref, idempotency_key, status
  )
  select _p.expense_id, _p.id, _p.user_id, _amount, e.currency, _provider,
         nullif(trim(_provider_ref), ''), gen_random_uuid()::text, 'success'
  from public.expenses e where e.id = _p.expense_id
  returning id into _payment_id;

  update public.expense_participants
  set amount_paid_cents = amount_paid_cents + _amount,
      status = case when amount_paid_cents + _amount >= amount_due_cents
                    then 'paid'::public.participant_status else status end
  where id = _p.id;

  perform public.refresh_expense_status(_p.expense_id);
  return _payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications (written by triggers; users can only read/mark their own)
-- ---------------------------------------------------------------------------
create or replace function public.display_name(_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(full_name, ''), '+' || phone, 'Someone')
  from public.profiles where id = _user_id;
$$;

create or replace function public.notify_group_member_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _g public.groups%rowtype;
begin
  select * into _g from public.groups where id = new.group_id;
  if new.user_id <> _g.created_by then
    insert into public.notifications (user_id, kind, title, body, data)
    values (
      new.user_id, 'group_added',
      'You were added to ' || _g.name,
      'By ' || public.display_name(coalesce(auth.uid(), _g.created_by)),
      jsonb_build_object('group_id', _g.id)
    );
  end if;
  return new;
end;
$$;

create trigger on_group_member_added
after insert on public.group_members
for each row execute function public.notify_group_member_added();

create or replace function public.notify_expense_participant_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _e public.expenses%rowtype;
begin
  select * into _e from public.expenses where id = new.expense_id;
  if new.user_id is not null and new.user_id <> _e.creator_id and new.amount_due_cents > 0 then
    insert into public.notifications (user_id, kind, title, body, data)
    values (
      new.user_id, 'expense_added',
      public.display_name(_e.creator_id) || ' split ' || _e.merchant || ' with you',
      'Your share: ' || _e.currency || ' ' || to_char(new.amount_due_cents / 100.0, 'FM999,999,990.00'),
      jsonb_build_object('expense_id', _e.id, 'participant_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger on_expense_participant_added
after insert on public.expense_participants
for each row execute function public.notify_expense_participant_added();

create or replace function public.notify_payment_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _e public.expenses%rowtype;
  _payer text;
begin
  select * into _e from public.expenses where id = new.expense_id;
  select coalesce(public.display_name(p.user_id), p.guest_name, 'A guest') into _payer
  from public.expense_participants p where p.id = new.participant_id;

  if new.payer_id is distinct from _e.creator_id and auth.uid() is distinct from _e.creator_id then
    insert into public.notifications (user_id, kind, title, body, data)
    values (
      _e.creator_id, 'payment_received',
      _payer || ' paid ' || new.currency || ' ' || to_char(new.amount_cents / 100.0, 'FM999,999,990.00'),
      'For ' || _e.merchant,
      jsonb_build_object('expense_id', _e.id, 'payment_id', new.id)
    );
  elsif new.payer_id is not null and auth.uid() = _e.creator_id then
    insert into public.notifications (user_id, kind, title, body, data)
    values (
      new.payer_id, 'payment_confirmed',
      public.display_name(_e.creator_id) || ' marked your share as paid',
      _e.merchant || ' · ' || new.currency || ' ' || to_char(new.amount_cents / 100.0, 'FM999,999,990.00'),
      jsonb_build_object('expense_id', _e.id, 'payment_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger on_payment_recorded
after insert on public.payments
for each row execute function public.notify_payment_recorded();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.shares_context_with(uuid),
  public.add_group_member_by_phone(uuid, text),
  public.create_expense(jsonb, jsonb, jsonb),
  public.refresh_expense_status(uuid),
  public.record_payment(uuid, public.payment_provider, bigint, text),
  public.display_name(uuid),
  public.notify_group_member_added(),
  public.notify_expense_participant_added(),
  public.notify_payment_recorded()
from anon, public;

grant execute on function
  public.shares_context_with(uuid),
  public.add_group_member_by_phone(uuid, text),
  public.create_expense(jsonb, jsonb, jsonb),
  public.record_payment(uuid, public.payment_provider, bigint, text)
to authenticated;
