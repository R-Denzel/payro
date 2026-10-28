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

commit;
