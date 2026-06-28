-- ============================================================
-- ZScope — LOGIN POP-UP ANNOUNCEMENT
-- Run in Supabase Dashboard → SQL Editor on the EXISTING project.
-- (Fresh projects already include this via setup.sql.)
--
-- Adds a flag so an announcement can be shown as a pop-up to
-- members right after they log in. The most recent announcement
-- with show_as_popup = true is shown once per login session.
-- ============================================================

alter table public.announcements
  add column if not exists show_as_popup boolean not null default false;

comment on column public.announcements.show_as_popup is
  'When true, this announcement is shown as a pop-up to members after login (latest one wins).';
