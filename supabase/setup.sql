-- ============================================================
-- ZScope — CONSOLIDATED PRODUCTION SETUP
-- Cash Flow Monitoring System (Supabase)
--
-- HOW TO USE:
--   1. Create a new Supabase project.
--   2. Open Dashboard → SQL Editor → New Query.
--   3. Paste this ENTIRE file and run it once.
--   4. Then create the admin account (see step 7 / HANDOVER.md).
--
-- This single script replaces running the individual files
-- (schema, investment-center, investment-fund-cap, profits,
-- advertisements, announcements-image, storage-policies,
-- fix-admin-read-requests). It is ordered correctly so every
-- dependency (especially is_admin()) exists before it is used.
--
-- Safe to run on a FRESH project. It is mostly idempotent, but
-- it is intended as a one-time provisioning script.
-- ============================================================


-- ============================================================
-- 0. HELPER — is_admin()  (defined FIRST; used everywhere)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


-- ============================================================
-- 1. CORE TABLES
-- ============================================================

-- 1.1 PROFILES (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  full_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default now()
);

-- 1.2 TRANSACTIONS (wallet ledger — source of truth for balance)
-- NOTE: source constraint already includes all five values used
-- across the app (avoids the historical ordering bug where
-- profits.sql narrowed it and dropped 'investment').
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  created_by uuid not null references public.profiles(id),
  source text not null default 'manual'
    check (source in ('manual', 'payment_request', 'withdrawal', 'profit', 'investment')),
  reference_id uuid null,
  created_at timestamptz not null default now()
);

-- 1.3 PAYMENT METHODS (admin's receiving wallets / QR codes)
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_name text not null,
  account_number text not null,
  qr_image_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 1.4 PAYMENT REQUESTS (member sends funds → admin confirms)
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  reference_number text not null,
  screenshot_url text null,
  payment_method text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_notes text null,
  reviewed_by uuid null references public.profiles(id),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);

-- 1.5 WITHDRAWAL REQUESTS (member requests payout → admin sends + proof)
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  member_payment_method text not null,
  member_account_name text not null,
  member_account_number text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reference_number text null,
  proof_url text null,
  admin_notes text null,
  reviewed_by uuid null references public.profiles(id),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);

-- 1.6 ANNOUNCEMENTS (with optional banner image columns inline)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text null,
  storage_path text null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 1.7 ADVERTISEMENTS (admin image carousel)
create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);


-- ============================================================
-- 2. INVESTMENT MODULE TABLES
-- ============================================================

-- 2.1 CENTERS (fund_cap included inline; 0 = unlimited)
create table if not exists public.investment_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  storage_path text,
  expected_return_pct numeric(6,2) not null default 0,
  min_investment numeric(12,2) not null default 0,
  maintaining_balance numeric(12,2) not null default 0,
  fund_cap numeric(14,2) not null default 0,
  max_per_member numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
comment on column public.investment_centers.fund_cap is
  'Maximum member capital (net deposits) the center may hold. 0 = unlimited.';
comment on column public.investment_centers.max_per_member is
  'Maximum net capital (deposits - withdrawals) a single member may hold in this center. 0 = unlimited.';

