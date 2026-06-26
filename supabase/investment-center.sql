-- ============================================================
-- ZScope — INVESTMENT CENTER module
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================
-- Model:
--   investment_centers          — products the admin creates
--   investments                 — a member's stake in a center
--   investment_transactions     — per-investment ledger (deposit/profit/withdrawal)
--   investment_join_requests    — member asks to join with an amount
--   investment_withdrawal_requests — member asks to pull money back to wallet
-- Money rules are enforced in SECURITY DEFINER functions (admin only).
-- ============================================================

-- Allow 'investment' as a main-wallet transaction source
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'payment_request', 'withdrawal', 'profit', 'investment'));

-- 1. CENTERS ------------------------------------------------
create table if not exists public.investment_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  storage_path text,
  expected_return_pct numeric(6,2) not null default 0,
  min_investment numeric(12,2) not null default 0,
  maintaining_balance numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 2. INVESTMENTS (membership) -------------------------------
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  center_id uuid not null references public.investment_centers(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  unique (member_id, center_id)
);

-- 3. INVESTMENT LEDGER --------------------------------------
create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  type text not null check (type in ('deposit', 'profit', 'withdrawal')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 4. JOIN REQUESTS ------------------------------------------
create table if not exists public.investment_join_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  center_id uuid not null references public.investment_centers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. INVESTMENT WITHDRAWAL (pull out) REQUESTS --------------
create table if not exists public.investment_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 6. BALANCE VIEW (security_invoker so RLS applies) ---------
create or replace view public.investment_balances
with (security_invoker = true) as
select
  i.id            as investment_id,
  i.member_id,
  i.center_id,
  i.status,
  i.created_at,
  coalesce(sum(case when t.type in ('deposit','profit') then t.amount else -t.amount end), 0) as balance,
  coalesce(sum(case when t.type = 'deposit'    then t.amount else 0 end), 0) as total_deposits,
  coalesce(sum(case when t.type = 'profit'     then t.amount else 0 end), 0) as total_profit,
  coalesce(sum(case when t.type = 'withdrawal' then t.amount else 0 end), 0) as total_withdrawn
from public.investments i
left join public.investment_transactions t on t.investment_id = i.id
group by i.id, i.member_id, i.center_id, i.status, i.created_at;

-- ============================================================
-- RLS
-- ============================================================
alter table public.investment_centers enable row level security;
alter table public.investments enable row level security;
alter table public.investment_transactions enable row level security;
alter table public.investment_join_requests enable row level security;
alter table public.investment_withdrawal_requests enable row level security;

-- CENTERS: everyone authenticated reads; admins manage
drop policy if exists "Authenticated read centers" on public.investment_centers;
create policy "Authenticated read centers" on public.investment_centers
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage centers" on public.investment_centers;
create policy "Admins manage centers" on public.investment_centers
  for all using (public.is_admin()) with check (public.is_admin());

-- INVESTMENTS: member reads own; admin reads all
drop policy if exists "Members read own investments" on public.investments;
create policy "Members read own investments" on public.investments
  for select using (member_id = auth.uid());
drop policy if exists "Admins read all investments" on public.investments;
create policy "Admins read all investments" on public.investments
  for select using (public.is_admin());

-- INVESTMENT LEDGER: member reads own (via investment); admin reads all
drop policy if exists "Members read own investment tx" on public.investment_transactions;
create policy "Members read own investment tx" on public.investment_transactions
  for select using (
    exists (select 1 from public.investments i where i.id = investment_id and i.member_id = auth.uid())
  );
drop policy if exists "Admins read all investment tx" on public.investment_transactions;
create policy "Admins read all investment tx" on public.investment_transactions
  for select using (public.is_admin());

-- JOIN REQUESTS: member inserts/reads own; admin reads/updates all
drop policy if exists "Members insert own join req" on public.investment_join_requests;
create policy "Members insert own join req" on public.investment_join_requests
  for insert with check (member_id = auth.uid());
drop policy if exists "Members read own join req" on public.investment_join_requests;
create policy "Members read own join req" on public.investment_join_requests
  for select using (member_id = auth.uid());
drop policy if exists "Admins read join req" on public.investment_join_requests;
create policy "Admins read join req" on public.investment_join_requests
  for select using (public.is_admin());
drop policy if exists "Admins update join req" on public.investment_join_requests;
create policy "Admins update join req" on public.investment_join_requests
  for update using (public.is_admin());

-- WITHDRAWAL REQUESTS: member inserts/reads own; admin reads/updates all
drop policy if exists "Members insert own inv wd req" on public.investment_withdrawal_requests;
create policy "Members insert own inv wd req" on public.investment_withdrawal_requests
  for insert with check (member_id = auth.uid());
drop policy if exists "Members read own inv wd req" on public.investment_withdrawal_requests;
create policy "Members read own inv wd req" on public.investment_withdrawal_requests
  for select using (member_id = auth.uid());
drop policy if exists "Admins read inv wd req" on public.investment_withdrawal_requests;
create policy "Admins read inv wd req" on public.investment_withdrawal_requests
  for select using (public.is_admin());
drop policy if exists "Admins update inv wd req" on public.investment_withdrawal_requests;
create policy "Admins update inv wd req" on public.investment_withdrawal_requests
  for update using (public.is_admin());

-- ============================================================
-- STORAGE bucket for center images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('investment-centers', 'investment-centers', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read center images" on storage.objects;
create policy "Public read center images" on storage.objects
  for select using (bucket_id = 'investment-centers');
drop policy if exists "Admins upload center images" on storage.objects;
create policy "Admins upload center images" on storage.objects
  for insert with check (bucket_id = 'investment-centers' and public.is_admin());
drop policy if exists "Admins update center images" on storage.objects;
create policy "Admins update center images" on storage.objects
  for update using (bucket_id = 'investment-centers' and public.is_admin());
drop policy if exists "Admins delete center images" on storage.objects;
create policy "Admins delete center images" on storage.objects
  for delete using (bucket_id = 'investment-centers' and public.is_admin());

-- ============================================================
-- MONEY FUNCTIONS (admin only, atomic)
-- ============================================================

-- Approve a join request: debit wallet → create/topup investment → deposit
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
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into r from public.investment_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already processed'; end if;

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

-- Add profit to a member's investment
create or replace function public.add_investment_profit(p_investment_id uuid, p_amount numeric, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  insert into public.investment_transactions(investment_id, type, amount, description, created_by)
  values (p_investment_id, 'profit', p_amount, coalesce(nullif(p_note, ''), 'Profit'), auth.uid());
end;
$$;

-- Approve a pull-out: enforce maintaining balance → withdraw → credit wallet
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
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into r from public.investment_withdrawal_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already processed'; end if;

  select coalesce(sum(case when type in ('deposit','profit') then amount else -amount end), 0)
    into v_balance
  from public.investment_transactions where investment_id = r.investment_id;

  select c.maintaining_balance into v_maintaining
  from public.investments i
  join public.investment_centers c on c.id = i.center_id
  where i.id = r.investment_id;

  if r.amount > v_balance then
    raise exception 'Pull-out exceeds investment balance (₱%)', v_balance;
  end if;
  if (v_balance - r.amount) < coalesce(v_maintaining, 0) then
    raise exception 'Pull-out would drop below required maintaining balance (₱%)', v_maintaining;
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

-- Allow authenticated users to call these RPCs (the functions self-check is_admin)
grant execute on function public.approve_investment_join(uuid) to authenticated;
grant execute on function public.add_investment_profit(uuid, numeric, text) to authenticated;
grant execute on function public.approve_investment_withdrawal(uuid) to authenticated;
