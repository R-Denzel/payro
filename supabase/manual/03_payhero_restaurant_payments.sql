-- PayHero M-Pesa collections for restaurant bills.
-- Run after the base, app_functions, restaurant_portal, and restaurant session SQL.
-- This stores a PayHero channel ID per restaurant and adds provider references to payments.
-- It does not store PayHero credentials. Those belong in Supabase Edge Function secrets.

begin;

alter table public.restaurants
  add column if not exists payhero_channel_id bigint;

alter table public.restaurants
  drop constraint if exists restaurants_payhero_channel_id_positive;
alter table public.restaurants
  add constraint restaurants_payhero_channel_id_positive
  check (payhero_channel_id is null or payhero_channel_id > 0);

comment on column public.restaurants.payhero_channel_id is
  'PayHero payment channel ID, set by Payro only after verifying the restaurant Till/Paybill is registered to this merchant.';

-- Restaurant profile edits remain available, but authenticated owners/managers cannot
-- point collections at an arbitrary merchant channel. Payro sets the channel server-side.
revoke update on public.restaurants from authenticated;
grant update (name, category, location, phone, logo_url, address, accepted_payment_methods)
  on public.restaurants to authenticated;

alter table public.payments
  add column if not exists payhero_external_reference text,
  add column if not exists payhero_checkout_request_id text;

create unique index if not exists payments_payhero_external_reference_uidx
  on public.payments (payhero_external_reference)
  where payhero_external_reference is not null;

create unique index if not exists payments_payhero_checkout_request_id_uidx
  on public.payments (payhero_checkout_request_id)
  where payhero_checkout_request_id is not null;

create unique index if not exists payments_one_pending_payhero_per_participant_uidx
  on public.payments (participant_id)
  where status = 'pending' and payhero_external_reference is not null;

-- A pending request is not a confirmed payment. Notify only after a payment becomes successful.
drop trigger if exists on_payment_recorded on public.payments;
create trigger on_payment_recorded
after insert on public.payments
for each row
when (new.status = 'success')
execute function public.notify_payment_recorded();

drop trigger if exists on_payment_confirmed on public.payments;
create trigger on_payment_confirmed
after update of status on public.payments
for each row
when (old.status is distinct from new.status and new.status = 'success')
execute function public.notify_payment_recorded();

-- Only the PayHero callback Edge Function (service_role) can confirm a PayHero payment.
create or replace function public.complete_payhero_payment(
  _external_reference text,
  _amount_cents bigint,
  _receipt text,
  _checkout_request_id text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _payment public.payments%rowtype;
  _participant public.expense_participants%rowtype;
begin
  select * into _payment
  from public.payments
  where payhero_external_reference = _external_reference
  for update;

  if not found then
    return false;
  end if;

  -- Callback retries are expected. A completed payment remains completed.
  if _payment.status = 'success' then
    return true;
  end if;
  if _payment.status <> 'pending' or _payment.participant_id is null
     or _amount_cents is distinct from _payment.amount_cents
     or nullif(trim(_receipt), '') is null then
    return false;
  end if;

  select * into _participant
  from public.expense_participants
  where id = _payment.participant_id
  for update;

  if not found or _participant.amount_due_cents - _participant.amount_paid_cents < _payment.amount_cents then
    return false;
  end if;

  update public.payments
  set status = 'success',
      provider_ref = trim(_receipt),
      payhero_checkout_request_id = coalesce(nullif(trim(_checkout_request_id), ''), payhero_checkout_request_id)
  where id = _payment.id;

  update public.expense_participants
  set amount_paid_cents = amount_paid_cents + _payment.amount_cents,
      status = case when amount_paid_cents + _payment.amount_cents >= amount_due_cents
                    then 'paid'::public.participant_status else status end
  where id = _participant.id;

  perform public.refresh_expense_status(_payment.expense_id);
  return true;
end;
$$;

revoke all on function public.complete_payhero_payment(text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_payhero_payment(text, bigint, text, text)
  to service_role;

-- Restaurant M-Pesa payments must be confirmed by PayHero; authorized restaurant managers may record cash.
create or replace function public.record_payment(
  _participant_id uuid,
  _provider public.payment_provider,
  _amount_cents bigint default null,
  _provider_ref text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _p public.expense_participants%rowtype;
  _creator uuid;
  _restaurant_id uuid;
  _outstanding bigint;
  _amount bigint;
  _payment_id uuid;
begin
  select * into _p from public.expense_participants where id = _participant_id for update;
  if not found then raise exception 'Share not found'; end if;

  select e.creator_id, e.restaurant_id into _creator, _restaurant_id
  from public.expenses e where e.id = _p.expense_id;

  if _uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if _restaurant_id is null and _uid <> _creator and _uid is distinct from _p.user_id then
    raise exception 'You cannot record a payment for this share' using errcode = '42501';
  end if;
  if _restaurant_id is not null and _provider <> 'cash' then
    raise exception 'Restaurant M-Pesa payments must be confirmed through PayHero';
  end if;
  if _restaurant_id is not null and (
    not public.is_restaurant_member(_restaurant_id)
    or public.restaurant_role_for(_restaurant_id) not in ('owner', 'manager')
  ) then
    raise exception 'Only a restaurant owner or manager can record a cash payment' using errcode = '42501';
  end if;

  _outstanding := _p.amount_due_cents - _p.amount_paid_cents;
  if _outstanding <= 0 then raise exception 'This share is already paid'; end if;
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

revoke all on function public.record_payment(uuid, public.payment_provider, bigint, text)
  from public, anon;
grant execute on function public.record_payment(uuid, public.payment_provider, bigint, text)
  to authenticated;

commit;
