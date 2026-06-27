-- =========================================================
-- ZScope — enable Realtime for admin notification badges
-- Run in Supabase Dashboard -> SQL Editor.
-- Adds the request tables to the supabase_realtime publication
-- so the admin app receives instant change events. Realtime
-- respects RLS, so admins (who can SELECT these rows) get the
-- events while members do not see others' data.
-- =========================================================

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.payment_requests;
alter publication supabase_realtime add table public.withdrawal_requests;
alter publication supabase_realtime add table public.investment_join_requests;
alter publication supabase_realtime add table public.investment_withdrawal_requests;

-- If any table is already in the publication, the statement above errors.
-- In that case run them one at a time, or check current members with:
--   select schemaname, tablename from pg_publication_tables
--   where pubname = 'supabase_realtime';
