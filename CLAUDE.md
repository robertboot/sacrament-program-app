# CLAUDE.md — Project memory & recovery guide

> This file is auto-loaded by every Claude Code session. It is also the
> **recovery document**: if a chat feed is lost or corrupted, a fresh
> session reads this and is immediately oriented. Keep it current.
>
> **No secrets in this file.** It records *where* credentials live and how
> to identify the right systems — never the actual keys/passwords.

---

## 1. What this app is

"Rota" (formerly "Rameumptom") — a sacrament-meeting planning web app for
LDS bishoprics. Plan programs one Sunday at a time, manage speakers/topics/
hymns with rotation suggestions, invite speakers, publish a public bulletin
and a conductor view.

**Stack:** Next.js (App Router, server components + server actions) ·
Supabase (Postgres + RLS + RPC) · Tailwind + Base UI (`@base-ui/react`) +
cmdk · deployed on Vercel.

---

## 2. Repo, branch, local path

- GitHub repo: **`robertboot/sacrament-program-app`**
- Local working dir: **`/home/user/sacrament-program-app`**
- Active development branch: **`claude/fix-bookmark-update-phone-I4E1D`**
- All work is developed on that branch and squash-merged to `main`.

---

## 3. The TWO Vercel apps (critical — source of much past confusion)

Both deploy from the **same repo**, branch **`main`**:

| Vercel project | Domain | Purpose |
|---|---|---|
| `sacrament-program-app` | `sacrament-program-app.vercel.app` | **The live app the owner uses ("Rota")** |
| `rameumptom-multi` | `rameumptom-multi.vercel.app` | Multi-tenant "v2" (in progress) |

Each Vercel project has its **own** `NEXT_PUBLIC_SUPABASE_URL`, so each
talks to a **different Supabase database**. Merging to `main` deploys
**both**.

---

## 4. Supabase — which database is correct (READ THIS BEFORE ANY SQL)

The single biggest recurring failure: running SQL/migrations against the
**wrong Supabase project**, so changes never appear in the app.

- The app the owner uses (`sacrament-program-app.vercel.app`) is backed by
  the Supabase project named **"robertboot's Project"**. All migrations and
  data fixes for the live app go **there**.
- The Supabase project ref **`ecgjbijrtkoscqkgahup`** is **NOT** the live
  app's database (it's a different/abandoned one). Don't run live fixes there.
- `NEXT_PUBLIC_SUPABASE_URL` in Vercel is marked **Sensitive** → it cannot
  be read back in the Vercel UI. Do **not** try to read or overwrite it.

**Foolproof way to confirm you're in the right database** — take any
program UUID from a URL the owner is using
(`…/programs/<UUID>`) and run this in a Supabase SQL editor:

```sql
select case when exists (select 1 from programs where id='<UUID>')
then 'THIS_IS_THE_APP_DATABASE' else 'WRONG_DATABASE' end as answer;
```

Only run migrations in the project that returns `THIS_IS_THE_APP_DATABASE`.

---

## 5. Secrets / credentials — where they live

- All secrets (Supabase URL + keys, Twilio, etc.) are **Vercel → project →
  Settings → Environment Variables**, per Vercel project.
- They are **not** in the repo and must never be committed.
- Supabase access: the owner logs into supabase.com; the correct project is
  **"robertboot's Project"** (see §4).

---

## 6. Deploy workflow

GitHub MCP has been unreliable in sessions. The reliable path used here:

1. Make changes on branch `claude/fix-bookmark-update-phone-I4E1D`.
2. `git stash && git fetch origin main && git reset --hard origin/main &&
   git stash pop` (sync onto fresh main).
3. Commit on the branch.
4. `git checkout -B main origin/main && git merge --squash <branch> &&
   git commit` (one squash commit on main).
5. `git push origin main` (with retry/backoff).
6. `git checkout <branch> && git reset --hard origin/main &&
   git push -u origin <branch> --force-with-lease`.

