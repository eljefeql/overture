# Overture — 30-Day Plan to Free Public Beta

*Set 2026-06-12. Goal: a real, deployed product community theatres can use **free**, instrumented and trustworthy, with the features that make it the best of its kind. Stripe/paid is a fast-follow, NOT in these 30 days.*

Decisions locked: **Free public beta** finish line · **Full** rehearsal Show Home in scope · **PostHog + Sentry** for analytics/monitoring.

---

## What "beta-ready" means (definition of done)
A theatre we've never met can: find Overture → sign up → set up their theatre → post a show → real actors discover & sign up → director runs auditions/callbacks/casting with the **conflict calendar** → publishes a cast → runs the show through the **Show Home** — with **emails actually arriving**, on a **real deployed URL**, with **analytics + error tracking** running and **Terms/Privacy** in place. No dead ends, no "available with cloud" stubs in the core loop.

---

## Prototype audit — what we're folding in (from overturecasting.netlify.app)
1. **Conflict Calendar** *(highest value; data already collected at signup, currently discarded)* — director view of cast/auditionee unavailability across the rehearsal period.
2. **Rehearsal-phase Show Home** *(full)* — the post-casting command center: SM update feed, comm-norms/contact routing, rehearsal schedule + per-rehearsal conflict reporting, cast/creative directory, volunteer & promotion hub (social templates, QR tickets), membership CTA.
3. **Landing page** — prototype-caliber: hero, 4-step "how it works," social-proof stats, testimonials, pricing (free-during-beta), dual CTA.
4. **Production dashboard → command center** — "Needs your attention" panel, activity feed, offer-tracker table, upcoming-dates timeline.
5. **Casting board upgrades** — Compare Actors side-by-side, conflict-aware pool tabs (No Conflicts / Team Players), soft warnings (vocal-range heads-up).

---

## The 30 days

### Week 1 — Launch foundation (a beta isn't possible without these)
- **Environments & safe deploy** *(do this FIRST — protects customers from bad updates):*
  - **Two Supabase projects**: current `haptjelzekjdjerrditm` (test/seed data) → **staging**; spin up a fresh **production** project, apply migrations 001–007 clean.
  - **Vercel**: `main` → production (custom domain, prod Supabase env); every branch → **preview URL** (the "dev server", staging Supabase env). Test every change on a preview before it ships.
  - **Release flow**: branch → preview → verify → merge to `main` → prod auto-deploy. Migrations run on staging → verify → then prod, and stay **additive/backward-compatible** (expand/contract; never drop a column the live app uses) so a deploy can't break the running app.
  - **Rollback**: Vercel keeps every build (one-click revert to last good) + git revert. Mock-fallback/try-catch reads already cushion a missing table.
