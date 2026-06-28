-- ============================================================
-- ZScope — MAX INVESTMENT PER MEMBER (per center)
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
-- (Fresh projects already include this via setup.sql.)
--
-- Adds a per-member cap on net invested capital in a center.
--   0 = unlimited (default).
-- Enforced inside approve_investment_join() — a member's existing
-- net deposits + the new amount may not exceed the cap.
-- ============================================================

alter table public.investment_centers
  add column if not exists max_per_member numeric(14,2) not null default 0;

comment on column public.investment_centers.max_per_member is
  'Maximum net capital (deposits - withdrawals) a single member may hold in this center. 0 = unlimited.';

-- Re-create the join approval with the per-member cap added.
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
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into r from public.investment_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already processed'; end if;

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
