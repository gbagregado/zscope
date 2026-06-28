-- ============================================================
-- ZScope — MEMBER ACCOUNT INFO (address + main Solana account)
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
--
-- Members supply a mailing/physical address and their main Solana
-- account at sign-up. This is stored on their profile so the admin
-- always knows where to send funds (e.g. when revoking access and
-- returning the balance) without having to ask the member.
-- ============================================================

alter table public.profiles
  add column if not exists address text,
  add column if not exists solana_account text;

-- Capture the new fields from sign-up metadata when the profile is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status, address, solana_account)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    'member',
    'pending',
    nullif(btrim(coalesce(new.raw_user_meta_data->>'address', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data->>'solana_account', '')), '')
  );
  return new;
end;
$$;

-- Let members keep their own address / Solana account up to date WITHOUT
-- giving them a broad UPDATE policy on profiles (which would let them change
-- their own role/status). This SECURITY DEFINER function only touches the
-- two account-info columns for the caller's own row.
create or replace function public.update_my_account_info(p_address text, p_solana_account text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles
    set address = nullif(btrim(coalesce(p_address, '')), ''),
        solana_account = nullif(btrim(coalesce(p_solana_account, '')), '')
    where id = auth.uid();
end;
$$;
grant execute on function public.update_my_account_info(text, text) to authenticated;
