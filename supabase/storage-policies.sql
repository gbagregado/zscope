-- ============================================================
-- ZScope Storage RLS Policies
-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: "Unable to save" / 400 Bad Request when uploading QR codes & proofs
-- ============================================================

-- Make sure buckets exist (id must match what the app uses)
insert into storage.buckets (id, name, public)
values ('qr-codes', 'qr-codes', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update set public = false;

-- ------------------------------------------------------------
-- QR CODES bucket (public read; admin write)
-- ------------------------------------------------------------

drop policy if exists "qr_codes_public_read" on storage.objects;
create policy "qr_codes_public_read"
  on storage.objects for select
  using (bucket_id = 'qr-codes');

drop policy if exists "qr_codes_admin_insert" on storage.objects;
create policy "qr_codes_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'qr-codes' and public.is_admin());

drop policy if exists "qr_codes_admin_update" on storage.objects;
create policy "qr_codes_admin_update"
  on storage.objects for update
  using (bucket_id = 'qr-codes' and public.is_admin());

drop policy if exists "qr_codes_admin_delete" on storage.objects;
create policy "qr_codes_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'qr-codes' and public.is_admin());

-- ------------------------------------------------------------
-- PAYMENT PROOFS bucket (private)
-- Members upload to their own folder: <member_id>/<file>
-- Admins can read everything; members read their own
-- ------------------------------------------------------------

drop policy if exists "proofs_member_insert" on storage.objects;
create policy "proofs_member_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "proofs_member_read_own" on storage.objects;
create policy "proofs_member_read_own"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "proofs_admin_read_all" on storage.objects;
create policy "proofs_admin_read_all"
  on storage.objects for select
  using (bucket_id = 'payment-proofs' and public.is_admin());

drop policy if exists "proofs_admin_insert" on storage.objects;
create policy "proofs_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and public.is_admin());
