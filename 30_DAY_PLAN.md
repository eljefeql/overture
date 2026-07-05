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
- **Production dashboard command center:** attention panel, activity feed, offer tracker, upcoming dates.

### Week 3 — The rehearsal lifecycle (full Show Home; retention engine)
- **Show Home** `/shows/[id]/home` (post-publish): cast & creative directory (privacy-scoped), SM update feed, rehearsal schedule with per-rehearsal conflict reporting ("conflicts used: 2 of 4"), communication norms / contact routing, volunteer & promotion hub (social-share templates, QR ticket code), membership CTA.
- **Schema:** rehearsals, sm_updates, rehearsal_conflicts, (volunteer slots) tables + RLS.

### Week 4 — Front door, trust, polish
- **Landing page redesign** (prototype-caliber; "free during beta" pricing).
- **Casting board upgrades** (Compare Actors, conflict-aware tabs, soft warnings).
- **Account settings** (change email, delete account, notification preferences).
- **SEO/OG meta** on public pages (shows/theatres/browse) — beta discovery + shareable links.
- **Lead magnets (lean):** a `/resources` page + 2–3 downloadable templates (audition notice, casting checklist, rehearsal schedule) + email capture.
- **QA pass:** walk the full loop with fresh real accounts (actor + theatre); fix; copy polish.

---

## Explicitly NOT in the 30 days (fast-follow, in priority order)
1. **Stripe billing** + customer portal + entitlements (the moment beta → paid)
2. **Geocoding / real distance search** (Maps API decision pending; "within X miles" is approximate until then) — *stretch into Week 4 if ahead*
3. **Build B** — verified-collaborator theatre reviews, follow-a-theatre, thumbs-up
4. Google OAuth · duplicate-theatre prevention/claiming · pre-loaded show DB (Concord/MTI) · per-show messaging · full actor↔theatre role-switcher

---

## Honest risk note
This is dense — full Show Home + Conflict Calendar + landing + dashboard + casting upgrades + all the infra + legal in four weeks is aggressive. If we slip, the cut order is: lead-magnet depth → casting-board soft warnings → dashboard activity feed → volunteer/promo hub polish. The non-negotiables (deploy, email, conflict calendar, core Show Home, analytics, legal, landing) hold the line. Quality Bar (CLAUDE.md) is not what we cut.
