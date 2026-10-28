-- Install the RPC used by the restaurant bill publishing form.
-- Requires the base/app-functions migrations, restaurant portal schema, and
-- restaurant_sessions setup from supabase/manual/01_restaurant_session_bills.sql.

begin;

create or replace function public.create_restaurant_bill_with_items(
  _restaurant_id uuid,
  _group_id uuid,
  _merchant text,
  _subtotal_cents bigint,
  _service_cents bigint,
  _tax_cents bigint,
  _total_cents bigint,
  _items jsonb,
  _receipt_url text,
  _participants jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _expense_id uuid;
  _item_total bigint;
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
  if not exists (
    select 1 from public.restaurant_sessions s
    where s.restaurant_id = _restaurant_id and s.group_id = _group_id
  ) or not public.is_group_member(_group_id) then
    raise exception 'This session does not belong to this restaurant' using errcode = '42501';
  end if;
  if nullif(trim(_merchant), '') is null or _total_cents is null or _total_cents <= 0
     or _subtotal_cents is null or _subtotal_cents < 0
     or _service_cents is null or _service_cents < 0
     or _tax_cents is null or _tax_cents < 0 then
    raise exception 'Enter a bill description and valid receipt totals';
  end if;
  if _total_cents % 100 <> 0 then
    raise exception 'Restaurant bill totals must be in whole Kenyan shillings for M-Pesa';
  end if;
  if _subtotal_cents + _service_cents + _tax_cents <> _total_cents then
    raise exception 'Receipt items, service charge, and tax must add up to the bill total';
  end if;
  if jsonb_typeof(coalesce(_items, '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(_participants, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Items and guest shares must be lists';
  end if;
  if jsonb_array_length(coalesce(_participants, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one guest to the session first';
  end if;
  if jsonb_array_length(coalesce(_items, '[]'::jsonb)) > 0 and exists (
    select 1 from jsonb_array_elements(_items) x(value)
    where nullif(trim(x.value ->> 'name'), '') is null
       or coalesce((x.value ->> 'price_cents')::bigint, 0) < 0
       or coalesce((x.value ->> 'qty')::integer, 0) < 1
  ) then
    raise exception 'Each receipt item needs a name, a valid line total, and a quantity';
  end if;

  select coalesce(sum((x.value ->> 'price_cents')::bigint), 0)
  into _item_total
  from jsonb_array_elements(coalesce(_items, '[]'::jsonb)) x(value);
  if _item_total <> _subtotal_cents then
    raise exception 'Receipt item totals must add up to the subtotal';
  end if;
  if _receipt_url is not null and _receipt_url not like auth.uid()::text || '/%' then
    raise exception 'Receipt must be uploaded by the signed-in restaurant user'
      using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_participants) x(value)
    where coalesce(x.value ->> 'amount_due_cents', '') !~ '^[0-9]+$'
       or (x.value ->> 'amount_due_cents')::bigint <= 0
  ) then
    raise exception 'Each guest needs a positive share';
  end if;
  if (
    select sum((x.value ->> 'amount_due_cents')::bigint)
    from jsonb_array_elements(_participants) x(value)
  ) <> _total_cents then
    raise exception 'Guest shares must add up to the restaurant bill total';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_participants) x(value)
    where nullif(x.value ->> 'user_id', '')::uuid = auth.uid()
  ) then
    raise exception 'The restaurant account cannot be included as a guest share';
  end if;

  _expense_id := public.create_expense(
    jsonb_build_object(
      'group_id', _group_id,
      'merchant', trim(_merchant),
      'category', 'Dining',
      'currency', 'KES',
      'subtotal_cents', _subtotal_cents,
      'service_cents', _service_cents,
      'tax_cents', _tax_cents,
      'total_cents', _total_cents,
      'split_mode', case
        when jsonb_array_length(coalesce(_items, '[]'::jsonb)) > 0 then 'items'
        else 'equal'
      end,
      'receipt_url', _receipt_url
    ),
    coalesce(_items, '[]'::jsonb),
    coalesce(_participants, '[]'::jsonb)
  );

  update public.expenses
  set restaurant_id = _restaurant_id
  where id = _expense_id;

  return _expense_id;
end;
$$;

revoke all on function public.create_restaurant_bill_with_items(
  uuid, uuid, text, bigint, bigint, bigint, bigint, jsonb, text, jsonb
) from public, anon;
grant execute on function public.create_restaurant_bill_with_items(
  uuid, uuid, text, bigint, bigint, bigint, bigint, jsonb, text, jsonb
) to authenticated;

-- Guests may claim or unclaim their own items. Shares are recalculated from
-- claimed line totals; unclaimed lines and service/tax are shared evenly.
create or replace function public.claim_restaurant_bill_item(_item_id uuid, _claim boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _expense_id uuid;
  _group_id uuid;
  _participant_id uuid;
  _fees bigint;
  _total_cents bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to choose your items' using errcode = '42501';
  end if;
  select e.id, e.group_id, e.service_cents + e.tax_cents, e.total_cents
    into _expense_id, _group_id, _fees, _total_cents
  from public.expense_items i
  join public.expenses e on e.id = i.expense_id
  where i.id = _item_id and e.restaurant_id is not null and e.split_mode = 'items' and e.status = 'open';
  if _expense_id is null or not public.is_group_member(_group_id) then
    raise exception 'This restaurant bill is unavailable' using errcode = '42501';
  end if;
  select p.id into _participant_id
  from public.expense_participants p
  where p.expense_id = _expense_id and p.user_id = auth.uid();
  if _participant_id is null then
    insert into public.expense_participants (expense_id, user_id, amount_due_cents, amount_paid_cents, status)
    values (_expense_id, auth.uid(), 0, 0, 'pending')
    returning id into _participant_id;
  end if;
  perform p.id from public.expense_participants p
  where p.expense_id = _expense_id order by p.id for update;
  perform e.id from public.expenses e where e.id = _expense_id for update;
  if exists (select 1 from public.payments p where p.expense_id = _expense_id) then
    raise exception 'Items can no longer be changed after a payment is recorded';
  end if;

  if coalesce(_claim, false) then
    insert into public.item_claims (item_id, participant_id)
    values (_item_id, _participant_id) on conflict do nothing;
  else
    delete from public.item_claims where item_id = _item_id and participant_id = _participant_id;
  end if;

  with participants as (
    select p.id, row_number() over (order by p.id) as rn, count(*) over () as n
    from public.expense_participants p where p.expense_id = _expense_id
  ), lines as (
    select i.id, i.price_cents as cents, count(ic.participant_id)::bigint as claim_count
    from public.expense_items i
    left join public.item_claims ic on ic.item_id = i.id
    where i.expense_id = _expense_id
    group by i.id, i.price_cents
  ), candidates as (
    select l.id as item_id, l.cents, p.id as participant_id,
      count(*) over (partition by l.id) as share_count,
      row_number() over (partition by l.id order by p.id) as share_num
    from lines l
    join participants p on l.claim_count = 0
      or exists (select 1 from public.item_claims ic where ic.item_id = l.id and ic.participant_id = p.id)
  ), item_shares as (
    select participant_id,
      sum(cents / share_count + case when share_num <= cents % share_count then 1 else 0 end) as cents
    from candidates group by participant_id
  ), fees as (
    select id, (_fees / n) + case when rn <= _fees % n then 1 else 0 end as cents
    from participants
  ), amounts as (
    select p.id, coalesce(i.cents, 0) + f.cents as cents
    from participants p
    join fees f on f.id = p.id
    left join item_shares i on i.participant_id = p.id
  ), rounded as (
    select id, (cents / 100) * 100 as floor_cents, cents % 100 as remainder_cents,
      row_number() over (order by cents % 100 desc, id) as rn
    from amounts
  ), extra_shillings as (
    select (_total_cents / 100) - coalesce(sum(floor_cents) / 100, 0) as n
    from rounded
  )
  update public.expense_participants p
  set amount_due_cents = r.floor_cents + case when r.rn <= x.n then 100 else 0 end,
      status = case
        when p.amount_paid_cents >= r.floor_cents + case when r.rn <= x.n then 100 else 0 end
          then 'paid'::public.participant_status
        else 'pending'::public.participant_status
      end
  from rounded r cross join extra_shillings x
  where p.id = r.id;

  perform public.refresh_expense_status(_expense_id);
end;
$$;

revoke all on function public.claim_restaurant_bill_item(uuid, boolean) from public, anon;
grant execute on function public.claim_restaurant_bill_item(uuid, boolean) to authenticated;

commit;
