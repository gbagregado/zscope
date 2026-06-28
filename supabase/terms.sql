-- ============================================================
-- ZScope — INVESTMENT AWARENESS / TERMS AGREEMENT
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
-- (Fresh projects already include this via setup.sql.)
--
-- Adds a one-time risk/awareness agreement that every member must
-- accept once after logging in. Acceptance is stored on the profile
-- (timestamp = audit trail), so it shows only once ever per member.
--
-- This migration leaves terms_accepted_at NULL for everyone, so ALL
-- members (existing included) will be prompted on their next login.
-- ============================================================

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_accepted_at is
  'When the member accepted the investment awareness/risk agreement. NULL = not yet accepted (will be prompted on login).';

-- Member-callable RPC to record acceptance. SECURITY DEFINER so we do
-- NOT have to open a broad member UPDATE policy on profiles (which could
-- let a member tamper with their own role/status). This only ever stamps
-- terms_accepted_at for the calling user.
create or replace function public.accept_terms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles
    set terms_accepted_at = now()
    where id = auth.uid() and terms_accepted_at is null;
end;
$$;

grant execute on function public.accept_terms() to authenticated;
