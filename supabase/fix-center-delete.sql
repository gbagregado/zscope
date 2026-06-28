-- ============================================================
-- ZScope — FIX: allow deleting an investment center that has
-- removal/kick-out audit rows.
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
--
-- investment_removals.center_id and .member_id were created WITHOUT
-- ON DELETE CASCADE, so once a member had been removed/kicked-out of a
-- center, the leftover audit row blocked deleting that center (and
-- blocked deleting the member's profile). This re-points those foreign
-- keys to cascade, so deleting a center cleans up its audit rows too.
-- ============================================================

alter table public.investment_removals
  drop constraint if exists investment_removals_center_id_fkey,
  drop constraint if exists investment_removals_member_id_fkey,
  drop constraint if exists investment_removals_removed_by_fkey,
  drop constraint if exists investment_removals_reverted_by_fkey;

alter table public.investment_removals
  add constraint investment_removals_center_id_fkey
    foreign key (center_id) references public.investment_centers(id) on delete cascade,
  add constraint investment_removals_member_id_fkey
    foreign key (member_id) references public.profiles(id) on delete cascade,
  add constraint investment_removals_removed_by_fkey
    foreign key (removed_by) references public.profiles(id) on delete set null,
  add constraint investment_removals_reverted_by_fkey
    foreign key (reverted_by) references public.profiles(id) on delete set null;
