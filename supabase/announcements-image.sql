-- ============================================================
-- ZScope — ANNOUNCEMENTS image support
-- Run in Supabase Dashboard → SQL Editor.
-- Adds optional banner image to announcements + a public bucket.
-- ============================================================

-- 1. COLUMNS
alter table public.announcements
  add column if not exists image_url text,
  add column if not exists storage_path text;

-- 2. STORAGE BUCKET (public so members can load the images)
insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true)
on conflict (id) do update set public = true;

-- 3. STORAGE POLICIES
drop policy if exists "Public read announcement images" on storage.objects;
create policy "Public read announcement images" on storage.objects
  for select using (bucket_id = 'announcements');

drop policy if exists "Admins upload announcement images" on storage.objects;
create policy "Admins upload announcement images" on storage.objects
  for insert with check (bucket_id = 'announcements' and public.is_admin());

drop policy if exists "Admins update announcement images" on storage.objects;
create policy "Admins update announcement images" on storage.objects
  for update using (bucket_id = 'announcements' and public.is_admin());

drop policy if exists "Admins delete announcement images" on storage.objects;
create policy "Admins delete announcement images" on storage.objects
  for delete using (bucket_id = 'announcements' and public.is_admin());