Vercel auto-deploys `main` for **both** apps. Verify the deployed version
string changed before retesting (past bug: owner retested a stale build).

When GitHub MCP **is** available, the equivalent is PR + squash-merge.

---

## 7. Database migrations (hand-applied)

Migrations live in `supabase/migrations/`. They are **not** auto-applied —
they must be pasted into the **Supabase SQL editor of "robertboot's
Project"** and run manually.

Key migrations and state (applied to "robertboot's Project"):

- `20260601000000_slot_confirmed.sql` — adds
  `speaking_assignments.slot_confirmed`.
- `20260602000000_hymn_alerts.sql` — adds `hymns.usage_tags`,
  `hymns.verse_note`; seeds usage tags by hymn number (sacrament 169–196,
  easter 197–200, christmas 201–214); adds four
  `programs.*_hymn_verse_note` booleans; recreates the
  `get_published_program` RPC (the RPC bakes the verse note into the public
  bulletin hymn title when that slot's toggle is on).
- `20260701000000_speaker_approval_setting.sql` — adds
  `app_settings.require_speaker_approval` (default `false`). Gates the
  "Bishop's / Branch President's approval" button in the planner: when
  on, each auto-generated pick is a draft until the leader clicks
  approve; when off, the invite workflow is available immediately.
  `updateSettings` has a defensive fallback so the rest of the page
  saves even if this migration hasn't been applied yet.

Gotcha: the SQL editor mangles pasted text if hand-selected — always use
the code block's copy control. Big RPC blocks have failed mid-script,
rolling back the whole transaction; split schema changes from the RPC if
needed.

App code uses defensive queries (`maybeSingle`, separate selects, `?? false`)
so it tolerates a not-yet-applied migration without 404ing.

---

## 8. Conventions & landmines

- **iOS Dialog protection (base primitive, don't re-solve per dialog):**
  `src/components/ui/dialog.tsx` carries the iOS-safe patterns for every
  `<Dialog>` in the app. Do not undo any of these without checking on
  iPhone first:
  - `DialogContent` caps at `max-h-[90svh]` and is itself the scroll
    container (`overflow-y-auto overscroll-none touch-pan-y`). Prevents
    top/bottom clipping on tall dialogs and blocks iOS from interpreting
    diagonal drags as horizontal side-swipes.
  - Close (X) is wrapped in a `sticky top-0 h-0 order-first` zero-height
    container so it stays pinned to the visible top-right when the popup
    scrolls internally.
  - `DialogOverlay` (backdrop) has `touch-action: none` so a touch on
    the darkened area can't trigger iOS edge-swipe navigation.
  - Body scroll-lock is DOM-driven, not React lifecycle-driven. A single
    `MutationObserver` watches for `[data-slot="dialog-content"][data-open]`
    and toggles body `{position:fixed; overflow:hidden; touch-action:none;
    user-select:none}` accordingly. Coalesced with `requestAnimationFrame`
    so mutation bursts (route changes, form re-renders) don't starve iOS
    touch scrolling. The React-lifecycle approach was tried and failed —
    Base UI Popup mounts eagerly from JSX and stays mounted through the
    close animation, so any lifecycle-tied hook leaks.
- **iOS picker scroll history (don't repeat the loop):** the
  Topic/Speaker/Hymn pickers use a Base UI `Dialog`. Base UI's *modal*
  scroll-lock blocks touch-scroll inside the dialog on iOS. The working
  solution: `modal={false}` on the picker `Dialog` **and** the
  `DialogContent` (popup) is itself the scroll container
  (`max-height:85svh; overflow-y-auto; overscroll-contain; touch-pan-y`),
  with the cmdk list flowing at natural height. Do not revert to nested
  flex-height scroll on the inner list. (The base `DialogContent` now
  applies its own `max-h-[90svh]` etc., but the picker's arbitrary-value
  `[max-height:85svh]` still wins via tailwind-merge dedupe.)
- **Chorister nav.** Planner is bishopric-only. Chorister's Home has
  two primary buttons: "This Sunday's public program" (→ /p/now) and
  "Edit this Sunday's music" (→ /programs/[nextId], the editor,
  which role-gates cards so the chorister sees only the Hymns card
  with the chorister + organist inputs it carries). No
  Conductor's-program button on chorister Home — that view is
  bishopric-only. The public bulletin's toolbar still shows a
  "Conductor view" link to signed-in visitors as a secondary path,
  and the Conductor view's Edit button says "Edit music" for
  choristers. `/` redirects choristers to `/home` for URL / bookmark
  safety. Nav gating lives in `src/components/app-nav.tsx`,
  `mobile-tab-bar.tsx`, and `src/app/(app)/home/page.tsx`.
- **Chorister role — Save must whitelist fields.** The DB has a
  `guard_chorister_program_update` trigger (see all-in-one.sql) that
  raises "Chorister may only edit hymn fields" if a chorister UPDATEs
  presiding / conducting_id / welcome_text / brief_reminders /
  invocation / benediction / releases / sustainings / stake_business /
  status / share_token. The editor's `saveAll()` sends the whole draft,
  so a chorister Save was failing on *every* field including the hymns
  they'd actually changed. Fix (already applied): `program-editor.tsx`
  whitelists `CHORISTER_SAVEABLE` fields when `role !== 'bishopric'`
  before sending. If you add new chorister-editable columns to the DB,
  add them to that whitelist too. The `chorister` and `organist` inputs
  intentionally live in the Hymns card so both roles can edit them.
- `src/app/(app)/settings/actions.ts` is intentionally modified (carries
  the production invite-link redirect using `NEXT_PUBLIC_SITE_URL`). Do
  **not** revert it.
- New-tab links: only the reschedule-conflict dialog's "Open →" should use
  `target="_blank"`. (Print/Assignments pages also intentionally open new
  tabs.)
- Hymn picker: tapping the field always opens the picker (never clears);
  clearing is an explicit "Clear — no hymn" row inside the dialog; the
  selected hymn opens highlighted and rotated to the top.
- Verse notes / usage tags are editable in-app: **Settings → "Hymn notes &
  tags"** (search hymn → edit). SQL is only a test shortcut.

---

## 9. Built so far (high level)

Rename to "Rota"; Public vs Conductor differentiation; Home always shows
upcoming Sunday with Public + Conductor buttons; install prompt only when
not installed; plan one Sunday at a time + "Plan the next program";
in-editor auto-generate with review→confirm-slot; hymn usage alerts +
verse notes + Settings editor; custom topic saved to library on confirm;
any speaker assignable + reset-to-rotation; scheduled-date swap conflict
dialog with last-spoke/upcoming dates; iOS picker scroll fixed; assorted
UX fixes (dialog title clipping, single trigger control, in-place View);
**notification bell + fanout system** (§18); **iOS dialog fix set**
(§8 — every dialog protected via base primitive); **perf pass** cutting
per-nav latency across middleware / dashboard / editor / home / view
/ notification bell (§19); chorister role can edit hymns / chorister /
organist via a Save-time field whitelist (§8).

---

## 10. Deferred — for the multi-tenant final build (PINNED)

When building the marketed **multi-tenant** version (likely the
`rameumptom-multi` line):

- **Tenant-scoped hymn customizations.** Keep the shared `hymns` catalog
  (number/title/hymnal) system-wide and read-only per tenant. Move
  per-tenant `verse_note` and any tenant-specific `usage_tags` into an
  overlay table, e.g. `hymn_overrides(tenant_id, hymn_id, usage_tags,
  verse_note)`, resolved at read time as **system default ⊕ tenant
  override**. Seeded sacrament/easter/christmas tags stay as shared
  defaults; verse notes are inherently ward-specific.
- **Developer self-service.** Provide a developer-only interface so the
  owner can make small content/config updates via their own login
  credentials (rather than SQL), scoped appropriately for multi-tenant.
- Confirm the tenant key (ward/unit id) used by the v2 model and make the
  overlay + any new tables tenant-scoped from the start.

Status: design agreed, **not yet implemented**. ~weeks out.

---

## 11. If you are a fresh session recovering context

1. Read this whole file.
2. Confirm the right Supabase DB with the §4 query before any SQL.
3. Use the §6 deploy workflow; verify the deployed version string changes.
4. Status of the test checklist:
   - **DONE & verified:** #7 hymn usage alerts + verse notes — picker
     badge, per-slot verse-note toggle saving, Conductor view, and public
     bulletin (`get_published_program` RPC) all confirmed on
     "robertboot's Project".
   - **DONE:** dashboard cards have explicit top-row buttons
     (Conductor's version / Public version / Edit) beside the
     Published/Draft badge; whole-card link removed (see §14).
   - **DONE:** editor footer has a "View published version" link next to
     Publish/Unpublish.
   - **DONE:** program-render redesigned (serif title, navy section
     headers, paired rows, fixed Intermediate Hymn slot, Add-to-calendar
     icon on Upcoming Events) — see §15.
   - **DONE:** auth/invite flow fixed end-to-end (token-hash email
     template, callback handles both flows, middleware allowlists
     `/auth/*`, cookies attached to redirect, login surfaces errors)
     — see §16. **The Magic Link email template in Supabase must use
     the token-hash pattern documented in §16.**
   - **DONE:** view toggle (Conductor ↔ Public buttons in toolbars,
     Published badge on Public) — see §17.
   - **DONE:** branding refresh — see §12.
   - **Still to verify:** Home shows the upcoming Sunday; install
     prompt only when not installed.
   - **In progress:** custom domain — see §13.
   - **PINNED, not started:** multi-tenant launch — see §10.

---

## 12. Branding assets (DONE)

New "Rota" branding shipped. Source/master files live in `public/`:
- `app-icon-master.png` (1024² master) → `icon-192/512.png`,
  `apple-touch-icon.png`, `src/app/favicon.ico` are regenerated from it
  with Pillow (`python3` + PIL is available in the env).
- `splash-page-logo.png` → rendered by `BrandStack` (Home + auth splash),
  tagline is baked into the image so no separate tagline text.
- `header-dark.png` (cream art for the dark navy header) → rendered by
  `BrandWordmark` (the app header). `header-light.png` is the navy-art
  variant for light backgrounds (kept for future use).
- Legacy `rameumptom-*` logos and old `icon.png` were removed.
To change a logo: replace the source PNG in `public/`, re-run the Pillow
resize for icons, redeploy. iOS caches the installed-PWA icon — must
delete & re-add the home-screen app to see a new icon.

---

## 13. Custom domain (in progress)

Still pending the owner's domain + registrar. The app references its
own URL three ways — all must be updated or invites/auth break:
1. **Share links** use `location.origin` — auto-adapt to whatever domain
   the user is on. No change needed.
2. **`NEXT_PUBLIC_SITE_URL`** (Vercel env, falls back to
   `https://sacrament-program-app.vercel.app`) is used for invite links
   (`programs/[id]/actions.ts`) and magic-link `redirectTo`
   (`settings/actions.ts`). Must be set to the custom domain in the
   **sacrament-program-app** Vercel project, then redeploy.
3. **Supabase Auth** ("robertboot's Project") → Authentication → URL
   Configuration: Site URL + Redirect URLs must include
   `https://<domain>/auth/callback` (and `https://<domain>/**`) or magic
   links fail. Keep the `.vercel.app` entry during transition.

Steps: add domain in Vercel project → set registrar DNS to Vercel's
values (apex A `76.76.21.21` or `www` CNAME `cname.vercel-dns.com`;
Vercel shows exact records) → Vercel auto-provisions SSL → set
`NEXT_PUBLIC_SITE_URL` → update Supabase redirect URLs.

---

## 14. Dashboard card layout (current)

Each upcoming-meeting card in `src/app/(app)/page.tsx`:
- Top row: **Published/Draft** badge on the left, action buttons on the
  right — **Conductor's version** (`/programs/<id>/view`), **Public
  version** (`/p/<share_token>`, published only), **Edit**
  (`/programs/<id>`, bishopric only). Same-tab navigation by rule (only
  the reschedule-conflict dialog's "Open →" uses `target="_blank"`).
- The whole-card link is intentionally removed; the buttons are the
  affordance. `share_token` is fetched in the dashboard query.

---

## 15. Program render conventions (Public + Conductor share `program-render.tsx`)

Design decisions made for readability + print (≤2 pages target for
Conductor); changing any of these casually will regress the look:
- **Title block:** serif (`font-serif`) branch name, gold uppercase
  "Sacrament Meeting", `Ornament` (◆ between hairlines).
- **Header row:** 3-column **Presiding / Conducting / Date** with small
  gold uppercase labels (not a 2-col table).
- **Section headings:** centered uppercase tracked text between thin
  hairlines via `SectionHeading`. **All section headings use the navy
  `tone="navy"` (default)** — including Blessing and Passing of the
  Sacrament. **font-bold** on the label text. `print:text-black` so it
  prints solid.
- **Sacrament Prayers link** sits **between the Blessing & Passing
  section and the Balance of Program heading** — centered,
  `no-print`. (Was under the Blessing heading; moved so the button
  reads as the transition from sacrament back into the meeting.)
- **Row component:** circular outline icon (gold) + small gold
  uppercase label + value. Icons: `Music2` for hymns, `HeartHandshake`
  for prayers, `User` for speakers, `BookOpen` for the sacrament hymn
  on public.
- **Paired rows** (`grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2`):
  Opening Hymn / Invocation; First Speaker / Second Speaker;
  Intermediate Hymn / Concluding Speaker; Closing Hymn / Benediction.
- **Intermediate Hymn is a fixed slot** (always rendered between 2nd
  and 3rd speaker on non-fast meetings; shows hymn / custom text / `—`).
- **Horizontal rules:** between the two speaker-pair rows (above
  Intermediate Hymn), and between the Balance section and Closing
  Hymn/Benediction.
- **Spacing:** condensed with print: variants that shrink further on
  paper. Extra `mt-6` above the Blessing section to separate it from
  Stake Business. Gold + borders fall back to black for print.
- **Upcoming Events:** each event with an `event_date` shows an
  "Add to calendar" button (gold circular `CalendarPlus`, `no-print`)
  linking to `/ics?title=…&date=…&description=…`. The route handler at
  `src/app/ics/route.ts` returns a `text/calendar` file with proper
  `Content-Disposition`, so iOS Safari's share sheet works correctly
  (do NOT revert to a `data:` URI — it broke iOS share).
- **Public bulletin needs `brief_reminder_events`** to populate
  Upcoming Events. The `get_published_program` RPC was updated to
  include it (events with `as_brief_reminder=true` within
  `meeting_date` … `meeting_date + 32 days`). If the public bulletin
  loses Upcoming Events again, the RPC was likely reverted — re-apply.

---

## 16. Auth & invite flow (these all interact — touch carefully)

There are four moving parts that must agree, or invited users get
forced back to `/login`:

1. **Magic-link email template** (Supabase → Authentication → Email
   Templates → "Magic Link") must use the **token-hash** pattern, not
   the default `{{ .ConfirmationURL }}`:
   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/home">Sign in to Rota</a>
   ```
   Why: PKCE flow requires a `code_verifier` cookie in the SAME browser
   that issued the request. The inviter's browser has it; the invitee's
   doesn't — so PKCE fails silently for emailed links. Token-hash
   doesn't need a verifier.
2. **`/auth/callback` route** (`src/app/auth/callback/route.ts`) handles
   both `?token_hash=&type=` (emailed links) and `?code=` (PKCE), and
   writes session cookies **directly onto the redirect response** (not
   via `cookies()` from next/headers, which drops cookies on redirects
   in route handlers). Errors are surfaced as `?error=…` on `/login`
   so failures are visible.
3. **Middleware** (`src/lib/supabase/proxy.ts`) — `/auth/*` and `/ics`
   are in the `isPublic` allowlist. Without that, an unauthenticated
   invitee is bounced to `/login` before the callback can run
   `verifyOtp`. This was the single biggest invite-flow bug.
4. **Supabase Auth → URL Configuration**:
   - **Site URL** = `https://sacrament-program-app.vercel.app` (the
     `{{ .SiteURL }}` template variable resolves to this).
   - **Redirect URLs** allowlist must include
     `https://sacrament-program-app.vercel.app/**` (and the custom
     domain when set).

**Settings → invite flow:** the mail icon next to each member opens
the `InviteLinkDialog`, which always shows three actions: **Send email**
(calls `sendInviteEmail` → `supabase.auth.signInWithOtp`), **Copy link**
(the magic link from `inviteMember` → `admin.auth.admin.generateLink`),
and **Copy message** (the link wrapped in friendly wording). The dialog
is `max-h-[90svh] overflow-y-auto` so buttons stay reachable on phones.

---

## 17. View toggle (Conductor ↔ Public)

Leaders can flip between the two views without going back to the
dashboard:
- **Conductor view** toolbar shows a **"Public view"** button when
  `program.status === "published"` (uses `program.share_token`).
- **Public view** toolbar shows a **"Conductor view"** button only when
  the visitor is authenticated. `render-published.tsx` runs
  `createClient().auth.getUser()` and passes a `conductorHref` to
  `PublicViewToolbar` only when a user exists — so anonymous bulletin
  visitors don't see the link.
- **Published** badge lives on the **Public** toolbar header (not the
  Conductor toolbar — moved there because the conductor view is
  always authenticated and didn't need the marker).
- Conductor toolbar's left-most button is **"Close"** (was "Done").

---

## 18. Notification system (in-app bell)

Migration `20260702000000_notifications.sql` — apply in "robertboot's
Project" per §7. Creates `notifications` (one row per recipient user,
per event), `profiles.sms_notifications_enabled`, and
`speaking_assignments.silence_flagged_at`.

Architecture:
- **Fanout** — `src/lib/notifications.ts` exports `notifyBishopric()`
  and `notifyUsers(ids)`. Both use the service client so webhook /
  cron writes succeed with no user session; both are best-effort
  (try/catch swallows so the underlying action never fails on a
  notification write).
- **Read path** — `src/lib/notifications-actions.ts`. Two shapes:
  `countUnreadNotifications()` for the cheap poll, `listNotifications()`
  for the dropdown open. All actions use `auth.getClaims()` (local
  JWT verify, no auth-server round-trip) and still filter by user_id
  because the notifications table has **no RLS enabled yet** — if
  RLS gets added later, the app-level filter becomes belt-and-braces.
- **UI** — `src/components/notification-bell.tsx` in the header.
  Polls unread count every 60s, pauses on `document.hidden`, lazy-
  loads the full 30-row list on dropdown open. Header suppresses
  the bell on `/programs/[id]/view` because the whole AppNav is
  suppressed there.

Wired triggers (all in-app; SMS to leaders is deferred — leaders
have no phone on file):
- Speaker Y/N via SMS → `speaker_confirmed` / `speaker_declined`
  fanned to whole bishopric (inbound Twilio webhook).
- `setProgramStatus("published")` → `program_published` to
  choristers + counselors (senior leader who published is skipped).
- `autoGenerateProgram` when approval-required → `slot_needs_approval`
  to bishopric.
- Silent 48h after invite → daily cron `/api/cron/silent-sweeper`
  at 15:00 UTC flags each stale awaiting_confirmation row once via
  `silence_flagged_at`.

To add a new event type: pick a new `type` string, call
`notifyBishopric` or `notifyUsers` from the server-side handler,
that's it. No enum migration needed (type is text).

**Speaker SMS is native, not Twilio.** `sendAssignmentInvite` and
`buildReminderInvite` both build the body + a `sms:` URL and return
`{ smsUrl }`; the client redirects to it to open the leader's own
Messages app pre-filled with recipient + body. The leader taps Send
from their own phone number, so the speaker sees a familiar sender
and any reply lands naturally in the leader's own message thread.
The daily send-reminders cron no longer sends Twilio — it now fires
a `speaker_reminder_due` notification per program with confirmed
speakers, deep-linking leaders to the editor where each confirmed
speaker has a "Send reminder" button. The Twilio outbound path
(`sendSms` in `src/lib/sms.ts`) and the inbound webhook
(`/api/sms/inbound`) still exist but are unreachable from any
current flow — kept in place in case we ever want the Twilio path
back. Speaker accept/decline/reason still works via the `/c/[token]`
web page the invite links to; that flow is independent of SMS
direction.

---

## 19. Perf toolkit (patterns that landed, keep applying them)

Baseline audit done 2026-08-06; these principles were rolled through
middleware, dashboard, editor, home, view, and the notification bell.
Apply the same pattern to any new server component or action.

- **`auth.getClaims()` over `auth.getUser()` for JWT-only checks.**
  `getUser()` round-trips to Supabase's auth server; `getClaims()`
  verifies the JWT locally. `getClaims().data.claims.sub` is the
  user id. Use `getUser()` only when you specifically need fresh
  user metadata beyond the id (rare).
- **Middleware short-circuits `isPublic` BEFORE any Supabase call.**
  Public routes (`/p/`, `/c/`, `/auth/`, `/ics`, `/api/sms/`,
  `/api/cron/`, `/privacy`, `/terms`, `/favicon.ico`) return
  immediately in `src/lib/supabase/proxy.ts` — no auth check, no
  Supabase client instantiation. Adding a new public prefix? Add it
  there.
- **Fold auth + profile + data into one `Promise.all`.** The pattern
  that repeatedly showed up: `getUser()` awaited, then profile
  lookup awaited on its id, THEN the big data Promise.all started.
  That's 2 serial round-trips before the real work begins. Instead:
  read `userId` from `getClaims()` (local), then put the profile
  query inside the same Promise.all as everything else.
- **Fold defensive follow-up queries into the main SELECT once the
  migration is applied.** The conductor view had three separate
  `.maybeSingle()` follow-ups (ward_business_footer, verse-note
  flags, hymn verse_note) written when those columns didn't exist
  yet. Once the migration lands, they become dead-weight serial
  round-trips. Merge the columns into the main SELECT and delete
  the fallback.
- **`next.config.ts` — `experimental.optimizePackageImports`** for
  `lucide-react` and `date-fns`. Tree-shakes barrel imports; keep
  the list updated if we add another big shared package (e.g. a
  charting lib).
- **Notification bell polling is HEAD count only.** Don't add
  polling for the full row list. Full list loads on dropdown open.
  Poll pauses on `document.hidden`. If another polling widget gets
  added, mirror this: unread count via `head:true` select, list
  lazy on interaction, pause when hidden.
- **Deferred (need input before shipping):**
  - **Public bulletin caching.** `/p/[token]` is `force-dynamic` +
    `Cache-Control: no-store` globally. Moving to ISR
    (`revalidate = 30` or tag-based `revalidateTag` invalidated on
    publish) is a big anonymous-visitor win but trades instant
    freshness for ~30s stale — needs owner sign-off.
  - **`pastForLastSpoke` query in the editor** pulls every
    historical assignment ever to compute each speaker's last-spoke
    date in JS. Fine now, grows unbounded over years. Fix is a
    small trigger that maintains `speakers.last_spoke_date` on
    assignment confirm.
