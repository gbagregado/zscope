# ZScope — Handover Guide

Cash-flow monitoring PWA. Stack: **Vite + React 19 + TypeScript**, **Supabase** (Postgres + Auth + Storage), deployed to **Cloudflare Pages**.

This guide moves the project to **new GitHub, Supabase, and Cloudflare accounts** cleanly.

---

## 0. What connects everything

The app only needs **two secrets** to talk to the backend (both are the Supabase project's public values):

| Variable | Where it's set |
|---|---|
| `VITE_SUPABASE_URL` | `.env` locally + Cloudflare Pages env vars |
| `VITE_SUPABASE_ANON_KEY` | `.env` locally + Cloudflare Pages env vars |

Read in [src/lib/supabase.ts](src/lib/supabase.ts). The anon key is safe to expose; security is enforced by **Row Level Security (RLS)** in the database.

---

## 1. GitHub (new account)

1. Create a new empty repo on the new account (e.g. `zscope`).
2. Point the local project at it and push:
   ```bash
   cd ~/Desktop/zscope
   git remote set-url origin https://github.com/NEW_USER/zscope.git
   git push -u origin main
   ```
3. **Generate a fresh Personal Access Token** on the new account (repo scope) for deploys/pushes.
4. **Do NOT reuse the old token.** The old one must be revoked (Settings → Developer settings → Tokens).
5. `.env` is gitignored, so no secrets are committed. Verify with `git status` before pushing.

---

## 2. Supabase (new account)

1. Create a new project. Note the **region** and **database password**.
2. Open **Dashboard → SQL Editor → New query**.
3. Paste the **entire** [supabase/setup.sql](supabase/setup.sql) and run it once.
   - This creates every table, view, RLS policy, storage bucket
     (`advertisements`, `announcements`, `investment-centers`,
     `payment-proofs`, `qr-codes`), and all RPC functions —
     including the latest features (manual balance adjustment,
     flexible lock-in, per-member caps, revoke, payout details).
   - It is idempotent and safe to re-run.
4. Create the **admin account**:
   - Register through the app (or Dashboard → Authentication → Add user, with Auto Confirm).
   - Then run, with the admin's email:
     ```sql
     update public.profiles set role='admin', status='active'
       where email = 'ADMIN_EMAIL_HERE';
     update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
       where email = 'ADMIN_EMAIL_HERE';
     ```
5. **Auth settings** (Dashboard → Authentication):
   - Set the **Site URL** to the new Cloudflare URL.
   - Add the Cloudflare URL to **Redirect URLs**.
   - Confirm email confirmations match how you want signups to behave.
6. Copy the project's **URL** and **anon key** (Settings → API) — needed for step 3 and `.env`.

> **Data migration (optional):** to carry over existing members/transactions,
> export the old project's tables (Dashboard → Database, or `pg_dump`) and import
> into the new one *after* `setup.sql`. Most handovers start fresh — confirm with the client.

---

## 3. Cloudflare Pages (new account)

1. Create a new Pages project named **`zscope`** (matches [wrangler.toml](wrangler.toml)).
2. Set **environment variables** (Settings → Environment variables, Production):
   - `VITE_SUPABASE_URL` = new Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = new Supabase anon key
3. Deploy. Either connect the new GitHub repo for auto-deploys, or deploy manually:
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name zscope --branch main
   ```
   (Run `npx wrangler login` first to authenticate the new Cloudflare account.)

---

## 4. Local setup (for whoever maintains it)

```bash
# Node 20+ recommended
npm install
cp .env.example .env      # then fill in the new Supabase URL + anon key
npm run dev               # local dev at http://localhost:5173
npm run build             # production build into dist/
```

---

## 5. Post-migration smoke test

Test in an **incognito window** (the app is a PWA and caches aggressively):

- [ ] Register a new member → appears as **pending** in Admin → Members.
- [ ] Approve the member → can log in.
- [ ] Admin → Investment Centers: create a center (try each lock-in mode).
- [ ] Member: join a center; confirm wallet debits after admin approval.
- [ ] Admin → Members → **Adjust**: credit and debit a balance (debit over-balance should be blocked).
- [ ] Admin → Advertisements / Announcements: upload, edit, toggle login pop-up.
- [ ] Log out / back in → pop-up ad carousel shows.
- [ ] Payment request + withdrawal request flows credit/debit correctly.

---

## 6. Security checklist before handover

- [ ] Old GitHub token **revoked**; new token issued on the new account.
- [ ] Deploy command updated to use the new repo + token (no old secrets left in scripts/history).
- [ ] New Supabase **service_role key** kept private (never in the frontend or repo).
- [ ] Supabase **Site URL / Redirect URLs** point only to the new domain.
- [ ] `.env` is not committed (`git status` clean).
- [ ] Admin account password handed over securely (not in chat/email plaintext).

---

## Reference: project layout

- `src/pages/admin/*` — admin console (members, centers, investments, ads, announcements, payments, withdrawals, profits, reports).
- `src/pages/member/*` — member app (dashboard, investments, add funds, withdraw, profile, announcements).
- `src/lib/supabase.ts` — Supabase client + env wiring.
- `src/lib/database.types.ts` — generated DB types (keep in sync with `setup.sql`).
- `supabase/setup.sql` — **single source of truth** for the database. Individual
  `supabase/*.sql` files are the historical per-feature migrations (already folded into `setup.sql`).
