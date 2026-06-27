-- =========================================================
-- ZScope — SEED sample members + investments (TEST DATA)
-- Run in Supabase Dashboard -> SQL Editor.
-- Prereqs: schema.sql + investment-center.sql already run,
--          and at least ONE active investment center exists.
--
-- Creates 4 fake members and joins them to the NEWEST active
-- center with different invested amounts, so you can test
-- proportional profit distribution in Admin -> Investments.
--
-- All seeded accounts use emails ending in @zscope.test
-- Password for every seeded login: Password123!
-- =========================================================
do $$
declare
  v_center uuid;
  v_admin  uuid;
  v_uid    uuid;
  v_inv    uuid;
  m record;
begin
  -- newest active center
  select id into v_center
  from public.investment_centers
  where is_active
  order by created_at desc
  limit 1;
  if v_center is null then
    raise exception 'No active investment center found — create one first.';
  end if;

  -- an admin to attribute ledger entries to (falls back to the member)
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;

  for m in
    select * from (values
      ('seed.maria@zscope.test', 'Maria Santos',    50000::numeric),
      ('seed.juan@zscope.test',  'Juan Dela Cruz',  30000::numeric),
      ('seed.ana@zscope.test',   'Ana Reyes',       20000::numeric),
      ('seed.pedro@zscope.test', 'Pedro Bautista', 100000::numeric)
    ) as t(email, full_name, amount)
  loop
    -- 1) ensure an auth user (the on_auth_user_created trigger makes the profile)
    select id into v_uid from auth.users where email = m.email;
    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        v_uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        m.email,
        extensions.crypt('Password123!', extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', m.full_name),
        now(), now()
      );
    end if;

    -- make the profile active and named
    update public.profiles set status = 'active', full_name = m.full_name where id = v_uid;

    if v_admin is null then v_admin := v_uid; end if;

    -- 2) ensure the investment (idempotent on member+center)
    select id into v_inv from public.investments where member_id = v_uid and center_id = v_center;
    if v_inv is null then
      insert into public.investments (member_id, center_id) values (v_uid, v_center)
      returning id into v_inv;

      -- wallet: credit then debit so the main wallet nets to 0 (realistic)
      insert into public.transactions (member_id, type, amount, description, created_by, source, reference_id)
      values
        (v_uid, 'credit', m.amount, 'Seed funds',          v_admin, 'manual',     null),
        (v_uid, 'debit',  m.amount, 'Investment deposit',   v_admin, 'investment', v_center);

      -- investment ledger: the deposit
      insert into public.investment_transactions (investment_id, type, amount, description, created_by)
      values (v_inv, 'deposit', m.amount, 'Seed deposit', v_admin);
    end if;
  end loop;

  raise notice 'Seed complete: 4 members joined center %', v_center;
end $$;

-- =========================================================
-- CLEANUP (optional) — removes ALL seeded test data.
-- Deleting the auth user cascades to profile, investments,
-- transactions and investment ledger rows.
-- Uncomment and run when you're done testing.
-- =========================================================
-- delete from auth.users where email like 'seed.%@zscope.test';
