-- ============================================================
-- ZScope — REVOKE MEMBER (global investment exit)
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
--
-- When an admin revokes a member's access, every ACTIVE investment the
-- member holds (across all centers) is force-closed using the same rules
-- as a single-center removal:
--   * mode 'all'     -> return capital + profit to the member's wallet
--   * mode 'capital' -> return capital only, forfeit profit
-- Each closure is logged in investment_removals (so it stays auditable
-- and can be undone per-investment), then the profile is set to rejected.
-- ============================================================

create or replace function public.revoke_member(
  p_member_id uuid, p_mode text, p_reason text)
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

  for inv in
    select i.id, i.member_id, i.center_id
    from public.investments i
    where i.member_id = p_member_id and i.status = 'active'
  loop
    select coalesce(sum(
      case when type in ('deposit','profit') then amount
           when type in ('withdrawal','reversal') then -amount
           else 0 end), 0)
      into v_balance
    from public.investment_transactions where investment_id = inv.id;

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
      v_return := least(v_capital, v_balance);
    end if;
    v_forfeit := v_balance - v_return;

    v_removal_tx := null;
    v_wallet_tx := null;

    if v_balance > 0 then
      insert into public.investment_transactions(investment_id, type, amount, description, created_by)
      values (inv.id, 'withdrawal', v_balance,
              'Account revoked (' || p_mode || '): ' || p_reason, auth.uid())
      returning id into v_removal_tx;
    end if;

    if v_return > 0 then
      insert into public.transactions(member_id, type, amount, description, created_by, source, reference_id)
      values (inv.member_id, 'credit', v_return,
              'Returned on account revocation', auth.uid(), 'investment', inv.id)
      returning id into v_wallet_tx;
    end if;

    update public.investments set status = 'closed' where id = inv.id;

    insert into public.investment_removals(
      investment_id, member_id, center_id, mode, returned_amount, forfeited_amount, reason,
      removal_tx_id, wallet_tx_id, removed_by)
    values (inv.id, inv.member_id, inv.center_id, p_mode, v_return, v_forfeit,
            'Account revoked: ' || p_reason, v_removal_tx, v_wallet_tx, auth.uid());
  end loop;

  update public.profiles set status = 'rejected' where id = p_member_id;
end;
$$;
grant execute on function public.revoke_member(uuid, text, text) to authenticated;
