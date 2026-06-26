-- ============================================================
-- ZScope — Promote an account to ADMIN (for testing)
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================
--
-- STEP 1 — Create the login (pick ONE):
--   (a) Have the person register normally in the app, OR
--   (b) Dashboard → Authentication → Users → "Add user"
--       and TICK "Auto Confirm User" (skips the email link).
--
-- STEP 2 — Run the statement below with their email to make
-- them an active admin. The handle_new_user trigger already
-- created their profile as a pending member; this flips it.
-- ============================================================

update public.profiles
set role = 'admin',
    status = 'active'
where email = 'CHANGE_ME@example.com';   -- 👈 put the account email here

-- Optional: confirm the email directly in the auth table so
-- they can sign in even if email confirmation is still on.
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'CHANGE_ME@example.com';   -- 👈 same email

-- Verify it worked:
-- select email, role, status from public.profiles where email = 'CHANGE_ME@example.com';
