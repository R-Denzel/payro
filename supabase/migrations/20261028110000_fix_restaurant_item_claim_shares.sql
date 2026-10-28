begin;

-- Keep item claim totals provisional until every receipt line has been claimed.
-- Replacing the RPC avoids assigning unclaimed lines to the first guest who
-- chooses an item and prevents payment links from using an incomplete share.
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
  _unclaimed_items bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to choose your items' using errcode = '42501';
  end if;

  select e.id, e.group_id, e.service_cents + e.tax_cents, e.total_cents
    into _expense_id, _group_id, _fees, _total_cents
  from public.expense_items i
  join public.expenses e on e.id = i.expense_id
  where i.id = _item_id
    and e.restaurant_id is not null
    and e.split_mode = 'items'
    and e.status = 'open';

  if _expense_id is null or not public.is_group_member(_group_id) then
    raise exception 'This restaurant bill is unavailable' using errcode = '42501';
  end if;

  select p.id into _participant_id
  from public.expense_participants p
  where p.expense_id = _expense_id and p.user_id = auth.uid();

  if _participant_id is null then
    insert into public.expense_participants (
      expense_id, user_id, amount_due_cents, amount_paid_cents, status
    ) values (
      _expense_id, auth.uid(), 0, 0, 'pending'
    ) returning id into _participant_id;
  end if;

  perform p.id
  from public.expense_participants p
  where p.expense_id = _expense_id
  order by p.id
  for update;
  perform e.id from public.expenses e where e.id = _expense_id for update;

  if exists (
    select 1 from public.payments p where p.expense_id = _expense_id
  ) then
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

  select count(*)
    into _unclaimed_items
  from public.expense_items i
  where i.expense_id = _expense_id
    and not exists (
      select 1 from public.item_claims ic where ic.item_id = i.id
    );

  if _unclaimed_items > 0 then
    update public.expense_participants p
    set amount_due_cents = coalesce(lines.cents, 0),
        status = case
          when coalesce(lines.cents, 0) > 0
           and p.amount_paid_cents >= coalesce(lines.cents, 0)
            then 'paid'::public.participant_status
          else 'pending'::public.participant_status
        end
    from (
      select p.id, sum(i.price_cents)::bigint as cents
      from public.expense_participants p
      left join public.item_claims ic on ic.participant_id = p.id
      left join public.expense_items i on i.id = ic.item_id and i.expense_id = _expense_id
      where p.expense_id = _expense_id
      group by p.id
    ) lines
    where p.id = lines.id;
    return;
  end if;

  with participants as (
    select p.id,
           row_number() over (order by p.id) as rn,
           count(*) over () as n
    from public.expense_participants p
    where p.expense_id = _expense_id
  ), lines as (
    select i.id,
           i.price_cents as cents,
           count(ic.participant_id)::bigint as claim_count
    from public.expense_items i
    left join public.item_claims ic on ic.item_id = i.id
    where i.expense_id = _expense_id
    group by i.id, i.price_cents
  ), candidates as (
    select l.id as item_id,
           l.cents,
           p.id as participant_id,
           count(*) over (partition by l.id) as share_count,
           row_number() over (partition by l.id order by p.id) as share_num
    from lines l
    join participants p
      on l.claim_count > 0
     and exists (
       select 1
       from public.item_claims ic
       where ic.item_id = l.id and ic.participant_id = p.id
     )
  ), item_shares as (
    select participant_id,
           sum(cents / share_count + case
             when share_num <= cents % share_count then 1 else 0
           end)::bigint as cents
    from candidates
    group by participant_id
  ), fees as (
    select id,
           (_fees / n) + case when rn <= _fees % n then 1 else 0 end as cents
    from participants
  ), amounts as (
    select p.id,
           coalesce(i.cents, 0) + f.cents as cents
    from participants p
    join fees f on f.id = p.id
    left join item_shares i on i.participant_id = p.id
  ), rounded as (
    select id,
           (cents / 100) * 100 as floor_cents,
           row_number() over (
             order by cents % 100 desc, id
           ) as rn
    from amounts
  ), extra_shillings as (
    select (_total_cents / 100)
           - coalesce(sum(floor_cents) / 100, 0) as n
    from rounded
  )
  update public.expense_participants p
  set amount_due_cents = r.floor_cents + case
        when r.rn <= x.n then 100 else 0
      end,
      status = case
        when r.floor_cents + case
          when r.rn <= x.n then 100 else 0
        end > 0
         and p.amount_paid_cents >= r.floor_cents + case
          when r.rn <= x.n then 100 else 0
        end then 'paid'::public.participant_status
        else 'pending'::public.participant_status
      end
  from rounded r
  cross join extra_shillings x
  where p.id = r.id;

  perform public.refresh_expense_status(_expense_id);
end;
$$;

revoke all on function public.claim_restaurant_bill_item(uuid, boolean) from public, anon;
grant execute on function public.claim_restaurant_bill_item(uuid, boolean) to authenticated;

create or replace function public.reject_incomplete_restaurant_item_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.expenses e
    where e.id = new.expense_id
      and e.restaurant_id is not null
      and e.split_mode = 'items'
      and exists (
        select 1
        from public.expense_items i
        where i.expense_id = e.id
          and not exists (
            select 1 from public.item_claims ic where ic.item_id = i.id
          )
      )
  ) then
    raise exception 'Every receipt item must be claimed before payment';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_incomplete_restaurant_item_payment on public.payments;
create trigger reject_incomplete_restaurant_item_payment
before insert on public.payments
for each row execute function public.reject_incomplete_restaurant_item_payment();

commit;
