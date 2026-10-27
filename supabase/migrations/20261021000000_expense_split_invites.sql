-- Secure guest invites for regular itemized expenses. Raw invite and guest access
-- tokens are returned only to the caller; the database stores SHA-256 hashes.

begin;

create table public.expense_split_invites (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  use_count integer not null default 0 check (use_count >= 0),
  max_uses integer not null default 100 check (max_uses > 0)
);

create table public.expense_split_guest_access (
  invite_id uuid not null references public.expense_split_invites(id) on delete cascade,
  participant_id uuid primary key references public.expense_participants(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  unique (invite_id, token_hash)
);

alter table public.expense_split_invites enable row level security;
alter table public.expense_split_guest_access enable row level security;
revoke all on public.expense_split_invites, public.expense_split_guest_access
  from public, anon, authenticated;

create or replace function public.create_expense_split_invite(_expense_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _expense public.expenses%rowtype;
  _token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into _expense
  from public.expenses
  where id = _expense_id
  for update;

  if not found or _expense.creator_id <> auth.uid() then
    raise exception 'Only the expense creator can share this split' using errcode = '42501';
  end if;
  if _expense.restaurant_id is not null
     or _expense.split_mode <> 'items'
     or _expense.status <> 'open'
     or not exists (select 1 from public.expense_items where expense_id = _expense_id) then
    raise exception 'Only open, itemized personal expenses can be shared for item selection';
  end if;

  update public.expense_split_invites
  set revoked_at = now()
  where expense_id = _expense_id and revoked_at is null;

  _token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/', '-_'
  );

  insert into public.expense_split_invites (expense_id, token_hash, created_by)
  values (
    _expense_id,
    encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex'),
    auth.uid()
  );

  return _token;
end;
$$;

create or replace function public.get_expense_split_invite(
  _token text,
  _guest_access_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _invite public.expense_split_invites%rowtype;
  _expense public.expenses%rowtype;
  _participant_id uuid;
  _result jsonb;
begin
  if _token is null or length(_token) > 100 then
    return null;
  end if;

  select * into _invite
  from public.expense_split_invites i
  where i.token_hash = encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex')
    and i.revoked_at is null
    and i.expires_at > now()
    and (
      i.use_count < i.max_uses
      or (
        _guest_access_token is not null
        and length(_guest_access_token) between 32 and 100
        and exists (
          select 1
          from public.expense_split_guest_access a
          where a.invite_id = i.id
            and a.token_hash = encode(
              extensions.digest(convert_to(_guest_access_token, 'UTF8'), 'sha256'),
              'hex'
            )
        )
      )
    );

  if not found then
    return null;
  end if;

  select * into _expense
  from public.expenses e
  where e.id = _invite.expense_id
    and e.restaurant_id is null
    and e.split_mode = 'items'
    and e.status = 'open';

  if not found then
    return null;
  end if;

  if _guest_access_token is not null and length(_guest_access_token) <= 100 then
    select a.participant_id into _participant_id
    from public.expense_split_guest_access a
    where a.invite_id = _invite.id
      and a.token_hash = encode(
        extensions.digest(convert_to(_guest_access_token, 'UTF8'), 'sha256'),
        'hex'
      );
  end if;

  select jsonb_build_object(
    'merchant', _expense.merchant,
    'currency', _expense.currency,
    'total_cents', _expense.total_cents,
    'expires_at', _invite.expires_at,
    'participant_name', p.guest_name,
    'amount_due_cents', p.amount_due_cents,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'name', item.name,
          'qty', item.qty,
          'price_cents', item.price_cents,
          'claim_count', (
            select count(*) from public.item_claims c where c.item_id = item.id
          ),
          'claimed_by_me', exists (
            select 1 from public.item_claims c
            where c.item_id = item.id and c.participant_id = _participant_id
          )
        ) order by item.created_at, item.id
      )
      from public.expense_items item
      where item.expense_id = _expense.id
    ), '[]'::jsonb)
  ) into _result
  from (select 1) as singleton
  left join public.expense_participants p on p.id = _participant_id;

  return _result;
end;
$$;

