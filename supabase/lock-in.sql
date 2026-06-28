-- ============================================================
-- ZScope — LOCK-IN PERIOD (per center)
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
-- (Fresh projects already include this via setup.sql.)
--
-- Adds a per-center lock-in period (in months). While a member's
-- position is within the lock-in window (measured from their FIRST
-- deposit into the center), they may NOT add more funds and may NOT
-- withdraw. 0 = no lock-in (default).
-- ============================================================

alter table public.investment_centers
  add column if not exists lock_in_months integer not null default 0;

comment on column public.investment_centers.lock_in_months is
  'Months funds stay locked from a member''s first deposit. During the lock-in no
 additional deposits or withdrawals are allowed. 0 = no lock-in.';

-- Returns the timestamp until which an investment is locked, or NULL when
-- the center has no lock-in. Based on the member''s earliest deposit.
create or replace function public.investment_locked_until(p_investment_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
           when coalesce(c.lock_in_months, 0) > 0 then
             (select min(it.created_at)
                from public.investment_transactions it
               where it.investment_id = i.id and it.type = 'deposit')
             + (c.lock_in_months || ' months')::interval
           else null
         end
  from public.investments i
  join public.investment_centers c on c.id = i.center_id
  where i.id = p_investment_id;
$$;

grant execute on function public.investment_locked_until(uuid) to authenticated;

-- Re-create the join approval with the lock-in check added (no adding funds
-- while an existing position is still locked).
create or replace function public.approve_investment_join(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_balance numeric;
  v_investment_id uuid;
  v_cap numeric;
  v_raised numeric;
  v_member_cap numeric;
  v_member_invested numeric;
  v_locked_until timestamptz;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into r from public.investment_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already processed'; end if;

  -- enforce lock-in: block ADDING to an existing, still-locked position
  select public.investment_locked_until(i.id) into v_locked_until
  from public.investments i
  where i.member_id = r.member_id and i.center_id = r.center_id;
  if v_locked_until is not null and now() < v_locked_until then
    raise exception 'Funds are locked until %. No additional deposits are allowed during the lock-in period.', v_locked_until::date;
  end if;

  -- enforce fund cap (0 = unlimited)
  select fund_cap, max_per_member into v_cap, v_member_cap
  from public.investment_centers where id = r.center_id;
  if coalesce(v_cap, 0) > 0 then
    v_raised := public.investment_center_raised(r.center_id);
    if v_raised + r.amount > v_cap then
      raise exception 'Fund cap reached: % of % raised. Approving this % would exceed the cap by %.',
        v_raised, v_cap, r.amount, (v_raised + r.amount - v_cap);
    end if;
  end if;

  -- enforce per-member cap (0 = unlimited): existing net deposits + new amount
  if coalesce(v_member_cap, 0) > 0 then
    select coalesce(sum(case when it.type = 'deposit' then it.amount
                             when it.type = 'withdrawal' then -it.amount
                             else 0 end), 0)
      into v_member_invested
    from public.investments i
    join public.investment_transactions it on it.investment_id = i.id
    where i.member_id = r.member_id and i.center_id = r.center_id;

    if v_member_invested + r.amount > v_member_cap then
      raise exception 'Per-member limit reached: this member already holds % of the % limit. Approving % would exceed it by %.',
        v_member_invested, v_member_cap, r.amount, (v_member_invested + r.amount - v_member_cap);
    end if;
  end if;

  select coalesce(sum(case when type = 'credit' then amount else -amount end), 0)
    into v_balance
  from public.transactions where member_id = r.member_id;

  if v_balance < r.amount then
    raise exception 'Member has insufficient wallet balance ($%)', v_balance;
  end if;

  insert into public.transactions(member_id, type, amount, description, created_by, source, reference_id)
  values (r.member_id, 'debit', r.amount, 'Investment deposit', auth.uid(), 'investment', r.center_id);

  select id into v_investment_id from public.investments
    where member_id = r.member_id and center_id = r.center_id;
  if v_investment_id is null then
    insert into public.investments(member_id, center_id) values (r.member_id, r.center_id)
      returning id into v_investment_id;
  else
    update public.investments set status = 'active' where id = v_investment_id;
  end if;

  insert into public.investment_transactions(investment_id, type, amount, description, created_by)
  values (v_investment_id, 'deposit', r.amount, 'Deposit', auth.uid());

  update public.investment_join_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
end;
$$;

grant execute on function public.approve_investment_join(uuid) to authenticated;

-- Re-create the withdrawal approval with the lock-in check added.
create or replace function public.approve_investment_withdrawal(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_balance numeric;
  v_maintaining numeric;
  v_locked_until timestamptz;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into r from public.investment_withdrawal_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already processed'; end if;

  -- enforce lock-in: no withdrawals while still locked
  v_locked_until := public.investment_locked_until(r.investment_id);
  if v_locked_until is not null and now() < v_locked_until then
    raise exception 'Funds are locked until % and cannot be withdrawn yet.', v_locked_until::date;
  end if;

  select coalesce(sum(case when type in ('deposit','profit') then amount else -amount end), 0)
    into v_balance
  from public.investment_transactions where investment_id = r.investment_id;

  select c.maintaining_balance into v_maintaining
  from public.investments i
  join public.investment_centers c on c.id = i.center_id
  where i.id = r.investment_id;

  if r.amount > v_balance then
    raise exception 'Pull-out exceeds investment balance ($%)', v_balance;
  end if;
  if (v_balance - r.amount) < coalesce(v_maintaining, 0) then
    raise exception 'Pull-out would drop below required maintaining balance ($%)', v_maintaining;
  end if;

  insert into public.investment_transactions(investment_id, type, amount, description, created_by)
  values (r.investment_id, 'withdrawal', r.amount, 'Pulled out to wallet', auth.uid());

  insert into public.transactions(member_id, type, amount, description, created_by, source, reference_id)
  values (r.member_id, 'credit', r.amount, 'Investment pull-out', auth.uid(), 'investment', r.investment_id);

  update public.investment_withdrawal_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
end;
$$;

grant execute on function public.approve_investment_withdrawal(uuid) to authenticated;
