# Sacrament Program Planner

Mobile-first web app for branch leadership to plan sacrament meetings up to 3 months ahead, manage a speaker rotation, and generate printable/shareable programs.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + RLS + Auth) · Vercel.

---

## Phase 1 features (built)

- **Auth** — Supabase email/password, profile auto-creation on signup, role-based UI (bishopric vs chorister).
- **Speaker database** — CRUD + many-to-many category tags (5/10/15 min), bulk paste import, sortable by rotation freshness.
- **Topic database** — CRUD + bulk paste import.
- **Program editor** — full sacrament-meeting form with hymn pickers, speaker pickers (sorted by longest gap), topic pickers, conducting picker, branch business, and day-of fields.
- **Traffic-light speaking assignments** — ⚫ not asked → 🟡 awaiting confirmation → 🟢 confirmed / 🔴 declined; topic auto-locks at yellow, swapped topics return to the pool, declined assignments can be reset.
- **Audit log** — every status change recorded with user + timestamp (`speaking_assignment_history`).
- **Assignment papers** — printable papers per slot, or batch-print all pending papers for the next 6 weeks.
- **Rotation logic** — Postgres functions pick the next conductor / speaker / topic by longest gap, factoring in already-scheduled future programs.
- **Auto-creation** — `ensure_next_3_months_programs()` scaffolds drafts for every upcoming Sunday. Triggered monthly via Vercel Cron or manually from the dashboard.
- **Dashboard alerts** — flags slots needing a speaker, papers to print, undelivered papers, follow-ups, and declines.
- **Lifecycle** — drafts editable for 3 months, "Publish" activates the public share link, programs remain editable after publishing for Sunday-morning swaps.
- **Public share view** — `/p/<token>`, no login required, renders the same printable layout.
- **Print views** — `/programs/<id>/view` and the public share both print cleanly via browser print stylesheet.
- **Events** — date-windowed announcements that auto-attach to any program inside the window.
- **Settings** — branch name, default welcome text, assignment paper template, and user role/position management.

## Deferred to Phase 2/3

PWA install, "Suggest" button to refill blanks beyond auto-create, email/SMS the share link, history view, stats, multi-branch.

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project.
2. From the project settings → API, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configure local env

```bash
cp .env.local.example .env.local
# Fill in the three keys from step 1.
```

### 3. Apply the database schema

The SQL is in `supabase/migrations/`. The easiest path is to paste each file into the **SQL Editor** in the Supabase dashboard in order:

1. `20260510000001_initial_schema.sql` — tables, enums, indexes.
2. `20260510000002_functions_rls.sql` — functions, triggers, RLS policies.
3. `20260510000003_seed_hymns.sql` — 1985 hymnbook + new hymns.

Or with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

> **Hymn titles:** the seed uses the canonical 1985 titles where confidence is high; a handful come from the first line of the hymn rather than its title. Open `supabase/migrations/20260510000003_seed_hymns.sql` and adjust if needed. The new 2024+ hymn numbers (1001+) are placeholders for sorting — replace with real numbers when the Church publishes them in a final hymnbook.

### 4. Promote the first bishopric user

By default every signup is a chorister. To bootstrap the first bishop:

```sql
update profiles set role = 'bishopric', bishopric_position = 'bishop'
where id = '<your-auth-user-id>';
```

(Find your user id in the Supabase dashboard → Authentication → Users.) After that, the Settings page lets bishopric members promote other users.

### 5. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up. After step 4 above, sign in again — you'll have full bishopric access.

### 6. Seed speakers, topics, and conducting

1. Visit **Speakers** → bulk import a list like:

   ```
   John Smith, first|second
   Mary Jones, second|concluding
   Bro. Davis, concluding
   ```

2. Visit **Topics** → bulk import:

   ```
   Faith in Jesus Christ — Alma 32; Helaman 5:12
   Service: D&C 81:5
   The Atonement
   ```

3. Visit **Settings** → promote your bishop, 1st counselor, 2nd counselor.

4. Back on the **Dashboard**, click **Generate next 3 months**. The app auto-creates drafts for every Sunday in the next 3 months, picking conductors / speakers / topics by rotation.

---

## Deploy to Vercel

```bash
npx vercel link        # or set up via the Vercel dashboard
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add CRON_SECRET   # any random string; the cron endpoints require it
npx vercel --prod
```

`vercel.json` already declares two cron jobs:

