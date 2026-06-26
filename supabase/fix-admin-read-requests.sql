-- ============================================================
-- ZScope — ensure admin can READ/UPDATE member requests
-- Run in Supabase Dashboard → SQL Editor if admin can't see
-- member add-funds / withdrawal requests.
-- Uses the existing public.is_admin() SECURITY DEFINER function
-- (same fix used for the profiles recursion).
-- ============================================================

-- Safety: make sure is_admin() exists
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

-- ---------- PAYMENT REQUESTS ----------
drop policy if exists "Admins see all payment requests" on public.payment_requests;
create policy "Admins see all payment requests" on public.payment_requests
  for select using (public.is_admin());

drop policy if exists "Admins update payment requests" on public.payment_requests;
create policy "Admins update payment requests" on public.payment_requests
  for update using (public.is_admin());

-- ---------- WITHDRAWAL REQUESTS ----------
drop policy if exists "Admins see all withdrawal requests" on public.withdrawal_requests;
create policy "Admins see all withdrawal requests" on public.withdrawal_requests
  for select using (public.is_admin());

drop policy if exists "Admins update withdrawal requests" on public.withdrawal_requests;
create policy "Admins update withdrawal requests" on public.withdrawal_requests
  for update using (public.is_admin());

-- ---------- TRANSACTIONS ----------
drop policy if exists "Admins see all transactions" on public.transactions;
create policy "Admins see all transactions" on public.transactions
  for select using (public.is_admin());

drop policy if exists "Admins insert transactions" on public.transactions;
create policy "Admins insert transactions" on public.transactions
  for insert with check (public.is_admin());

-- ---------- Quick check: list pending payment requests (bypasses RLS as you are running as owner) ----------
-- select id, member_id, amount, status, created_at from public.payment_requests order by created_at desc limit 20;
