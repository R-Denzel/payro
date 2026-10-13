-- Payment requests: a creator shares a link for one person's share; the person opens it
-- (no account needed), sends the money with M-Pesa, and reports it so the creator can confirm.

-- Where requesters get paid. Digits only, e.g. 254712345678. Google sign-ins have no phone.
alter table public.profiles add column mpesa_number text
  check (mpesa_number is null or mpesa_number ~ '^254[17][0-9]{8}$');

-- A link now targets one participant's share; reported_at throttles "I've paid" reports.
alter table public.share_links
  add column participant_id uuid references public.expense_participants (id) on delete cascade,
  add column reported_at timestamptz;

create index share_links_participant_idx on public.share_links (participant_id);

-- ---------------------------------------------------------------------------
-- Create (or reuse) a pay link for a share. Expense creator only.
-- ---------------------------------------------------------------------------
create or replace function public.create_payment_request(_participant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _p public.expense_participants%rowtype;
  _creator uuid;
  _token text;
begin
  select * into _p from public.expense_participants where id = _participant_id;
  if not found then
    raise exception 'Share not found';
  end if;
  select creator_id into _creator from public.expenses where id = _p.expense_id;
  if _uid is null or _uid <> _creator then
    raise exception 'Only the person who paid can request this money' using errcode = '42501';
  end if;
  if _p.amount_due_cents - _p.amount_paid_cents <= 0 then
    raise exception 'This share is already paid';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = _uid and coalesce(mpesa_number, phone) is not null
  ) then
    raise exception 'Add your M-Pesa number first';
  end if;

  select token into _token from public.share_links
  where participant_id = _participant_id and expires_at > now() + interval '1 day'
  order by created_at desc limit 1;

  if _token is null then
    insert into public.share_links (expense_id, created_by, participant_id)
    values (_p.expense_id, _uid, _participant_id)
    returning token into _token;
  end if;

  update public.expense_participants set status = 'reminded'
  where id = _participant_id and status = 'pending';

  return _token;
end;
$$;

-- ---------------------------------------------------------------------------
-- What a pay link shows. Public: anyone holding the (unguessable) token.
-- ---------------------------------------------------------------------------
create or replace function public.get_payment_request(_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'requester', public.display_name(e.creator_id),
    'mpesa_number', coalesce(pr.mpesa_number, pr.phone),
    'payer', coalesce(p.guest_name, nullif(payer.full_name, ''), 'there'),
    'amount_cents', greatest(p.amount_due_cents - p.amount_paid_cents, 0),
    'currency', e.currency,
    'reason', e.merchant,
    'expired', l.expires_at < now(),
    'reported', l.reported_at is not null
  )
  from public.share_links l
  join public.expense_participants p on p.id = l.participant_id
  join public.expenses e on e.id = l.expense_id
  join public.profiles pr on pr.id = e.creator_id
  left join public.profiles payer on payer.id = p.user_id
  where l.token = _token;
$$;

-- ---------------------------------------------------------------------------
-- The payer says they've paid. Notifies the creator, who confirms it in the app.
-- ---------------------------------------------------------------------------
create or replace function public.report_request_paid(_token text, _mpesa_ref text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _l public.share_links%rowtype;
  _p public.expense_participants%rowtype;
  _e public.expenses%rowtype;
  _ref text := upper(nullif(trim(_mpesa_ref), ''));
  _who text;
begin
  select * into _l from public.share_links where token = _token for update;
  if not found or _l.participant_id is null or _l.expires_at < now() then
    raise exception 'This payment link has expired';
  end if;
  if _l.reported_at > now() - interval '10 minutes' then
    return; -- already reported just now
  end if;
  if _ref is not null and _ref !~ '^[A-Z0-9]{10}$' then
    raise exception 'M-Pesa codes are 10 letters and numbers, e.g. SLK4H7XQ2P';
  end if;

  select * into _p from public.expense_participants where id = _l.participant_id;
  select * into _e from public.expenses where id = _l.expense_id;
  _who := coalesce(_p.guest_name, public.display_name(_p.user_id), 'Someone');

  update public.share_links set reported_at = now() where token = _token;

  insert into public.notifications (user_id, kind, title, body, data)
  values (
    _e.creator_id,
    'payment_reported',
    _who || ' says they paid',
    _e.currency || ' ' || to_char((_p.amount_due_cents - _p.amount_paid_cents) / 100.0, 'FM999,999,990.##')
      || ' for ' || _e.merchant
      || coalesce(' · M-Pesa ' || _ref, '')
      || '. Check your M-Pesa, then mark it paid.',
    jsonb_build_object('expense_id', _e.id, 'participant_id', _p.id, 'mpesa_ref', _ref)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.create_payment_request(uuid),
  public.get_payment_request(text),
  public.report_request_paid(text, text)
from anon, public;

grant execute on function public.create_payment_request(uuid) to authenticated;
grant execute on function
  public.get_payment_request(text),
  public.report_request_paid(text, text)
to anon, authenticated;