- `/api/cron/recompute` — daily at 09:00 UTC; advances rotation dates as meetings pass.
- `/api/cron/ensure-programs` — first of every month at 08:00 UTC; scaffolds drafts for the next 3 months.

Both endpoints check `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this automatically when the env var is set.

---

## Architecture

```
src/
  app/
    (auth)/login,signup        — public auth pages
    (app)/                     — authenticated app, shared nav
      page.tsx                 — Dashboard
      speakers/                — Speakers CRUD
      topics/                  — Topics CRUD
      events/                  — Events CRUD
      settings/                — Branch info + user roles
      programs/[id]/           — Program editor
      programs/[id]/view/      — Print view (auth)
      programs/[id]/papers/    — Per-program assignment papers
      papers/                  — Batch pending papers (next 6 weeks)
    p/[token]/                 — Public share view (anon-readable)
    api/cron/*                 — Cron endpoints
    auth/callback/             — Supabase auth redirect handler
  components/
    ui/                        — shadcn primitives
    hymn-picker.tsx
    speaker-picker.tsx
    topic-picker.tsx
    conducting-picker.tsx
    program-render.tsx         — Shared print layout
    assignment-paper.tsx       — Single paper render
    status-pill.tsx
    app-nav.tsx
  lib/
    supabase/{client,server,proxy,types}.ts
    rotation.ts                — Client-side rotation sort
    dates.ts                   — Weeks-since helpers
    assignments.ts             — Slot/status constants
  proxy.ts                     — Next 16 proxy (auth gate)

supabase/
  migrations/                  — Schema + functions + RLS + hymn seed
```

### Rotation logic

All rotation lives in Postgres functions and is callable from both the UI (Suggest button) and the auto-create job. Source: `supabase/migrations/20260510000002_functions_rls.sql`.

- `next_conductor(meeting_date date)` — bishopric member with the oldest effective last-conducted date, factoring future commitments before this date.
- `next_speaker(meeting_date date, category, exclude_ids[])` — same for speakers.
- `next_topic(meeting_date date, exclude_ids[])` — same for topics.
- `ensure_next_3_months_programs()` — walks every Sunday in the next 3 months, inserts a draft for any that are missing, and creates the three speaking assignments with auto-picked speakers + topics.
- `recompute_all_rotation_dates()` — refreshes `last_spoke_date` / `last_used_date` / `last_conducted_date` from confirmed past assignments. Triggers also keep these in sync on individual status changes.

### Status state machine

The `guard_locked_assignment()` trigger enforces:

- Speaker + topic are editable only while status = `not_yet_asked`.
- Moving back to `not_yet_asked` clears `asked_at` / `asked_by` / `confirmed_at` / `declined_at`.
- Transitions auto-stamp `asked_at` / `confirmed_at` / `declined_at`.
- `speaking_assignment_history` logs every status change (FROM, TO, who, when).

### RLS summary

- `bishopric` can do everything.
- `chorister` can read everything and can only update hymn fields on programs (enforced by `guard_chorister_program_update()`).
- `anon` has no direct table access — public share goes through `get_published_program(token)`, a SECURITY DEFINER function that returns the program JSON only if `status = 'published'` and the share token matches.

---

## Day-to-day workflow

**Sunday afternoon, planning ahead:**

1. Dashboard → see the next 13 weeks of drafts.
2. Tap a week → editor → tweak speakers / topics if the auto-picks aren't right.
3. For each speaker you've decided on, click **Print paper** (or use the batch route at `/papers` for all pending). Hand the paper to the speaker → click **Mark as asked** (🟡).
4. As speakers respond, click **Confirmed** (🟢) or **Declined** (🔴).

**Sunday morning:**

1. Open the week's editor.
2. Fill in **Invocation** and **Benediction** (assigned at the pulpit).
3. Confirm **Presiding**, **Chorister**, **Organist**.
4. Click **Save**, then **Publish**.
5. Share link is now live at `/p/<token>` — copy it from the dialog.

**After meeting:**

The daily cron advances `last_spoke_date` / `last_used_date` / `last_conducted_date` as meetings pass, so next week's auto-picks reflect what actually happened.

---

## Scripts

```bash
npm run dev     # Next.js dev server
npm run build   # production build
npm run lint    # eslint
npm start       # serve the production build locally
```

## License

Internal use within your branch / ward. No license granted for redistribution.