-- 2.2 INVESTMENTS (a member's stake in a center)
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  center_id uuid not null references public.investment_centers(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  unique (member_id, center_id)
);

-- 2.3 INVESTMENT LEDGER (deposit / profit / withdrawal / reversal)
create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  type text not null check (type in ('deposit', 'profit', 'withdrawal', 'reversal')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_by uuid references public.profiles(id),
  reverses_id uuid references public.investment_transactions(id),
  created_at timestamptz not null default now()
);

-- 2.4 JOIN REQUESTS
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

-- 2.5 INVESTMENT WITHDRAWAL (pull-out) REQUESTS
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


-- ============================================================
-- 3. INDEXES
-- ============================================================
create index if not exists idx_transactions_member_id on public.transactions(member_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);
create index if not exists idx_payment_requests_member_id on public.payment_requests(member_id);
create index if not exists idx_payment_requests_status on public.payment_requests(status);
create index if not exists idx_withdrawal_requests_member_id on public.withdrawal_requests(member_id);
create index if not exists idx_withdrawal_requests_status on public.withdrawal_requests(status);


-- ============================================================
-- 4. VIEWS
-- ============================================================

-- 4.1 Wallet balance per member
create or replace view public.member_balances as
select
  p.id as member_id,
  p.full_name,
  p.email,
  coalesce(sum(case when t.type = 'credit' then t.amount else 0 end), 0) as total_credits,
  coalesce(sum(case when t.type = 'debit'  then t.amount else 0 end), 0) as total_debits,
  coalesce(sum(case when t.type = 'credit' then t.amount else 0 end), 0) -
  coalesce(sum(case when t.type = 'debit'  then t.amount else 0 end), 0) as balance
from public.profiles p
left join public.transactions t on t.member_id = p.id
where p.role = 'member'
group by p.id, p.full_name, p.email;

-- 4.2 Investment balance per investment (security_invoker so RLS applies)
--     'reversal' rows undo an earlier deposit/profit: they subtract from
--     balance and from the matching category total.
create or replace view public.investment_balances
with (security_invoker = true) as
with tx as (
  select t.*, orig.type as reverses_type
  from public.investment_transactions t
  left join public.investment_transactions orig on orig.id = t.reverses_id
)
select
  i.id            as investment_id,
  i.member_id,
  i.center_id,
  i.status,
  i.created_at,
  coalesce(sum(
    case
      when tx.type in ('deposit','profit') then tx.amount
      when tx.type in ('withdrawal','reversal') then -tx.amount
      else 0
    end
  ), 0) as balance,
  coalesce(sum(
    case
      when tx.type = 'deposit' then tx.amount
      when tx.type = 'reversal' and tx.reverses_type = 'deposit' then -tx.amount
      else 0
    end
  ), 0) as total_deposits,
  coalesce(sum(
    case
      when tx.type = 'profit' then tx.amount
      when tx.type = 'reversal' and tx.reverses_type = 'profit' then -tx.amount
      else 0
    end
  ), 0) as total_profit,
  coalesce(sum(case when tx.type = 'withdrawal' then tx.amount else 0 end), 0) as total_withdrawn
from public.investments i
left join tx on tx.investment_id = i.id
group by i.id, i.member_id, i.center_id, i.status, i.created_at;


-- ============================================================
-- 5. ROW LEVEL SECURITY — enable
-- ============================================================
alter table public.profiles                        enable row level security;
alter table public.transactions                     enable row level security;
alter table public.payment_methods                  enable row level security;
alter table public.payment_requests                 enable row level security;
alter table public.withdrawal_requests              enable row level security;
alter table public.announcements                    enable row level security;
alter table public.advertisements                   enable row level security;
alter table public.investment_centers               enable row level security;
alter table public.investments                       enable row level security;
alter table public.investment_transactions           enable row level security;
alter table public.investment_join_requests          enable row level security;
alter table public.investment_withdrawal_requests    enable row level security;


-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- ---------- PROFILES ----------
drop policy if exists "Members see own profile" on public.profiles;
create policy "Members see own profile" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "Admins see all profiles" on public.profiles;
create policy "Admins see all profiles" on public.profiles
  for select using (public.is_admin());
drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile" on public.profiles
  for update using (public.is_admin());

-- ---------- TRANSACTIONS ----------
drop policy if exists "Members see own transactions" on public.transactions;
create policy "Members see own transactions" on public.transactions
  for select using (member_id = auth.uid());
drop policy if exists "Admins see all transactions" on public.transactions;
create policy "Admins see all transactions" on public.transactions
  for select using (public.is_admin());
drop policy if exists "Admins insert transactions" on public.transactions;
create policy "Admins insert transactions" on public.transactions
  for insert with check (public.is_admin());

-- ---------- PAYMENT METHODS ----------
drop policy if exists "Active payment methods visible to authenticated users" on public.payment_methods;
create policy "Active payment methods visible to authenticated users" on public.payment_methods
  for select using (auth.role() = 'authenticated' and is_active = true);
drop policy if exists "Admins manage payment methods" on public.payment_methods;
create policy "Admins manage payment methods" on public.payment_methods
  for all using (public.is_admin());

-- ---------- PAYMENT REQUESTS ----------
drop policy if exists "Members see own payment requests" on public.payment_requests;
create policy "Members see own payment requests" on public.payment_requests
  for select using (member_id = auth.uid());
drop policy if exists "Members insert own payment requests" on public.payment_requests;
create policy "Members insert own payment requests" on public.payment_requests
  for insert with check (member_id = auth.uid());
drop policy if exists "Admins see all payment requests" on public.payment_requests;
create policy "Admins see all payment requests" on public.payment_requests
  for select using (public.is_admin());
drop policy if exists "Admins update payment requests" on public.payment_requests;
create policy "Admins update payment requests" on public.payment_requests
  for update using (public.is_admin());

-- ---------- WITHDRAWAL REQUESTS ----------
drop policy if exists "Members see own withdrawal requests" on public.withdrawal_requests;
create policy "Members see own withdrawal requests" on public.withdrawal_requests
  for select using (member_id = auth.uid());
drop policy if exists "Members insert own withdrawal requests" on public.withdrawal_requests;
create policy "Members insert own withdrawal requests" on public.withdrawal_requests
  for insert with check (member_id = auth.uid());
drop policy if exists "Admins see all withdrawal requests" on public.withdrawal_requests;
create policy "Admins see all withdrawal requests" on public.withdrawal_requests
  for select using (public.is_admin());
drop policy if exists "Admins update withdrawal requests" on public.withdrawal_requests;
create policy "Admins update withdrawal requests" on public.withdrawal_requests
  for update using (public.is_admin());

-- ---------- ANNOUNCEMENTS ----------
drop policy if exists "Authenticated users see announcements" on public.announcements;
create policy "Authenticated users see announcements" on public.announcements
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements" on public.announcements
  for all using (public.is_admin());

-- ---------- ADVERTISEMENTS ----------
drop policy if exists "Authenticated see active ads" on public.advertisements;
create policy "Authenticated see active ads" on public.advertisements
  for select using (auth.role() = 'authenticated' and is_active = true);
drop policy if exists "Admins see all ads" on public.advertisements;
create policy "Admins see all ads" on public.advertisements
  for select using (public.is_admin());
drop policy if exists "Admins insert ads" on public.advertisements;
create policy "Admins insert ads" on public.advertisements
  for insert with check (public.is_admin());
drop policy if exists "Admins update ads" on public.advertisements;
create policy "Admins update ads" on public.advertisements
  for update using (public.is_admin());
drop policy if exists "Admins delete ads" on public.advertisements;
create policy "Admins delete ads" on public.advertisements
  for delete using (public.is_admin());

-- ---------- INVESTMENT CENTERS ----------
drop policy if exists "Authenticated read centers" on public.investment_centers;
create policy "Authenticated read centers" on public.investment_centers
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage centers" on public.investment_centers;
create policy "Admins manage centers" on public.investment_centers
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- INVESTMENTS ----------
drop policy if exists "Members read own investments" on public.investments;
create policy "Members read own investments" on public.investments
  for select using (member_id = auth.uid());
drop policy if exists "Admins read all investments" on public.investments;
create policy "Admins read all investments" on public.investments
  for select using (public.is_admin());

-- ---------- INVESTMENT LEDGER ----------
drop policy if exists "Members read own investment tx" on public.investment_transactions;
create policy "Members read own investment tx" on public.investment_transactions
  for select using (
    exists (select 1 from public.investments i where i.id = investment_id and i.member_id = auth.uid())
  );
drop policy if exists "Admins read all investment tx" on public.investment_transactions;
create policy "Admins read all investment tx" on public.investment_transactions
  for select using (public.is_admin());

-- ---------- JOIN REQUESTS ----------
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

-- ---------- INVESTMENT WITHDRAWAL (pull-out) REQUESTS ----------
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
-- 7. STORAGE BUCKETS  (5 total)
-- ============================================================
insert into storage.buckets (id, name, public) values ('qr-codes', 'qr-codes', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false)
  on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('advertisements', 'advertisements', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('announcements', 'announcements', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('investment-centers', 'investment-centers', true)
  on conflict (id) do update set public = true;


-- ============================================================
-- 8. STORAGE POLICIES
-- ============================================================

-- ---------- QR CODES (public read; admin write) ----------
drop policy if exists "qr_codes_public_read" on storage.objects;
create policy "qr_codes_public_read" on storage.objects
  for select using (bucket_id = 'qr-codes');
drop policy if exists "qr_codes_admin_insert" on storage.objects;
create policy "qr_codes_admin_insert" on storage.objects
  for insert with check (bucket_id = 'qr-codes' and public.is_admin());
drop policy if exists "qr_codes_admin_update" on storage.objects;
create policy "qr_codes_admin_update" on storage.objects
  for update using (bucket_id = 'qr-codes' and public.is_admin());
drop policy if exists "qr_codes_admin_delete" on storage.objects;
create policy "qr_codes_admin_delete" on storage.objects
  for delete using (bucket_id = 'qr-codes' and public.is_admin());

-- ---------- PAYMENT PROOFS (private; member folder + admin) ----------
drop policy if exists "proofs_member_insert" on storage.objects;
create policy "proofs_member_insert" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "proofs_member_read_own" on storage.objects;
create policy "proofs_member_read_own" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "proofs_admin_read_all" on storage.objects;
create policy "proofs_admin_read_all" on storage.objects
  for select using (bucket_id = 'payment-proofs' and public.is_admin());
drop policy if exists "proofs_admin_insert" on storage.objects;
create policy "proofs_admin_insert" on storage.objects
  for insert with check (bucket_id = 'payment-proofs' and public.is_admin());

-- ---------- ADVERTISEMENTS (public read; admin write) ----------
drop policy if exists "Public read ads" on storage.objects;
create policy "Public read ads" on storage.objects
  for select using (bucket_id = 'advertisements');
drop policy if exists "Admins upload ads" on storage.objects;
create policy "Admins upload ads" on storage.objects
  for insert with check (bucket_id = 'advertisements' and public.is_admin());
drop policy if exists "Admins update ads storage" on storage.objects;
create policy "Admins update ads storage" on storage.objects
  for update using (bucket_id = 'advertisements' and public.is_admin());
drop policy if exists "Admins delete ads storage" on storage.objects;
create policy "Admins delete ads storage" on storage.objects
  for delete using (bucket_id = 'advertisements' and public.is_admin());

-- ---------- ANNOUNCEMENTS (public read; admin write) ----------
drop policy if exists "Public read announcement images" on storage.objects;
create policy "Public read announcement images" on storage.objects
  for select using (bucket_id = 'announcements');
drop policy if exists "Admins upload announcement images" on storage.objects;
create policy "Admins upload announcement images" on storage.objects
  for insert with check (bucket_id = 'announcements' and public.is_admin());
drop policy if exists "Admins update announcement images" on storage.objects;
create policy "Admins update announcement images" on storage.objects
  for update using (bucket_id = 'announcements' and public.is_admin());
drop policy if exists "Admins delete announcement images" on storage.objects;
create policy "Admins delete announcement images" on storage.objects
  for delete using (bucket_id = 'announcements' and public.is_admin());

-- ---------- INVESTMENT CENTERS (public read; admin write) ----------
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
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    'member',
    'pending'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 10. MONEY FUNCTIONS (admin only, atomic)
-- ============================================================

-- 10.1 Net member capital raised by a center (deposits - withdrawals; profit excluded)
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

-- 10.2 Approve a join request (with fund-cap enforcement)
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

-- 10.3 Add profit to a member's investment
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

-- 10.4 Approve a pull-out (enforce maintaining balance → withdraw → credit wallet)
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

-- Grants (functions self-check is_admin internally)
grant execute on function public.is_admin() to authenticated;
grant execute on function public.investment_center_raised(uuid) to authenticated;
grant execute on function public.approve_investment_join(uuid) to authenticated;
grant execute on function public.add_investment_profit(uuid, numeric, text) to authenticated;
grant execute on function public.approve_investment_withdrawal(uuid) to authenticated;


-- 10.5 Undo a wallet entry (offsetting opposite-type transaction)
create or replace function public.reverse_wallet_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  orig record;
  v_balance numeric;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into orig from public.transactions where id = p_transaction_id;
  if not found then raise exception 'Transaction not found'; end if;
  if orig.description like 'Reversal:%' then
    raise exception 'This entry is already a reversal and cannot be undone again';
  end if;
  if exists (
    select 1 from public.transactions
    where reference_id = p_transaction_id and description like 'Reversal:%'
  ) then
    raise exception 'This entry has already been undone';
  end if;

  if orig.type = 'credit' then
    select coalesce(sum(case when type = 'credit' then amount else -amount end), 0)
      into v_balance
    from public.transactions where member_id = orig.member_id;
    if v_balance < orig.amount then
      raise exception 'Cannot undo: member balance ($%) is lower than the amount ($%)', v_balance, orig.amount;
    end if;
  end if;

  insert into public.transactions(member_id, type, amount, description, created_by, source, reference_id)
  values (
    orig.member_id,
    case when orig.type = 'credit' then 'debit' else 'credit' end,
    orig.amount,
    'Reversal: ' || orig.description,
    auth.uid(),
    orig.source,
    p_transaction_id
  );
end;
$$;

-- 10.6 Undo an investment ledger entry (deposit/profit only)
create or replace function public.reverse_investment_transaction(p_tx_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  orig record;
  v_balance numeric;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select * into orig from public.investment_transactions where id = p_tx_id;
  if not found then raise exception 'Entry not found'; end if;
  if orig.type not in ('deposit', 'profit') then
    raise exception 'Only deposit or profit entries can be undone';
  end if;
  if exists (select 1 from public.investment_transactions where reverses_id = p_tx_id) then
    raise exception 'This entry has already been undone';
  end if;

  select coalesce(sum(case when type in ('deposit','profit') then amount
                           when type in ('withdrawal','reversal') then -amount
                           else 0 end), 0)
    into v_balance
  from public.investment_transactions where investment_id = orig.investment_id;
  if v_balance < orig.amount then
    raise exception 'Cannot undo: investment balance ($%) is lower than the amount ($%)', v_balance, orig.amount;
  end if;

  insert into public.investment_transactions(investment_id, type, amount, description, created_by, reverses_id)
  values (
    orig.investment_id,
    'reversal',
    orig.amount,
    'Reversal: ' || coalesce(orig.description, orig.type),
    auth.uid(),
    p_tx_id
  );
end;
$$;

grant execute on function public.reverse_wallet_transaction(uuid) to authenticated;
grant execute on function public.reverse_investment_transaction(uuid) to authenticated;


-- ============================================================
-- 11. REALTIME — notification badges (admin pending counts)
-- ============================================================
-- Adds the request tables to the realtime publication so the
-- admin app gets instant updates. Wrapped to ignore duplicates.
do $$
begin
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payment_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.withdrawal_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.investment_join_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.investment_withdrawal_requests; exception when duplicate_object then null; end;
end $$;


-- ============================================================
-- DONE.
-- Next: create the admin account.
--   1. Register the admin via the app (or Dashboard → Auth → Add user, Auto Confirm).
--   2. Run, with their email:
--        update public.profiles set role='admin', status='active'
--          where email = 'ADMIN_EMAIL_HERE';
--        update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
--          where email = 'ADMIN_EMAIL_HERE';
-- ============================================================