create or replace function public.join_expense_split_invite(
  _token text,
  _guest_name text,
  _guest_access_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _invite_id uuid;
  _invite public.expense_split_invites%rowtype;
  _expense public.expenses%rowtype;
  _participant_id uuid;
  _guest_hash text;
  _name text := trim(coalesce(_guest_name, ''));
begin
  if _token is null or length(_token) > 100
     or _guest_access_token is null or length(_guest_access_token) < 32
     or length(_guest_access_token) > 100 then
    raise exception 'This split invite is invalid or expired';
  end if;
  if length(_name) < 2 or length(_name) > 60 then
    raise exception 'Enter your name (2 to 60 characters)';
  end if;

  select i.id into _invite_id
  from public.expense_split_invites i
  where i.token_hash = encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex');

  if not found then
    raise exception 'This split invite is invalid or expired';
  end if;

  select * into _expense
  from public.expenses e
  where e.id = (
      select i.expense_id
      from public.expense_split_invites i
      where i.id = _invite_id
    )
    and e.restaurant_id is null
    and e.split_mode = 'items'
    and e.status = 'open'
  for update;

  if not found then
    raise exception 'This expense is no longer available for item selection';
  end if;

  select * into _invite
  from public.expense_split_invites i
  where i.id = _invite_id
  for update;

  if not found or _invite.revoked_at is not null or _invite.expires_at <= now() then
    raise exception 'This split invite is invalid or expired';
  end if;

  _guest_hash := encode(
    extensions.digest(convert_to(_guest_access_token, 'UTF8'), 'sha256'),
    'hex'
  );

  select a.participant_id into _participant_id
  from public.expense_split_guest_access a
  where a.invite_id = _invite.id and a.token_hash = _guest_hash;

  if _participant_id is not null then
    return _participant_id;
  end if;
  if _invite.use_count >= _invite.max_uses then
    raise exception 'This split invite has reached its guest limit';
  end if;

  insert into public.expense_participants (
    expense_id, guest_name, share_weight, amount_due_cents, amount_paid_cents, status
  ) values (
    _expense.id, _name, 1, 0, 0, 'pending'
  ) returning id into _participant_id;

  insert into public.expense_split_guest_access (invite_id, participant_id, token_hash)
  values (_invite.id, _participant_id, _guest_hash);

  update public.expense_split_invites
  set use_count = use_count + 1
  where id = _invite.id;

  return _participant_id;
end;
$$;

create or replace function public.recalculate_expense_split_shares(_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _expense public.expenses%rowtype;
begin
  select * into _expense
  from public.expenses e
  where e.id = _expense_id
  for update;
  if not found or _expense.split_mode <> 'items' or _expense.restaurant_id is not null then
    raise exception 'This expense is unavailable for item selection';
  end if;

  perform p.id
  from public.expense_participants p
  where p.expense_id = _expense.id
  order by p.id
  for update;

  with base_participants as (
    select p.id
    from public.expense_participants p
    where p.expense_id = _expense.id
      and not exists (
        select 1 from public.expense_split_guest_access a
        where a.participant_id = p.id
      )
  ), claimers as (
    select distinct c.participant_id as id
    from public.item_claims c
    join public.expense_items i on i.id = c.item_id
    where i.expense_id = _expense.id
  ), active_participants as (
    select id from base_participants
    union
    select id from claimers
  ), lines as (
    select i.id, i.price_cents as cents, count(c.participant_id)::bigint as claim_count
    from public.expense_items i
    left join public.item_claims c on c.item_id = i.id
    where i.expense_id = _expense.id
    group by i.id, i.price_cents
  ), candidates as (
    select l.id as item_id, l.cents, p.id as participant_id,
      count(*) over (partition by l.id) as share_count,
      row_number() over (partition by l.id order by p.id) as share_num
    from lines l
    join active_participants p on (
      (l.claim_count = 0 and exists (
        select 1 from base_participants b where b.id = p.id
      ))
      or (l.claim_count > 0 and exists (
        select 1 from public.item_claims c
        where c.item_id = l.id and c.participant_id = p.id
      ))
    )
  ), item_shares as (
    select participant_id,
      sum(cents / share_count + case when share_num <= cents % share_count then 1 else 0 end) as cents
    from candidates
    group by participant_id
  ), fee_participants as (
    select p.id, row_number() over (order by p.id) as rn, count(*) over () as n
    from active_participants p
  ), fees as (
    select id, (_expense.service_cents + _expense.tax_cents) / n
      + case when rn <= (_expense.service_cents + _expense.tax_cents) % n then 1 else 0 end as cents
    from fee_participants
  ), amounts as (
    select p.id, coalesce(i.cents, 0) + coalesce(f.cents, 0) as cents
    from public.expense_participants p
    left join item_shares i on i.participant_id = p.id
    left join fees f on f.id = p.id
    where p.expense_id = _expense.id
  )
  update public.expense_participants p
  set amount_due_cents = a.cents,
      amount_paid_cents = case
        when p.user_id = _expense.creator_id then a.cents
        else p.amount_paid_cents
      end,
      status = case
        when p.user_id = _expense.creator_id or p.amount_paid_cents >= a.cents
          then 'paid'::public.participant_status
        else 'pending'::public.participant_status
      end
  from amounts a
  where p.id = a.id;

  perform public.refresh_expense_status(_expense.id);
end;
$$;

create or replace function public.claim_expense_item(_item_id uuid, _claim boolean)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  _expense_id uuid;
  _participant_id uuid;
  _due bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to choose your items' using errcode = '42501';
  end if;

  select e.id into _expense_id
  from public.expense_items i
  join public.expenses e on e.id = i.expense_id
  where i.id = _item_id
    and e.restaurant_id is null
    and e.split_mode = 'items'
    and e.status = 'open'
  for update of e;

  if _expense_id is null then
    raise exception 'This expense is unavailable for item selection';
  end if;

  select p.id into _participant_id
  from public.expense_participants p
  where p.expense_id = _expense_id and p.user_id = auth.uid();
  if _participant_id is null then
    raise exception 'You are not a participant in this expense' using errcode = '42501';
  end if;
  if exists (select 1 from public.payments p where p.expense_id = _expense_id) then
    raise exception 'Items can no longer be changed after a payment is recorded';
  end if;

  if coalesce(_claim, false) then
    insert into public.item_claims (item_id, participant_id)
    values (_item_id, _participant_id)
    on conflict do nothing;
  else
    delete from public.item_claims
    where item_id = _item_id and participant_id = _participant_id;
  end if;

  perform public.recalculate_expense_split_shares(_expense_id);

  select p.amount_due_cents into _due
  from public.expense_participants p
  where p.id = _participant_id;
  return _due;
end;
$$;

create or replace function public.claim_expense_split_item(
  _token text,
  _guest_access_token text,
  _item_id uuid,
  _claim boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  _invite_id uuid;
  _invite public.expense_split_invites%rowtype;
  _expense public.expenses%rowtype;
  _participant_id uuid;
  _guest_hash text;
  _due bigint;
begin
  if _token is null or length(_token) > 100
     or _guest_access_token is null or length(_guest_access_token) < 32
     or length(_guest_access_token) > 100 then
    raise exception 'This split invite is invalid or expired';
  end if;

  select i.id into _invite_id
  from public.expense_split_invites i
  where i.token_hash = encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex');
  if not found then
    raise exception 'This split invite is invalid or expired';
  end if;

  select * into _expense
  from public.expenses e
  where e.id = (
      select i.expense_id
      from public.expense_split_invites i
      where i.id = _invite_id
    )
    and e.restaurant_id is null
    and e.split_mode = 'items'
    and e.status = 'open'
  for update;

  if not found then
    raise exception 'This expense is no longer available for item selection';
  end if;

  select * into _invite
  from public.expense_split_invites i
  where i.id = _invite_id
  for update;

  if not found or _invite.revoked_at is not null or _invite.expires_at <= now() then
    raise exception 'This split invite is invalid or expired';
  end if;

  _guest_hash := encode(
    extensions.digest(convert_to(_guest_access_token, 'UTF8'), 'sha256'),
    'hex'
  );
  select a.participant_id into _participant_id
  from public.expense_split_guest_access a
  where a.invite_id = _invite.id and a.token_hash = _guest_hash;

  if _participant_id is null then
    raise exception 'Join this split before selecting items' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.expense_items i
    where i.id = _item_id and i.expense_id = _expense.id
  ) then
    raise exception 'That item is not part of this expense';
  end if;
  if exists (select 1 from public.payments p where p.expense_id = _expense.id) then
    raise exception 'Items can no longer be changed after a payment is recorded';
  end if;

  if coalesce(_claim, false) then
    insert into public.item_claims (item_id, participant_id)
    values (_item_id, _participant_id)
    on conflict do nothing;
  else
    delete from public.item_claims
    where item_id = _item_id and participant_id = _participant_id;
  end if;

  perform public.recalculate_expense_split_shares(_expense.id);

  select p.amount_due_cents into _due
  from public.expense_participants p
  where p.id = _participant_id;
  return _due;
end;
$$;

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
  _expense_id uuid;
  _p public.expense_participants%rowtype;
  _creator uuid;
  _outstanding bigint;
  _amount bigint;
  _payment_id uuid;
begin
  select expense_id into _expense_id
  from public.expense_participants
  where id = _participant_id;
  if not found then
    raise exception 'Share not found';
  end if;

  -- Keep payment writes in the same expense-before-participant lock order as item claims.
  perform 1 from public.expenses where id = _expense_id for update;
  if not found then
    raise exception 'Expense not found';
  end if;

  select * into _p
  from public.expense_participants
  where id = _participant_id
  for update;
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

revoke all on function public.create_expense_split_invite(uuid) from public, anon;
revoke all on function public.get_expense_split_invite(text, text) from public;
revoke all on function public.join_expense_split_invite(text, text, text) from public;
revoke all on function public.claim_expense_split_item(text, text, uuid, boolean) from public;
revoke all on function public.claim_expense_item(uuid, boolean) from public, anon;
revoke all on function public.recalculate_expense_split_shares(uuid) from public, anon, authenticated;

grant execute on function public.create_expense_split_invite(uuid) to authenticated;
grant execute on function public.get_expense_split_invite(text, text) to anon, authenticated;
grant execute on function public.join_expense_split_invite(text, text, text) to anon, authenticated;
grant execute on function public.claim_expense_split_item(text, text, uuid, boolean) to anon, authenticated;
grant execute on function public.claim_expense_item(uuid, boolean) to authenticated;

commit;
