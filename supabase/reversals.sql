-- ============================================================
-- ZScope — UNDO / CORRECT (reversals)
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
-- (Fresh projects already include this via setup.sql.)
--
-- Money mistakes are corrected with an OFFSETTING entry, never a
-- silent delete — the original row stays for the audit trail.
-- Both functions are SECURITY DEFINER and self-check is_admin().
-- ============================================================

-- ------------------------------------------------------------
-- 1. WALLET (main balance) reversal
--    Inserts an opposite-type transaction of the same amount,
--    keeping the same source so balance + category nets correct.
-- ------------------------------------------------------------
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

  -- The reversal of a credit is a debit (reduces balance) — guard against negative.
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

-- ------------------------------------------------------------
-- 2. INVESTMENT ledger reversal
--    Adds a 'reversal' row that points at the original entry.
--    Only additive entries (deposit / profit) can be undone.
-- ------------------------------------------------------------

-- 2a. Allow the new type + link column.
alter table public.investment_transactions
  drop constraint if exists investment_transactions_type_check;
alter table public.investment_transactions
  add constraint investment_transactions_type_check
  check (type in ('deposit', 'profit', 'withdrawal', 'reversal'));

alter table public.investment_transactions
  add column if not exists reverses_id uuid references public.investment_transactions(id);

-- 2b. Rebuild the balance view so reversals subtract from balance
--     and from the correct category total.
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

-- 2c. The reversal function.
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

  -- Reversing an additive entry reduces the balance — guard against negative.
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

-- ------------------------------------------------------------
-- 3. Grants (functions self-check is_admin internally)
-- ------------------------------------------------------------
grant execute on function public.reverse_wallet_transaction(uuid) to authenticated;
grant execute on function public.reverse_investment_transaction(uuid) to authenticated;
