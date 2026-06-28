-- ============================================================
-- ZScope — GENERIC PAYOUT DETAILS (chain/network + wallet address)
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
--
-- Generalises the member payout info from Solana-only to any chain:
-- a network/chain label plus a wallet address. Existing solana_account
-- values are backfilled into wallet_address with network 'Solana'.
-- ============================================================

alter table public.profiles
  add column if not exists payout_network text,
  add column if not exists wallet_address text;

-- backfill from the old solana_account column (kept for history)
update public.profiles
  set wallet_address = solana_account,
      payout_network = coalesce(payout_network, 'Solana')
  where wallet_address is null and solana_account is not null;

-- Capture network + wallet from sign-up metadata when the profile is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status, address, payout_network, wallet_address)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    'member',
    'pending',
    nullif(btrim(coalesce(new.raw_user_meta_data->>'address', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data->>'payout_network', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data->>'wallet_address', '')), '')
  );
  return new;
end;
$$;

-- Members keep their own payout details up to date (no broad UPDATE policy).
drop function if exists public.update_my_account_info(text, text);
create or replace function public.update_my_account_info(
  p_address text, p_payout_network text, p_wallet_address text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles
    set address = nullif(btrim(coalesce(p_address, '')), ''),
        payout_network = nullif(btrim(coalesce(p_payout_network, '')), ''),
        wallet_address = nullif(btrim(coalesce(p_wallet_address, '')), '')
    where id = auth.uid();
end;
$$;
grant execute on function public.update_my_account_info(text, text, text) to authenticated;
