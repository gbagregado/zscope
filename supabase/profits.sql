-- ============================================================
-- ZScope — PROFIT support
-- Run in Supabase Dashboard → SQL Editor.
-- Lets admins record a member's profit as a credit transaction
-- tagged with source = 'profit', so the member dashboard can
-- show profit separately from regular deposits.
-- ============================================================

-- 1. Allow 'profit' as a transaction source
alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'payment_request', 'withdrawal', 'profit'));

-- 2. Ensure admins can insert transactions (profit credits)
drop policy if exists "Admins insert transactions" on public.transactions;
create policy "Admins insert transactions" on public.transactions
  for insert with check (public.is_admin());

-- 3. Ensure admins can read all transactions (to show profit history)
drop policy if exists "Admins see all transactions" on public.transactions;
create policy "Admins see all transactions" on public.transactions
  for select using (public.is_admin());
