-- ============================================================
-- ZScope — ADVERTISEMENTS (admin-managed image carousel)
-- Run in Supabase Dashboard → SQL Editor.
-- Members see active ads on their dashboard; admins manage them.
-- ============================================================

-- 1. TABLE
create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,                       -- so we can delete the file too
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.advertisements enable row level security;

-- 2. RLS POLICIES
-- Everyone authenticated can read ACTIVE ads
drop policy if exists "Authenticated see active ads" on public.advertisements;
create policy "Authenticated see active ads" on public.advertisements
  for select using (auth.role() = 'authenticated' and is_active = true);

-- Admins can read ALL ads (active + inactive)
drop policy if exists "Admins see all ads" on public.advertisements;
create policy "Admins see all ads" on public.advertisements
  for select using (public.is_admin());

-- Admins manage (insert/update/delete)
drop policy if exists "Admins insert ads" on public.advertisements;
create policy "Admins insert ads" on public.advertisements
  for insert with check (public.is_admin());

drop policy if exists "Admins update ads" on public.advertisements;
create policy "Admins update ads" on public.advertisements
  for update using (public.is_admin());

drop policy if exists "Admins delete ads" on public.advertisements;
create policy "Admins delete ads" on public.advertisements
  for delete using (public.is_admin());

-- 3. STORAGE BUCKET (public so members can load the images)
insert into storage.buckets (id, name, public)
values ('advertisements', 'advertisements', true)
on conflict (id) do update set public = true;

-- 4. STORAGE POLICIES
drop policy if exists "Public read ads" on storage.objects;
create policy "Public read ads" on storage.objects
  for select using (bucket_id = 'advertisements');

drop policy if exists "Admins upload ads" on storage.objects;
create policy "Admins upload ads" on storage.objects
  for insert with check (bucket_id = 'advertisements' and public.is_admin());

drop policy if exists "Admins update ads storage" on storage.objects;
create policy "Admins update ads storage" on storage.objects
  for update using (bucket_id = 'advertisements' and public.is_admin());

drop policy if exists "Admins delete ads storage" on storage.objects;
create policy "Admins delete ads storage" on storage.objects
  for delete using (bucket_id = 'advertisements' and public.is_admin());
