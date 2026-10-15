# Barn Book

A mobile-first PWA for tracking vaccinations and preventive treatments for
horses, dogs, and cats on a small farm. One household's records: sign in
with a magic link, log doses, and the board tells you what's overdue, what's
coming up, and what's never been logged.

**Stack:** Vite + React 18 + TypeScript · Tailwind CSS · Supabase
(Postgres + Auth + RLS, magic-link email only) · `vite-plugin-pwa` ·
deployed on Vercel.

---

## 1. Supabase setup (one time)

1. Create a project at [supabase.com](https://supabase.com) (the free tier
   is plenty). Use a **dedicated project** for Barn Book — don't point it at
   a database another app already uses.
2. Open **SQL Editor** and run the whole of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   It creates `animals`, `schedules`, and `records` with row-level security:
   every row is visible and writable only by the signed-in user who owns the
   animal.
3. **Auth:** magic links work out of the box. Under
   **Authentication → URL Configuration**, set the Site URL to wherever the
   app is served (e.g. `https://your-app.vercel.app`) and add it to the
   Redirect URLs. For local dev, also add `http://localhost:5173`.
4. Grab the keys from **Project Settings → API**:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` public key → `VITE_SUPABASE_ANON_KEY`

### Optional: seed data

[`supabase/seed.sql`](supabase/seed.sql) creates one horse and one dog with
their default schedules and a few records. Sign in to the app once first
(so a user exists), find your user id under **Authentication → Users**,
replace `<USER_ID>` in the file, and run it in the SQL editor.

## 2. Running locally

```bash
cd barn-book
npm install
cp .env.example .env       # then fill in the two values
npm run dev                # http://localhost:5173
```

- `npm run test` — Vitest suite (due-date math, board assembly, CSV).
- `npm run build` — type-check + production build into `dist/`.

## 3. Deploying to Vercel

1. Vercel → **Add New Project** → import this repository.
2. Set **Root Directory** to `barn-book`. Framework preset auto-detects as
   Vite; the defaults (build `npm run build`, output `dist`) are correct.
3. Add the two environment variables:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy, then put the deployed URL into Supabase's Auth URL
   Configuration (step 1.3) or magic links will bounce.

## 4. Installing on an iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**. The app
runs standalone with its own icon. Previously-loaded data is readable
offline (the service worker caches the app shell and recent Supabase
reads); logging a dose needs a connection.

## 5. How the pieces fit

- `src/lib/due.ts` — all due-date logic. Dates are `YYYY-MM-DD` strings end
  to end; arithmetic happens in UTC milliseconds so DST can never shift a
  day. `next_due = given_on + interval_days` is computed **at write time**
  (see `logDose` in `src/lib/db.ts`), so backdating a dose recalculates it.
- Status ladder: **Never logged** → **Overdue** (day count) → **Due soon**
  (within 30 days) → **Current**; a null interval means history-only, no
  reminder. Status is always a text label plus a 4px colored left border —
  never color alone.
- `src/lib/catalog.ts` — default treatments and intervals per species.
  They're starting points; every interval is editable per animal, and free-
  text treatments can be added anywhere.
- Screens: **Board** (needs attention / coming up / the herd), **Animal**
  (schedule + one-tap log + history + edit/archive), **Log a dose** (bottom
  sheet with live next-due preview), **Add animal** (chip picker), **Export**
  (all-records CSV + per-animal printable record for the vet or a Coggins
  check).

## 6. Conventions

- No state library — React state over a thin `src/lib/db.ts` wrapper.
- Georgia for names, treatments, and headings; system sans elsewhere.
- Inputs stay at 16px so iOS doesn't zoom on focus; tap targets ≥44px.
- Store and compare `date`, never `timestamptz`, for anything calendar-day.
