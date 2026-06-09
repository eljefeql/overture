# Overture — Where We Stand (recovered 2026-06-08)

> Reconstructed from disk after the original chat history was lost. Strategic context comes from your memory files (`project_overture.md`, `project_overture_discover.md`). Code state comes from inspecting `~/overture2.0/`. Last commit + most recent file edits were **Apr 26, 2026** — work has been paused for ~6 weeks.

---

## What Overture is (one paragraph)

A casting + talent-pipeline + per-show communication app for community theatres. Actors free, theatres pay $29/mo (or $200/yr) for the full flow plus per-show message feed. Boosted audition listings ($25–50) are the second revenue stream. Stack is Next.js App Router + Tailwind v4 + TanStack Query + Phosphor duotone icons, Supabase planned but not yet wired. Codebase: `~/overture2.0/` on port 3001.

---

## Phase status (from your build plan)

| Phase | Status | Notes |
|---|---|---|
| **1. Fix critical bugs in existing pages** | **In progress** — last touched 4/26 | Dead buttons, ProfileEditModal data loss, signup modal validation, dead links, withdraw confirmation, mark-as-read, route cleanup. Unknown exactly what's done vs left — see "What I can verify" below. |
| 2. Complete UI in mock mode | Not started | Onboarding flow, show creation/editing polish, communication-layer design |
| 3. Supabase migration | Not started | `supabase/migrations/` dir exists but empty |
| 4. Org layer + onboarding | Not started | `(org)/dashboard` and `(org)/settings` route folders exist but empty |
| 5. Production polish | Not started | Cast-list publication, billing, season planning |

---

## Routes that exist as `page.tsx` today

**Actor flows** (mobile-first):
- `/` — root (`src/app/page.tsx`)
- `/discover` — audition browse (radius, sort, filter, promoted feed) ✅
- `/auditions/[id]` — phase-aware audition page (browsing → signed-up → callback → cast) ✅
- `/my-shows` — per-show timelines + past credits ✅
- `/notifications` ✅
- `/offers/[id]` — accept/decline offer ✅
- `/profile` ✅
- `/login`, `/signup`

**Production flows** (desktop-first), nested under `/shows/[showId]/`:
- `/shows` — show index ✅
- `/shows/new` — create show ✅
- `/shows/[showId]/setup` — show setup ✅
- `/shows/[showId]/auditions` ✅
- `/shows/[showId]/callbacks` ✅
- `/shows/[showId]/casting` ✅
- `/shows/[showId]/cast-list` ✅

**Empty route folders that should probably go away or get built:**
- `src/app/(actor)/dashboard/` — flagged as dead route in memory
- `src/app/(actor)/callbacks/` — flagged as dead route (callbacks live on the audition page now)
- `src/app/(org)/dashboard/` — for Phase 4, empty
- `src/app/(org)/settings/` — for Phase 4, empty

---

## What I can verify from the code

- **Known TODOs left in source** (grep): only 3, all about deriving org from auth:
  - `src/app/(production)/shows/new/page.tsx:114` — hardcoded `orgId: "org-1"` and orgName "North County Theatre"
  - `src/components/ui/Nav.tsx:78` — `hasNotifications = true` is hardcoded
- **Mock data layer:** all data flows through `src/lib/api/client.ts` (25KB) backed by `src/data/shows.ts` (72KB) and `src/data/actors.ts` (93KB). Supabase swap-in is Phase 3.
- **No Supabase code yet** — just an empty `supabase/migrations/` folder.
- **One git commit:** "Initial commit from Create Next App" — you have NOT been committing. **Strongly recommend a git commit before the next session so we never lose another iteration.**

## What I cannot verify without running the app

Whether the specific Phase 1 bugs are actually fixed:
- ProfileEditModal data loss when switching sections
- Signup modal first-render validation + dropped fields
- Dead buttons (Save, Share, Calendar, Upload Photos, Set Up Profile)
- Dead links (`/theatres/[orgId]`, `tel:`/`mailto:`)
- Withdraw confirmation dialog
- Mark-as-read on notifications

A new session should re-run the dev server, click through each, and tick them off.

---

## Design system — already locked in `CLAUDE.md`

Single source of truth for visuals. Tokens: **curtain** (plum), **stage** (gold), **cream**, **forest**, **ruby**, **clay**. Fonts: DM Serif Display for names/titles, Inter for body. Hard rules: no `border-l-*`/`border-t-*`, no raw Tailwind colors, no raw divs styled like cards (use `<Card>`), no `space-y-*` on card lists (use `flex flex-col gap-*`). Phosphor duotone icons.

Strategic Discover-page decisions (from memory): radius controls separate from profile (15/25/50/100/Anywhere), Suggested default sort blends relevance + paid boosts, three feed sections (Promoted / For You / Nearby), filters intentionally minimal to avoid "dead app" perception.

---

## Standalone prototype HTML in `~/` (older work)

Six loose HTML files in your home directory (`casting-prototype.html`, `casting-profile.html`, `casting-workspace.html`, `casting-call.html`, `casting-actor-view.html`, `casting-offer.html`) and a full `~/overture-prototype/` directory (23 HTML pages, last touched 4/7). These were the **clickable prototype phase** that came BEFORE `overture2.0/`. They're reference material — don't ship from them, but they're useful to mine for any visual idea that didn't make it into the Next.js build.

---

## Suggested first move in the new session

1. `cd ~/overture2.0 && npm run dev` (port 3001)
2. `git add -A && git commit -m "checkpoint: Apr 26 state, pre-resume"` — so we have a baseline if anything goes sideways
3. Click through the Phase 1 bug list, confirm what's fixed, write down what isn't
4. Knock out remaining Phase 1 bugs, then move into Phase 2 onboarding flow (the actor activation gate)

---

## Backup is now running

Session JSONLs are snapshotted every 10 min to `~/.claude-backups/snapshots/`. If a chat ever vanishes again, the file is recoverable from there.