- **Email-confirmation flow** verified end-to-end on prod.
- **Email live (Resend):** activate the staged pipeline; transactional sends for invites, callback notifications, cast offers, cast-published; a welcome email. Verify deliverability.
- **Analytics + monitoring:** PostHog (key funnels — actor signup→onboard→audition; theatre signup→create-show→publish; session replay; flags) + Sentry (client + server error capture).
  - [x] *Built 2026-07-05:* `src/lib/analytics.ts` wrapper + 9 funnel events instrumented + Sentry client/server init — all **dormant until keys are set** (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SENTRY_DSN`). Session replay/flags configure in the PostHog dashboard once the key exists.
- **Legal & trust:** Terms, Privacy (explicit minor/guardian data handling), cookie/consent.
  - [x] *Built 2026-07-05:* `/terms` + `/privacy` draft pages (marked "Draft — beta"), linked from signup fine print, landing footer, and auth layout. Cookie/consent banner still todo.
- **Reminder engine (pulled forward from Show Hub spec):**
  - [x] *Built 2026-07-05:* `send-reminders` Edge Function (audition-slot T-24h/T-2h + 48h offer nudges, idempotent via `reminder_log`, migration 008) — **deploy + 15-min cron still pending**, see `supabase/SETUP_REMINDERS.md`. Week-3 rehearsal reminders slot into its extension point.

### Week 2 — The differentiators (why we're better)
- **Conflict Calendar:** parse the conflict data we already collect → director view: conflict-count buckets (0 / 1–2 / 3–4 / 5+), "problem dates" (date + who + why), filters (all / shortlisted / cast), actions (email 3+, export, print), "best rehearsal dates" surfacing. *(Schema: structured conflict dates, not just the freetext string.)*
  - [x] *Built 2026-07-05:* `/shows/[showId]/conflicts` — buckets, per-day heat calendar over the rehearsal period, problem dates with names, people list, filter tabs, email-3+/CSV/print. Backed by `signup_conflicts` (migration 009 in `PASTE_ME_NEXT.sql` — **staging paste pending**); signup modal now persists structured ranges alongside the freetext string. Zero-conflict days = "schedule away"; low-heat days = the best rehearsal dates.
- **Production dashboard command center:** attention panel, activity feed, offer tracker, upcoming dates.
  - [x] *Built 2026-07-05:* `/shows` upgraded in place — "Needs your attention" panel (offers awaiting response > callbacks ready to send > auditions filling > unfinished setup), compact status strips on active show cards, collapsible offer tracker (actor/role/status/responded), "Coming up" timeline (next 5 dates across active shows). One dual-mode `getOrgDashboard(orgId)` aggregation (5 batched queries in cloud, degrades to empty on failure); the LOCKED shows grid never waits on it. Activity feed deferred (it's first in the cut order — revisit if Week 4 has room).

### Week 3 — The rehearsal lifecycle (full Show Home; retention engine)
- **Show Home** `/shows/[id]/home` (post-publish): cast & creative directory (privacy-scoped), SM update feed, rehearsal schedule with per-rehearsal conflict reporting ("conflicts used: 2 of 4"), communication norms / contact routing, volunteer & promotion hub (social-share templates, QR ticket code), membership CTA.
- **Schema:** rehearsals, sm_updates, rehearsal_conflicts, (volunteer slots) tables + RLS.
  - [x] *Built 2026-07-05 (Show Hub part 1):* `/shows/[showId]/hub` per SHOW_HUB_SPEC.md — personalized next-call card (.ics + "Can't make it" absences), announcements (targeting, pin, "also email" flag, read receipts w/ who-hasn't, mark-read on view, notification fan-out via `announce_to_show`), this-week + full day-grouped schedule (who's-called chips, per-row conflict/absence counts, called-scope picker), people + editable "who to contact" routing card, resources on a new private `show-files` bucket. Migration 010 (appended to `PASTE_ME_NEXT.sql` — **staging paste pending**) incl. `is_production_member` helper + volunteer tables/RPCs. Rehearsal reminders (T-24h + morning-of, called people only) wired into `send-reminders`. Actor entry: "Show Hub" link on cast shows in `/my-shows`; production entry: "Hub" subnav tab (cast-phase-gated) + setup quick action.
  - [x] *Built 2026-07-05 (Show Hub part 2):* dual-path volunteers — hub Volunteers section (team adds/edits needs, "Share public signup link", members one-tap claim/unclaim, fill state + guest pills), public `/volunteer/[showId]` guest page (anonymous, mobile-first: name+email claim, .ics, cancel link, account upsell — the approved gating exception) + tokened `/volunteer/cancel/[token]`. Migration 011 (appended to `PASTE_ME_NEXT.sql` — **staging paste pending**): `guest_emails` queue, anon-safe page RPCs, guest claims notify the team in-app + enqueue the confirmation email, `claim_volunteer_signups()` auto-link at sign-in. `send-reminders` extended: volunteer shift T-24h (members via notifications, guests via the email queue) + delivers `guest_emails` via Resend once the key exists. Promotion hub (social templates, QR) + membership CTA: deferred per SHOW_HUB_SPEC.md V1 cut line.

### Week 4 — Front door, trust, polish
- **Landing page redesign** (prototype-caliber; "free during beta" pricing).
  - [x] *Built 2026-07-05:* `/` rebuilt as a server component with the prototype's structure and our own honest copy — hero with dual role CTAs (`/signup?path=actor|maker`, preselects the onboarding fork) + browse link, 4-step how-it-works, for-actors and for-theatres value props (Conflict Calendar + Show Hub named), "Free during beta" band (replaces fabricated stats), built-with note (replaces testimonials), pricing (actors free forever · theatres free during beta, $29/mo planned, founding-member consideration), "standing ovation" final CTA, organized footer. Verified at desktop + 375px.
- **Casting board upgrades** (Compare Actors, conflict-aware tabs, soft warnings).
  - [x] *Built 2026-07-05:* ADDITIVE inside the LOCKED board's assign modal — conflict filter chips (All / No conflicts / ≤2 days) + per-candidate conflict-day counts from `getShowConflicts`, compare checkboxes (2–3) → side-by-side `CompareActorsModal` (headshot, vitals, conflict days, roles interested, endorsements, credit count, per-column "Cast this actor" → the existing assign mutation), and soft vocal/age fit warnings on selection (`src/lib/castingFit.ts` — voice-part + age-overlap heuristics; heads-up copy, never blocking). Verified in mock: chips filter the Narrator pool, compare renders 2-up, Jack (Tenor) + Priya (Soprano) triggers the vocal warning with unmodified mock data.
- **Account settings** (change email, delete account, notification preferences).
  - [x] *Built 2026-07-05:* `/settings` (linked from both nav avatar dropdowns + the mobile menu) — email change via `auth.updateUser({email})` with confirmation-link helper copy, password change (min 8 + confirm), per-category email toggles in `profiles.notification_prefs` (migration 012; the email pipeline skips categories turned off via `notifications.category` tags from `create_notification`/`announce_to_show`/`send-reminders` — in-app notifications always created), sign-out-everywhere (`scope:'global'`), and type-DELETE deletion via the `delete_my_account()` SECURITY DEFINER RPC. Mock: all sections visible, cloud-only actions toast, prefs toggle in-memory. **Migration 012 staging paste pending.**
- **SEO/OG meta** on public pages (shows/theatres/browse) — beta discovery + shareable links.
  - [x] *Built 2026-07-05:* root metadata defaults (`metadataBase`, `%s · Overture` template, OG site name/type + `public/og.png` 1200×630, twitter card); per-route `generateMetadata` wrapper layouts around the untouched client pages (`/auditions/[id]` "Auditions: {show} at {org}", `/theatres/[orgId]`, `/volunteer/[showId]`; static on `/browse`) via lean anon-key REST reads in `src/lib/seo.ts` (generic fallbacks in mock mode / on failure); `app/sitemap.ts` (static routes + open-show/org ids when configured) + `app/robots.ts` (gated app areas disallowed). Set `NEXT_PUBLIC_SITE_URL` on prod deploy.
- **Lead magnets (lean):** a `/resources` page + 2–3 downloadable templates (audition notice, casting checklist, rehearsal schedule) + email capture.
  - [x] *Built 2026-07-05:* `/resources` (public, anonymous) with 3 genuinely useful printable templates as print-to-PDF pages (`/resources/audition-notice` fill-in-the-blank notice incl. the commitment section, `/resources/casting-checklist` week-by-week timeline from show pick to cast list, `/resources/rehearsal-schedule` weekly grid w/ who's-called column + conflicts row) on a shared `TemplatePage` scaffold (print CSS shows only the document). Email capture (name + email + honeypot) → `resource_leads` via the anon `submit_resource_lead` RPC (migration 012); mock toasts success without storing. Linked from the landing footer + logged-out Nav; added to the sitemap. **Migration 012 staging paste pending.**
- **QA pass:** walk the full loop with fresh real accounts (actor + theatre); fix; copy polish.
  - [x] *Built 2026-07-05 (owner QA round 1):* three owner-reported fixes — share affordances (View public page + Copy link) on the auditions management page; public audition page now shows per-block "N of M filled" to everyone incl. anonymous, plus attendee names as "First L." for signed-in users only (`get_signup_names` RPC, migration 013 — **staging paste pending**; deliberately NO profile links, never names to anon); status step-back on setup (Reopen Auditions / back to closed / back to callbacks / restore from archive, each behind an honest-warning confirm modal; published-cast step-back points to the Cast List Unpublish).
  - [x] *Built 2026-07-05:* **QA seed population** — `supabase/QA_SEED.sql` creates 60 varied dummy actors (names/vocal ranges/heights/ages/cities/skills; 8 minors w/ guardians) + 3 theatre-makers with NO org (for join/claim testing) directly in auth.users, all confirmed, shared password `OvertureQA2026!`, idempotent. `supabase/QA_TEARDOWN.sql` removes them (cascade) with a verification count. Paste order: migration 013 (`PASTE_ME_NEXT.sql`) first, then `QA_SEED.sql`. Staging only.

---

## Explicitly NOT in the 30 days (fast-follow, in priority order)
1. **Stripe billing** + customer portal + entitlements (the moment beta → paid)
2. **Geocoding / real distance search** (Maps API decision pending; "within X miles" is approximate until then) — *stretch into Week 4 if ahead*
3. **Build B** — verified-collaborator theatre reviews, follow-a-theatre, thumbs-up
4. Google OAuth · duplicate-theatre prevention/claiming · pre-loaded show DB (Concord/MTI) · per-show messaging · full actor↔theatre role-switcher

---

## Honest risk note
This is dense — full Show Home + Conflict Calendar + landing + dashboard + casting upgrades + all the infra + legal in four weeks is aggressive. If we slip, the cut order is: lead-magnet depth → casting-board soft warnings → dashboard activity feed → volunteer/promo hub polish. The non-negotiables (deploy, email, conflict calendar, core Show Home, analytics, legal, landing) hold the line. Quality Bar (CLAUDE.md) is not what we cut.
