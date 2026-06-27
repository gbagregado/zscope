-- =========================================================
-- ZScope — Investment FUND CAP
-- Run in Supabase Dashboard -> SQL Editor.
-- Adds an optional maximum amount of member capital a center
-- can hold. 0 (or null) = unlimited. The cap is enforced when
-- an admin approves a join request: net deposits (deposits
-- minus pull-outs, profit excluded) may not exceed the cap.
-- Admin can change the cap freely at any time.
-- =========================================================

alter table public.investment_centers
  add column if not exists fund_cap numeric(14,2) not null default 0;

comment on column public.investment_centers.fund_cap is
  'Maximum member capital (net deposits) the center may hold. 0 = unlimited.';

-- Helper: net member capital currently raised by a center
-- = sum(deposits) - sum(withdrawals), profit excluded.
create or replace function public.investment_center_raised(p_center_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case t.type
      when 'deposit'    then t.amount
      when 'withdrawal' then -t.amount
      else 0
    end), 0)
  from public.investment_transactions t
  join public.investments i on i.id = t.investment_id
  where i.center_id = p_center_id;
$$;
grant execute on function public.investment_center_raised(uuid) to authenticated;

-- Re-create join approval with cap enforcement
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
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into r from public.investment_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already processed'; end if;

  -- enforce fund cap (0 = unlimited)
  select fund_cap into v_cap from public.investment_centers where id = r.center_id;
  if coalesce(v_cap, 0) > 0 then
    v_raised := public.investment_center_raised(r.center_id);
    if v_raised + r.amount > v_cap then
      raise exception 'Fund cap reached: % of % raised. Approving this % would exceed the cap by %.',
        v_raised, v_cap, r.amount, (v_raised + r.amount - v_cap);
    end if;
  end if;

  select coalesce(sum(case when type = 'credit' then amount else -amount end), 0)
    into v_balance
  from public.transactions where member_id = r.member_id;

  if v_balance < r.amount then
    raise exception 'Member has insufficient wallet balance (₱%)', v_balance;
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
