-- ============================================================
-- ZScope — Cash Flow Monitoring System
-- Supabase SQL Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  full_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default now()
);

-- 2. TRANSACTIONS (ledger — source of truth for balance)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  created_by uuid not null references public.profiles(id),
  source text not null default 'manual' check (source in ('manual', 'payment_request', 'withdrawal')),
  reference_id uuid null,
  created_at timestamptz not null default now()
);

-- 3. PAYMENT METHODS (admin's QR codes for receiving funds)
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_name text not null,
  account_number text not null,
  qr_image_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. PAYMENT REQUESTS (member sends funds → admin confirms)
create table public.payment_requests (
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

-- 5. WITHDRAWAL REQUESTS (member requests payout → admin sends + attaches proof)
create table public.withdrawal_requests (
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

-- 6. ANNOUNCEMENTS
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_transactions_member_id on public.transactions(member_id);
create index idx_transactions_created_at on public.transactions(created_at desc);
create index idx_payment_requests_member_id on public.payment_requests(member_id);
create index idx_payment_requests_status on public.payment_requests(status);
create index idx_withdrawal_requests_member_id on public.withdrawal_requests(member_id);
create index idx_withdrawal_requests_status on public.withdrawal_requests(status);

-- ============================================================
-- BALANCE VIEW (computed — never stored statically)
-- ============================================================
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.transactions        enable row level security;
alter table public.payment_methods     enable row level security;
alter table public.payment_requests    enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.announcements       enable row level security;

-- PROFILES
create policy "Members see own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Admins see all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins update any profile" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- TRANSACTIONS
create policy "Members see own transactions" on public.transactions
  for select using (member_id = auth.uid());
create policy "Admins see all transactions" on public.transactions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins insert transactions" on public.transactions
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- PAYMENT METHODS
create policy "Active payment methods visible to authenticated users" on public.payment_methods
  for select using (auth.role() = 'authenticated' and is_active = true);
create policy "Admins manage payment methods" on public.payment_methods
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- PAYMENT REQUESTS
create policy "Members see own payment requests" on public.payment_requests
  for select using (member_id = auth.uid());
create policy "Members insert own payment requests" on public.payment_requests
  for insert with check (member_id = auth.uid());
create policy "Admins see all payment requests" on public.payment_requests
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins update payment requests" on public.payment_requests
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- WITHDRAWAL REQUESTS
create policy "Members see own withdrawal requests" on public.withdrawal_requests
  for select using (member_id = auth.uid());
create policy "Members insert own withdrawal requests" on public.withdrawal_requests
  for insert with check (member_id = auth.uid());
create policy "Admins see all withdrawal requests" on public.withdrawal_requests
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins update withdrawal requests" on public.withdrawal_requests
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ANNOUNCEMENTS
create policy "Authenticated users see announcements" on public.announcements
  for select using (auth.role() = 'authenticated');
create policy "Admins manage announcements" on public.announcements
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE BUCKETS (run separately if needed)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false);
-- insert into storage.buckets (id, name, public) values ('qr-codes', 'qr-codes', true);
