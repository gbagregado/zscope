-- ============================================================
-- ZScope — PER-MEMBER CUSTOM CAP + ADMIN REMOVE-FROM-INVESTMENT
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
-- (Fresh projects already include this via setup.sql.)
--
-- A) Per-member cap override (per center): an admin can give a specific
--    member a different max than the center's max_per_member. When an
--    override exists it takes precedence; otherwise the center default
--    applies. Override value 0 = unlimited for that member.
--
-- B) Admin removal ("kick out"): a forced full exit. The admin chooses
--    to return everything (capital + profit) or only capital (forfeiting
--    profit) to the member's wallet, must give a reason, and the
--    investment is closed. Funds are never confiscated silently.
-- ============================================================

-- ---------- A) PER-MEMBER CAP OVERRIDE ----------
create table if not exists public.investment_member_caps (
  center_id uuid not null references public.investment_centers(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  max_amount numeric(14,2) not null default 0,  -- 0 = unlimited for this member
  set_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (center_id, member_id)
);
comment on table public.investment_member_caps is
  'Per-member override of a center''s max_per_member. Presence of a row overrides the center default; max_amount 0 = unlimited for that member.';

alter table public.investment_member_caps enable row level security;

drop policy if exists "Members read own cap" on public.investment_member_caps;
create policy "Members read own cap" on public.investment_member_caps
  for select using (member_id = auth.uid());
drop policy if exists "Admins read all caps" on public.investment_member_caps;
create policy "Admins read all caps" on public.investment_member_caps
  for select using (public.is_admin());
drop policy if exists "Admins manage caps" on public.investment_member_caps;
create policy "Admins manage caps" on public.investment_member_caps
  for all using (public.is_admin()) with check (public.is_admin());

-- Admin sets/clears a member's override. p_max null => clear (use center default).
create or replace function public.set_member_cap(p_center_id uuid, p_member_id uuid, p_max numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_max is null then
    delete from public.investment_member_caps
      where center_id = p_center_id and member_id = p_member_id;
  else
    if p_max < 0 then raise exception 'Limit cannot be negative'; end if;
    insert into public.investment_member_caps(center_id, member_id, max_amount, set_by, updated_at)
    values (p_center_id, p_member_id, p_max, auth.uid(), now())
    on conflict (center_id, member_id)
      do update set max_amount = excluded.max_amount, set_by = auth.uid(), updated_at = now();
  end if;
end;
$$;
grant execute on function public.set_member_cap(uuid, uuid, numeric) to authenticated;

-- ---------- B) ADMIN REMOVAL AUDIT + RPC ----------
create table if not exists public.investment_removals (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null,
  member_id uuid not null references public.profiles(id),
  center_id uuid not null references public.investment_centers(id),
  mode text not null check (mode in ('all', 'capital')),
  returned_amount numeric(14,2) not null,
  forfeited_amount numeric(14,2) not null default 0,
  reason text not null,
  removal_tx_id uuid,   -- investment_transactions withdrawal created by the removal
  wallet_tx_id uuid,    -- wallet credit created by the removal
  removed_by uuid references public.profiles(id),
  reverted_at timestamptz,
  reverted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
comment on table public.investment_removals is
  'Audit log of admin-forced removals from an investment (kick-out). reverted_at set when undone.';

alter table public.investment_removals enable row level security;
drop policy if exists "Admins read removals" on public.investment_removals;
create policy "Admins read removals" on public.investment_removals
  for select using (public.is_admin());

create or replace function public.remove_member_from_investment(
  p_investment_id uuid, p_mode text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  v_balance numeric;
  v_capital numeric;
  v_return numeric;
  v_forfeit numeric;
  v_removal_tx uuid;
  v_wallet_tx uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_mode not in ('all', 'capital') then raise exception 'Invalid mode'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;

  select i.id, i.member_id, i.center_id, i.status
    into inv
  from public.investments i where i.id = p_investment_id;
  if not found then raise exception 'Investment not found'; end if;
  if inv.status = 'closed' then raise exception 'Investment is already closed'; end if;

  -- current investment balance (deposits + profit - withdrawals - reversals)
  select coalesce(sum(
    case when type in ('deposit','profit') then amount
         when type in ('withdrawal','reversal') then -amount
         else 0 end), 0)
    into v_balance
  from public.investment_transactions where investment_id = inv.id;

  -- net capital (what the member actually put in)
  select coalesce(sum(
    case when type = 'deposit' then amount
         when type = 'withdrawal' then -amount
         else 0 end), 0)
    into v_capital
  from public.investment_transactions where investment_id = inv.id;

  if v_balance < 0 then v_balance := 0; end if;
  if v_capital < 0 then v_capital := 0; end if;

  if p_mode = 'all' then
    v_return := v_balance;
  else
    v_return := least(v_capital, v_balance);  -- capital only; profit forfeited
  end if;
  v_forfeit := v_balance - v_return;

  -- Zero out the investment ledger with a single withdrawal of the whole balance.
  if v_balance > 0 then
    insert into public.investment_transactions(investment_id, type, amount, description, created_by)
    values (inv.id, 'withdrawal', v_balance,
            'Removed by admin (' || p_mode || '): ' || p_reason, auth.uid())
    returning id into v_removal_tx;
  end if;

  -- Credit the member's wallet with the returned portion only.
  if v_return > 0 then
    insert into public.transactions(member_id, type, amount, description, created_by, source, reference_id)
    values (inv.member_id, 'credit', v_return,
            'Removed from investment by admin', auth.uid(), 'investment', inv.id)
    returning id into v_wallet_tx;
  end if;

  update public.investments set status = 'closed' where id = inv.id;

  insert into public.investment_removals(
    investment_id, member_id, center_id, mode, returned_amount, forfeited_amount, reason,
    removal_tx_id, wallet_tx_id, removed_by)
  values (inv.id, inv.member_id, inv.center_id, p_mode, v_return, v_forfeit, p_reason,
          v_removal_tx, v_wallet_tx, auth.uid());
end;
$$;
grant execute on function public.remove_member_from_investment(uuid, text, text) to authenticated;

-- Undo a removal: reverse the wallet credit + investment withdrawal and reopen.
create or replace function public.undo_member_removal(p_removal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rem record;
  v_wallet_balance numeric;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into rem from public.investment_removals where id = p_removal_id;
  if not found then raise exception 'Removal not found'; end if;
  if rem.reverted_at is not null then raise exception 'This removal was already undone'; end if;

  -- The returned funds went into the member's wallet; make sure they are still
  -- there before we pull them back (prevents a negative wallet).
  if rem.returned_amount > 0 then
    select coalesce(sum(case when type = 'credit' then amount else -amount end), 0)
      into v_wallet_balance
    from public.transactions where member_id = rem.member_id;
    if v_wallet_balance < rem.returned_amount then
      raise exception 'Cannot undo: member wallet balance ($%) is less than the $% that was returned. They may have already spent or withdrawn it.',
        v_wallet_balance, rem.returned_amount;
    end if;
  end if;

  -- Remove the wallet credit and the investment withdrawal the removal created.
  if rem.wallet_tx_id is not null then
    delete from public.transactions where id = rem.wallet_tx_id;
  end if;
  if rem.removal_tx_id is not null then
    delete from public.investment_transactions where id = rem.removal_tx_id;
  end if;

  update public.investments set status = 'active' where id = rem.investment_id;

  update public.investment_removals
    set reverted_at = now(), reverted_by = auth.uid()
    where id = p_removal_id;
end;
$$;
grant execute on function public.undo_member_removal(uuid) to authenticated;

-- ---------- C) JOIN APPROVAL: honour per-member override ----------
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
  v_override numeric;
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

  -- per-member override takes precedence over the center default
  select max_amount into v_override
  from public.investment_member_caps
  where center_id = r.center_id and member_id = r.member_id;
  if v_override is not null then
    v_member_cap := v_override;
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
