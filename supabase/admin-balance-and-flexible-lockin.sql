-- ============================================================
-- ZScope — ADMIN MANUAL BALANCE ADJUSTMENT + FLEXIBLE LOCK-IN
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
--
-- 1) admin_adjust_balance: lets an admin credit OR debit a member's
--    wallet with a required reason. Every adjustment is written to the
--    transactions ledger (source = 'manual') so it appears in history
--    and stays auditable. A debit cannot exceed the available balance.
--
-- 2) Flexible lock-in on investment centers. In addition to the existing
--    lock_in_months, centers can now lock by extra days and/or by a
--    fixed calendar end date (same for everyone):
--      * lock_in_until set  -> locked until that absolute date
--      * else months/days   -> locked for (months + days) from join date
--      * all zero / null    -> no lock-in
-- ============================================================

-- ---------- 1. Manual balance adjustment ----------
create or replace function public.admin_adjust_balance(
  p_member_id uuid,
  p_direction text,
  p_amount numeric,
  p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_direction not in ('credit', 'debit') then raise exception 'Invalid direction'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;

  if p_direction = 'debit' then
    select coalesce(sum(case when type = 'credit' then amount else -amount end), 0)
      into v_balance
    from public.transactions
    where member_id = p_member_id;

    if p_amount > v_balance then
      raise exception 'Cannot debit %; it exceeds the available balance of %', p_amount, v_balance;
    end if;
  end if;

  insert into public.transactions(member_id, type, amount, description, created_by, source)
  values (p_member_id, p_direction, p_amount,
          'Manual adjustment: ' || btrim(p_reason), auth.uid(), 'manual');
end;
$$;

grant execute on function public.admin_adjust_balance(uuid, text, numeric, text) to authenticated;

-- ---------- 2. Flexible lock-in columns ----------
alter table public.investment_centers
  add column if not exists lock_in_days int not null default 0,
  add column if not exists lock_in_until date;

comment on column public.investment_centers.lock_in_days is
  'Extra lock-in days added on top of lock_in_months (relative to join date).';
comment on column public.investment_centers.lock_in_until is
  'Optional fixed calendar end date; when set, the position is locked until this date regardless of join date.';
