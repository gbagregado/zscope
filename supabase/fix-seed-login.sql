-- =========================================================
-- ZScope — fix seed account login (HTTP 500 on sign-in)
-- Run in Supabase Dashboard -> SQL Editor.
--
-- Cause: seed-investments.sql inserted rows directly into
-- auth.users but left GoTrue's required string columns NULL
-- (confirmation_token, recovery_token, email_change, ...),
-- and created no auth.identities row. GoTrue then returns a
-- 500 on every password sign-in for those accounts.
--
-- This script is idempotent — safe to run more than once.
-- All seed logins use the password:  Password123!
-- =========================================================

-- 1) Replace NULL token/string columns with '' so GoTrue can
--    scan them. Only touches the seed test accounts.
update auth.users set
  confirmation_token       = coalesce(confirmation_token, ''),
  recovery_token           = coalesce(recovery_token, ''),
  email_change             = coalesce(email_change, ''),
  email_change_token_new   = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change             = coalesce(phone_change, ''),
  phone_change_token       = coalesce(phone_change_token, ''),
  reauthentication_token   = coalesce(reauthentication_token, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0),
  aud  = coalesce(aud, 'authenticated'),
  role = coalesce(role, 'authenticated')
where email like 'seed.%@zscope.test';

-- 2) Ensure each seed user has an email identity row.
--    GoTrue requires this for password sign-in.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email like 'seed.%@zscope.test'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- 3) (Optional) verify
-- select u.email, (i.id is not null) as has_identity
-- from auth.users u
-- left join auth.identities i on i.user_id = u.id and i.provider = 'email'
-- where u.email like 'seed.%@zscope.test';
