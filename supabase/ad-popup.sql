-- ============================================================
-- ZScope — ADVERTISEMENT LOGIN POP-UP
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
-- (Fresh projects already include this via setup.sql.)
--
-- Adds a per-ad toggle so an admin can flag specific banners to show
-- as a login pop-up. The latest active flagged ad pops up once per
-- login session (ad first, then the announcement pop-up if any).
-- ============================================================

alter table public.advertisements
  add column if not exists show_as_popup boolean not null default false;

comment on column public.advertisements.show_as_popup is
  'When true (and is_active), this banner shows as a login pop-up once per session.';
