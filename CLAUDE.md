@AGENTS.md

# Overture Design System & Development Rules

**Read this ENTIRE file before writing ANY UI code.** These rules are the single source of truth for visual consistency. If a pattern isn't here, check existing pages before inventing something new.

---

## Core Principles

- **Community theatre app** — not just casting utility. Connecting great people to create great communities performing great theatre.
- **Actors are the network.** Actor experience must be exceptional. They pull theatres onto the platform.
- **Mobile-first** for actor flows. Desktop-first for production team flows.
- **"The Chris Rule":** A user cannot be on the production team AND audition for the same show.

---

## Feature Registry — LOCKED / OPEN

**This is a contract.** Every shipped feature is listed here with a status.

- **LOCKED** = working and depended upon. **Do NOT remove, rename, or change its behavior, UI, data shape, or copy unless the user explicitly tells you to in the current session.** If a task seems to require changing a LOCKED feature, stop and ask first. "Refactors," "cleanups," and "while I was in there" do not override LOCKED.
- **OPEN** = in flux, incomplete, decided-but-unbuilt, or planned. Free to build/change/redesign.

A feature being LOCKED does not freeze *bugs*: fixing a clearly-broken behavior is allowed, but say what you changed and why. When you add a new feature and the user confirms it works, move it to LOCKED in this file.

### Foundations & architecture
| Feature | Status | Note |
|---|---|---|
| Design system (tokens, typography, components, standard patterns below) | **LOCKED** | The rules in this file are non-negotiable. |
| Dual-mode data layer (`isSupabaseConfigured` branch + mock fallback) | **LOCKED** | Mock mode must ALWAYS keep working with no `.env.local`. Never break it. |
| Real auth (Supabase email+password; session restore; mock personas as fallback) | **LOCKED** | Anon key only — never the service key, never in client. |
| The Chris Rule (no auditioning for a show you're on the team of) | **LOCKED** | Product invariant. |
| Access-gating model (public = authenticated, never anonymous; anon never sees a person) | **LOCKED** | See `[[overture-access-gating]]`. ONE approved exception: anonymous guest volunteer signup at `/volunteer/[showId]` (SHOW_HUB_SPEC.md — low-risk, capacity-checked SECURITY DEFINER RPCs, never exposes who signed up to anon). |
| `AuthGuard` on `(actor)` + `(production)` with deep-link return (`?next=`) | **LOCKED** | |
| Navigation system (owner-authorized redesign 2026-07-05) | **LOCKED** | Three pieces, strict separation: **actor `Nav`** ((actor)+(public) groups) ALWAYS renders actor links (Discover / My Shows / Profile + bell + avatar) — it never reads `activeRole`, never shows a show menu (the old stale-team-role `teamLinks` leak is deleted; do not reintroduce). **`ProductionTopNav`** always shows persistent "My Shows" (/shows) + "My Theatre" (/org) links on EVERY production page, desktop AND mobile; inside a show it adds the title-labeled show switcher (own row on mobile) and `ProductionSubNav`. **`PreviewBanner`** on public show/theatre pages tells team/org viewers "this is what actors see" with a back link — never shown to actors/anon, silent-fails. Visiting public pages never changes role/context. |
| `useOrg()` org identity (never hardcode `org-1`) | **LOCKED** | Every production page derives org from this hook. |
| Production permission gating (team/owner/admin; `canEvaluate` for evaluation actions) | **LOCKED** | |
| Three-tier profile privacy (public / private / hidden) | **LOCKED** | |
| Supabase schema + RLS (migrations 001–007) | **LOCKED** | Don't drop/rename tables or columns, or weaken RLS, without explicit say-so. |
| Storage buckets: `photos`, `resumes` (private), `org-media` + owner/admin-scoped policies | **LOCKED** | |

### Auth & onboarding
| Feature | Status | Note |
|---|---|---|
| Login + Signup (email/password, confirm, email-confirmation state) | **LOCKED** | |
| Onboarding fork (Actor / Theatre-maker); actor wizard incl. minor/guardian branch; maker wizard creates a real org | **LOCKED** | |
| Sign-up wall (anon "Sign Up to Audition" → signup → return to show) | **LOCKED** | |
| "My Theatre" entry in actor nav for org members | **LOCKED** | The actor↔theatre bridge. |
| Google OAuth | **OPEN** | Button present, toasts "arrives with provider setup". Needs Google Cloud credential. |

### Actor side
| Feature | Status | Note |
|---|---|---|
| Discover (radius/sort/type filters, search, promoted, For You / Further Out) | **LOCKED** | |
| Audition detail — phase-aware state machine (browsing→signed-up→callback→cast) | **LOCKED** | Most thoroughly designed page; the reference for new UI. |
| Audition signup modal (slots, roles, conflicts, acknowledgments — all persist) | **LOCKED** | |
| My Shows (per-show timelines, callback accept/decline, past credits) | **LOCKED** | |
| Notifications (unread/read, mark-read, real unread nav badge) | **LOCKED** | |
| Cast offers (agreements, confetti, guardian-bound consent for minors) | **LOCKED** | |
| Profile (single scrolling page): vitals, bucket list, endorsements, acting credits, crew credits, training, awards, measurements, skills, minor/guardian card | **LOCKED** | |
| Profile editing modals (Profile / Credit / CrewCredit / Training / Award) | **LOCKED** | |
| Photos (headshot, production gallery w/ captions, resume PDF via signed URLs) | **LOCKED** | Cloud-only; mock shows "Coming Soon". |
| Share + Add-to-Calendar (.ics) on audition page | **LOCKED** | |
| Availability toggle + Invite-to-Audition | **OPEN** | `isAvailable` renders a badge; nothing sets it. Deferred to comms layer. |

### Theatre / production side
| Feature | Status | Note |
|---|---|---|
| Instant single-screen show creation (pre-filled from theatre) | **LOCKED** | Replaced the old 4-step wizard. |
| Show home — checklist-forward + day-based audition scheduler | **LOCKED** | No per-block datetime entry. |
| Callback scheduling (date/time/location/notes) on setup | **LOCKED** | |
| Auditions schedule (batch status ops, search/filter, actor slide panel, team notes) | **LOCKED** | |
| Callbacks management (role pools, uncalled-actors safety net, prep notes) | **LOCKED** | |
| Casting board (primary/alternate/understudy, candidate pools, send offers → publish gating) | **LOCKED** | |
| Cast list (publish, share, print, unpublish) | **LOCKED** | |
| Show poster upload + display | **LOCKED** | |
| Preview & "Copy link" to public audition page from setup | **LOCKED** | |
| Conflict Calendar (`/shows/[showId]/conflicts` — buckets, day heat map, problem dates, people list, email/CSV/print) | **OPEN** | Built 2026-07-05, pending user verify. Needs migration 009 (`signup_conflicts`) pasted for cloud data. |
| Shows command center (`/shows`: "Needs your attention" panel, per-card status strips, collapsible offer tracker, upcoming-dates timeline; `getOrgDashboard(orgId)` aggregation) | **OPEN** | Built 2026-07-05, pending user verify. Additive AROUND the LOCKED shows grid — grid/cards/filters/links unchanged and never wait on the aggregation query. |
| Show Hub part 1 (`/shows/[showId]/hub` — next-call card w/ .ics + absence reporting, announcements w/ targeting/pin/read-receipts/email-flag, this-week + full schedule w/ called-scope picker + conflict/absence counts, people + comm-norms routing card, resources w/ `show-files` bucket) | **OPEN** | Built 2026-07-05, pending user verify. Needs migration 010 (in `PASTE_ME_NEXT.sql`) for cloud data; mock demos fully on show-1. Access = production member (accepted cast + team + org admin), NOT team-only. |
| Volunteer dual-path (hub Volunteers section + public `/volunteer/[showId]` guest page + tokened `/volunteer/cancel/[token]`) | **OPEN** | Built 2026-07-05 (Show Hub part 2), pending user verify. Team manages needs + "Share public signup link"; production members one-tap claim/unclaim; guests sign up with name+email, NO account (approved gating exception). Tables/RPCs in migration 010; guest email queue + page RPCs + auto-link in migration 011 (both in `PASTE_ME_NEXT.sql`). Mock demos fully on show-1. |
| Theatre hub `/org` — details (founded/mission/socials/ticketing), logo, Spaces, Key People, Photos, code of conduct, members + invites, collaborators | **LOCKED** | |
| Public theatre page — reputation surface ("should I work here?") | **LOCKED** | Empty sections omitted for visitors. |
| Spaces with type grouping (Main Stage / Rehearsal / Other) | **LOCKED** | |
| Manual past productions (merged with auto-derived) | **LOCKED** | |
| Org member invitations + auto-accept at invitee's next sign-in (in-app) | **LOCKED** | Email delivery is OPEN (Resend). |
| Archive show | **LOCKED** | |

### Public layer
| Feature | Status | Note |
|---|---|---|
| `/browse`, `/auditions/[id]`, `/theatres/[orgId]` anonymous-viewable | **LOCKED** | |
| Public signup-count teaser + SM-contact gating on audition pages | **LOCKED** | |
| Rich-text (bold/italic/bullets) for mission + code of conduct; safe Markdown render; photo Lightbox | **LOCKED** | |
| Landing page redesign (`/` — hero w/ dual role CTAs carrying `?path=actor\|maker` into signup→onboarding fork preselect, 4-step how-it-works, for-actors + for-theatres value props naming Conflict Calendar + Show Hub, "Free during beta" band, built-with note, honest pricing incl. $29/mo-planned + founding-member consideration, "standing ovation" final CTA, 3-column footer) | **OPEN** | Built 2026-07-05, pending user verify. Server component; honest copy only — no fabricated stats/testimonials. The `?path` hint reads are small additive lines in the LOCKED signup + onboarding pages (no behavior change without the param). |
| SEO/OG meta on public pages (`src/lib/seo.ts` lean anon REST reads → `generateMetadata` layouts for `/auditions/[id]`, `/theatres/[orgId]`, `/volunteer/[showId]`; static meta on `/browse` + landing; root `metadataBase`/OG/twitter defaults; `public/og.png` 1200×630 branded default; `app/sitemap.ts` + `app/robots.ts`) | **OPEN** | Built 2026-07-05, pending user verify. Falls back to generic titles in mock mode / on any fetch failure; client pages untouched (metadata-only wrapper layouts). Set `NEXT_PUBLIC_SITE_URL` in prod (defaults to `https://overturecasting.com`). |

### Comms
| Feature | Status | Note |
|---|---|---|
| In-app notification creation (callback-notify, send-offers, offer responses) | **LOCKED** | |
| Email delivery via Resend Edge Function | **OPEN** | Staged + no-ops without `RESEND_API_KEY`. See `supabase/SETUP_RESEND.md`. |
| Reminder cron (`send-reminders`: audition T-24h/T-2h + 48h offer nudges + rehearsal T-24h/morning-of to CALLED members only + volunteer shift T-24h, idempotent via `reminder_log`; also delivers the `guest_emails` queue — guest volunteer confirmations + reminders — via Resend) | **OPEN** | Built; deploy + 15-min cron pending. See `supabase/SETUP_REMINDERS.md`, migrations 008 + 010 + 011. Rehearsal/volunteer scans degrade quietly until pasted; guest emails wait as `pending` until `RESEND_API_KEY` is set, then send automatically. |
| PostHog analytics (`src/lib/analytics.ts` + funnel events) & Sentry (instrumentation files) | **OPEN** | Dormant until `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_SENTRY_DSN` set — must stay no-op without keys. |
| `/terms` + `/privacy` draft legal pages (linked from signup, landing footer, auth layout) | **OPEN** | Content marked "Draft — beta". |

### OPEN — decided/planned, not built
| Feature | Status | Note |
|---|---|---|
| Build B: verified-collaborator theatre reviews (stars), follow-a-theatre, thumbs-up on photos/shows | **OPEN** | Decided 2026-06-12; parked. See `[[overture-theatre-depth]]`. |
| Duplicate-theatre prevention + claim/request-to-join flow | **OPEN** | Sprint D Phase 3. |
| Geocoding / real radius distance (currently `distanceMiles` is null in cloud) | **OPEN** | Sprint D Phase 4; needs Google vs Mapbox decision. |
| Account settings `/settings` (email change via Supabase confirmation, password change, per-category email notification toggles, sign-out-everywhere, type-DELETE account deletion) | **OPEN** | Built 2026-07-05, pending user verify. Needs migration 012 (`PASTE_ME_NEXT.sql`) for cloud prefs/deletion; mock keeps everything visible with "available with cloud" toasts (prefs toggle in-memory). Reached from BOTH nav avatar dropdowns + the mobile menu. |
| Casting-board upgrades (conflict-aware pool chips + per-candidate conflict-day counts, 2–3-actor Compare modal w/ "Cast this actor", soft vocal/age fit warnings) | **OPEN** | Built 2026-07-05, pending user verify. **ADDITIVE on the LOCKED casting board** — board layout/flow unchanged; everything lives inside the existing assign modal (default "All candidates" = original view) + one new read-only compare modal. Uses `getShowConflicts` + `src/lib/castingFit.ts` heuristics; warnings are heads-up only, never blocking. |
| Resources / lead magnets `/resources` (3 printable templates: audition notice, casting checklist, rehearsal schedule; each a print-to-PDF page; email capture to `resource_leads` via honeypot-checked anon RPC) | **OPEN** | Built 2026-07-05, pending user verify. Public/anonymous; linked from landing footer + logged-out Nav. Migration 012 backs the lead table; mock mode toasts success without storing. |
| Content advisories on shows + dealbreaker filtering on Discover | **OPEN** | Dealbreakers collected but filter nothing yet. |
| Pre-loaded show/character database (Concord + MTI) | **OPEN** | V1.2 research; write our own descriptions. |
| Billing / `$29/mo` / `/org/dashboard` | **OPEN** | V2. |
| Per-show messaging (`/shows/[showId]/messages`) | **OPEN** | Planned. |
| Full role-switcher UX (actor↔theatre hats beyond the nav entry) | **OPEN** | |

---

## Quality Bar

The standard every change must clear before it's "done." If a change can't meet this, say so rather than shipping below it.

**Correctness & safety**
- `npx tsc --noEmit` is clean and `npx next build` passes before a task is called done. No type errors, no `any` to dodge a real type.
- **Mock mode and cloud mode both work.** Every data-layer change keeps the `isSupabaseConfigured` branch AND the mock fallback. Cloud reads of not-yet-migrated tables are wrapped so they degrade to empty, never crash.
- **Anon key only**, never the service/secret key, never a secret in client code or committed files. Schema changes go to a single pasteable, idempotent SQL file the user runs.
- No console errors in normal flows. Every mutation: `onSuccess` → `invalidateQueries` + a toast; every async action has an error path.
- Don't regress LOCKED features. Don't claim something works that you haven't verified — report what was actually checked.

**UI & design**
- The design-system rules in this file are non-negotiable: semantic tokens only, `Card` for boxed content, duotone Phosphor icons at `text-stage-500` inside cards, `font-display` for names/titles only, the standard patterns copied exactly.
- **Every state is handled:** loading (`PageSkeleton`), empty (`EmptyState` with a real CTA), and error (toast). Never an infinite skeleton or a blank screen.
- Mobile-first for actor flows, desktop-first for production — but neither is ever broken on the other. Tap targets are real; modals are reachable; the keyboard doesn't cover inputs.
- Interactive elements are accessible: labels/`aria-label`, visible focus, keyboard operability (e.g. Lightbox arrow keys + Esc).
- Copy is warm and plain — community-theatre voice, never corporate or jargon-y. Microcopy explains *why* (privacy notes, guardian context), not just *what*.

**Product judgment**
- **Creation instant, depth progressive.** Don't gate someone behind a form they don't need yet. Match operating simplicity to the moment.
- **Protect minors and private data** by default — guardian consent, privacy tiers, gating enforced, not optional.
- Verify observable changes in the browser when a server can exercise them; share proof. When something is stubbed or deferred, label it honestly in the UI and the roadmap.
- When a decision is genuinely the user's (scope, product direction, trade-offs), ask — don't guess and don't silently expand scope.

---

## Color Palette (defined in globals.css @theme inline)

| Token     | Role                      | Usage                              |
|-----------|---------------------------|------------------------------------|
| curtain-* | Primary plum              | Text, headings, nav, primary UI    |
| stage-*   | Accent gold               | CTAs, highlights, date blocks, year labels, verified badges |
| cream-*   | Neutral warm              | Backgrounds, borders, dividers     |
| forest-*  | Positive/success          | Availability, accepted, check icons |
| ruby-*    | Negative/danger           | Errors, declined, warnings, likes  |
| clay-*    | Warm gray                 | Secondary text, labels, icons      |

## Typography

- **Headings / display text:** `font-display` (DM Serif Display)
- **Body / UI text:** default font-body (Inter)
- **Page titles:** `text-3xl font-display text-curtain-900`
- **Section headers:** `text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3`
- **Card titles (inside cards):** use `<CardTitle>` component → `text-lg font-display text-curtain-900`

**`font-display` is for names and titles only** — page headings, show titles, actor names, card titles. Never for data values, stats, or UI labels. Stat blocks, measurements, and metrics use `font-semibold` (Inter).

**NEVER** mix font treatments within a visual group.

---

## CSS Rules — NEVER Break These

- **NEVER** left-border highlights (no `border-l-*`)
- **NEVER** top-border highlights (no `border-t-*`)
- **NEVER** raw Tailwind colors — always use semantic tokens (curtain, stage, cream, forest, ruby, clay)
- **NEVER** hardcode card-like styling with raw divs — use the `<Card>` component
- **NEVER** use `space-y-*` for card lists — use `flex flex-col gap-*` instead (consistent gap control)

---

## Card Component Usage

```
import { Card, CardHeader, CardTitle } from "@/components/ui";
```

| Variant       | When to use                                    |
|---------------|------------------------------------------------|
| `elevated`    | Default. Clickable cards, list items, standalone content |
| `flat`        | Inside other cards, bio sections, inline content |
| `sunken`      | Stat blocks, contact info, quiet data display  |
| `highlighted` | Urgent/action items (callbacks needing response) |

| Padding     | When to use                     |
|-------------|----------------------------------|
| `compact`   | Stat blocks, dense lists, inline items |
| `standard`  | Default. Most content cards      |
| `spacious`  | Hero sections, empty states      |

**Interactive cards** (clickable): Add `interactive` prop. Never manually add hover classes.

**White interiors are the default.** Content cards, stat blocks, list items — all use `variant="flat"` (white). Reserve `sunken` (cream-50) only for page-level empty states and contact info with privacy headers.

---

## Standard Patterns — Copy These Exactly

### Section Header
```tsx
<h3 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
  Section Title
</h3>
```
Always `mb-3`. No exceptions.

### Stat Block (vitals, measurements, metrics)
```tsx
<Card variant="flat" padding="compact" className="text-center">
  <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
    Label
  </p>
  <p className="text-lg font-semibold text-curtain-900">
    Value
  </p>
</Card>
```
Note: Stat values use `font-semibold` (Inter), NOT `font-display`. The display serif is reserved for names and titles, not data values.
Grid: `grid grid-cols-2 md:grid-cols-4 gap-3` (or `grid-cols-3` for 6+ items)

### Date Block (used in dashboard audition cards, audition detail post-signup)
```tsx
<div className="w-14 h-14 rounded-xl bg-stage-100 flex flex-col items-center justify-center flex-shrink-0">
  <span className="text-lg font-display text-stage-700 leading-none">
    {day}
  </span>
  <span className="text-[10px] font-semibold text-stage-500 uppercase">
    {month}
  </span>
</div>
```
Always `stage-*` colors. Never `curtain-*` for date blocks.

### Privacy Indicator (for contact info, measurements, etc.)
```tsx
<div className="flex items-center gap-1.5 mb-3">
  <h3 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase">
    Section Title
  </h3>
  <Lock className="w-3 h-3 text-clay-400" weight="duotone" />
  <span className="text-[10px] text-clay-400">
    Only visible to you &amp; production teams
  </span>
</div>
```

### Icon Usage
- **Always** import from `@phosphor-icons/react` (client components)
- **Always** `weight="duotone"` unless specifically needed otherwise (e.g., `weight="fill"` for active states, verified badges)
- **Inline icons** (next to text): `w-3.5 h-3.5` or `w-4 h-4`. **NEVER** `w-3 h-3` — duotone icons look washed out at 12px.
- **Card/block icons**: `w-5 h-5` to `w-8 h-8`
- **Icon color inside cards and content areas**: ALWAYS `text-stage-500` (gold) with `weight="duotone"`. This applies to ALL icons in cards — calendars, map pins, phones, envelopes, graduation caps, trophies, ID badges, everything. NEVER `text-clay-400` (gray) for icons inside cards. Gray icons are ONLY for navigation chrome (search bar icon, bottom tab inactive state).
- **Icon color in plain text**: `text-clay-400` for secondary, `text-curtain-*` for primary.

### Card List
```tsx
<div className="flex flex-col gap-3">
  {items.map(item => (
    <Card key={item.id} variant="elevated" padding="standard">
      ...
    </Card>
  ))}
</div>
```
Gap sizes: `gap-3` for card lists, `gap-2` for tight lists (pills, tags), `gap-6` only for top-level page cards on discover.

### Gold Line Divider
```tsx
<hr className="gold-line" />
```
Use sparingly — only as a visual break between major page sections (e.g., between hero and body content).

### Empty State
```tsx
<EmptyState
  icon={<IconName className="w-12 h-12" weight="duotone" />}
  title="Title"
  description="Description text."
  action={<Button>Action</Button>}
/>
```

---

## Page Layout Standards

- **Max width:** `max-w-2xl mx-auto px-6 py-8` for all actor pages
- **Navigation:** Actor/public pages use `Nav` (desktop centered actor links + avatar dropdown, mobile hamburger; NEVER a show menu — actor links only). Production pages use `ProductionTopNav` (persistent "My Shows · My Theatre" links on every page + title-labeled show switcher inside a show) with `ProductionSubNav` show tabs. Public show/theatre pages add `PreviewBanner` for team/org viewers. No bottom tabs.
- **Loading state:** Always `<PageSkeleton />` while data loads
- **Null/empty fallback:** Always handle null data with a meaningful empty state, never infinite skeleton

---

## Component Inventory

Before creating a new component, check if one of these already handles your need:

| Component     | Location                          | Purpose                    |
|---------------|-----------------------------------|----------------------------|
| Card          | `@/components/ui/Card`            | All boxed content          |
| Avatar        | `@/components/ui/Avatar`          | User/org photos, sizes xs-xl |
| Badge         | `@/components/ui/Badge`           | Status labels (success, warning, etc.) |
| VerifiedBadge | `@/components/ui/Badge`           | Gold seal check icon       |
| Pill          | `@/components/ui/Pill`            | Tags, filters, endorsements, skills |
| Button        | `@/components/ui/Button`          | Actions (primary=gold, secondary=plum, outline, ghost, danger) |
| Modal         | `@/components/ui/Modal`           | Bottom-sheet mobile, centered desktop |
| EmptyState    | `@/components/ui/EmptyState`      | No-data fallbacks          |
| PageSkeleton  | `@/components/ui/Skeleton`        | Loading states             |
| Nav           | `@/components/ui/Nav`             | Actor/public top nav — ALWAYS actor links (Discover / My Shows / Profile), never show menus; desktop links + avatar dropdown, mobile hamburger |
| ProductionTopNav | `@/components/ui/ProductionTopNav` | Production top nav — persistent "My Shows · My Theatre" links (all pages, all widths) + title-labeled show switcher inside a show + avatar dropdown |
| ProductionSubNav | `@/components/ui/ProductionSubNav` | Show-scoped tab row (Setup…Hub) + status badge, phase-gated |
| PreviewBanner | `@/components/ui/PreviewBanner`   | "You're viewing the public page" banner on public show/theatre pages for team/org viewers only (cached access check, silent-fail) |
| PageHeader    | `@/components/ui/PageHeader`      | Production team dark header |
| SlidePanel    | `@/components/ui/SlidePanel`      | Side panel (production team actor view) |
| TeamNotesFeed | `@/components/casting/TeamNotesFeed` | Team notes display + input |
| ActorCard     | `@/components/actors/ActorCard`   | Actor in audition schedule grid |
| ShowCard      | `@/components/shows/ShowCard`     | Show in discover/shows list |
| AuditionSignupModal | `@/components/auditions/AuditionSignupModal` | Signup form modal |
| ConflictDatePicker  | `@/components/auditions/ConflictDatePicker`  | Date range conflict entry |
| ProfileEditModal    | `@/components/profile/ProfileEditModal`      | Profile fields — 4 tabs: Basic Info, About, Private, Measurements |
| CreditEditModal     | `@/components/profile/CreditEditModal`       | Acting credits CRUD; verified credits locked, manual editable |
| CrewCreditEditModal | `@/components/profile/CrewCreditEditModal`   | Production/crew work CRUD (position + show + theatre + year); separate from acting credits |
| TrainingEditModal   | `@/components/profile/TrainingEditModal`     | Training & education CRUD |
| AwardEditModal      | `@/components/profile/AwardEditModal`        | Awards & recognition CRUD |
| Lightbox            | `@/components/ui/Lightbox`                   | Full-screen photo viewer — prev/next via on-screen buttons + arrow keys, Esc to close, shows caption + kind label, wraps around. Used by the public theatre gallery |
| RichTextEditor      | `@/components/ui/RichTextEditor`             | Simple markdown editor: textarea + 3-button toolbar (Bold / Italic / Bulleted list). Emits MARKDOWN. Used in the org mission + code-of-conduct modals |
| Markdown            | `@/components/ui/Markdown`                   | SAFE markdown renderer — parses ONLY `**bold**`, `_italic_`/`*italic*`, and `- bullets`; builds the React element tree (NEVER `dangerouslySetInnerHTML`). Renders RichTextEditor output on the public theatre + hub pages |

---

## Profile Structure

The actor profile (`/profile`) is a single scrolling page, NOT tabbed. Editing happens through focused modals, each triggered by a pencil icon next to its section header (or an empty-state CTA):

- **ProfileEditModal** (top "Edit" button) — bio, vitals, location, pronouns, plus the Private tab (contact, appearance, accessibility, dealbreakers) and Measurements.
- **CreditEditModal / TrainingEditModal / AwardEditModal** — list editors using the inline toggle-form pattern (see ConflictDatePicker). Each add/edit/delete is its own immediate mutation; no batched save. Delete uses inline confirmation.

**Privacy tiers** (enforced in display + future RLS): Public (name, vitals, bucket list, skills, training, awards, credits) · Private — actor + production teams (contact, appearance, measurements, guardian info) · Hidden — actor only (dealbreakers, accessibility needs). Verified credits come from Overture casting and can't be edited; manual credits have no verified badge.

---

## Data Layer

- **API client:** `src/lib/api/client.ts` — all data access goes through here. Supabase-backed when `.env.local` is configured (`isSupabaseConfigured` branch pattern), mock fallback otherwise. Migrated: public show/org reads, `getActor`, profile/credit/training/award mutations, audition signups (incl. withdraw-as-status-flip + revive), callbacks, cast assignments/offers, notifications (reads + creation via `create_notification` RPC at callback-notify / send-offers / offer-response moments — requires migration 005), AND the full theatre side: show/role/slot CRUD, show team (`getShowTeam`/`addTeamMember` — email-matched profiles get linked + notified, others stored as guests), team notes, org hub (`updateOrg`, `getOrgMembers` incl. pending invites, `inviteOrgMember`, role/remove), invite acceptance via `claim_org_invites` RPC (migration 006). Onboarding writes: `src/lib/api/onboarding.ts`. Photos/resume: `src/lib/api/photos.ts` (cloud-only; also `uploadShowPoster` → org-media bucket + `shows.poster_url`). Theatre profile depth (Sprint D Phase 2): `Org` now carries `foundedYear, mission, facebookUrl, instagramUrl, ticketingUrl`; new types `Venue`, `OrgLeader`, `OrgPhoto`; CRUD via `getVenues/…`, `getOrgLeadership/…`, `getOrgPhotos/addOrgPhoto/deleteOrgPhoto` in `client.ts` (cloud reads of these new tables are try/catch-wrapped → `[]` until migration 007 / PASTE_ME_NEXT.sql is pasted). `shows.posterUrl` displays on ShowCard, public audition hero, theatre season. **Build A (theatre polish):** `Venue.spaceType` (`performance`/`rehearsal`/`other`) groups & labels spaces on the public page ("Spaces", performance shown as "Main Stage"); `OrgPastProduction` (manual history — `getOrgPastProductions/create/update/deleteOrgPastProduction`) is MERGED with auto-derived past shows (cast/archived) on the public page, sorted by year desc; org logo upload via `uploadOrgLogo` (photos.ts, cloud-only); callback scheduling (date/time-range/location/notes) on the show setup page; audition blocks grouped by day on setup + public audition pages. All new cloud reads are try/catch-wrapped → `[]` until `PASTE_ME_NEXT.sql` is pasted (adds `venues.space_type` + `org_past_productions`). Email channel: `supabase/functions/send-notification-email` (Resend; staged — see `supabase/SETUP_RESEND.md`).
- **Org identity:** `useOrg()` (`src/features/auth/useOrg.ts`) — the signed-in user's theatre `{ org, role, isLoading }`. NEVER hardcode `org-1`; every production page derives orgId/orgName from this hook (mock mode resolves to org-1 automatically). `claimPendingInvites()` runs at sign-in, session restore, and onboarding finish.
- **Production gating:** the `(production)` layout blocks cloud users who aren't on the show's team or owner/admin of its org (friendly empty states; `getShowAccess`). `getShowAccess` now also has a REAL mock branch (checks mock `showTeam` + `orgMembers`) and `getOrgAccess(orgId, userId)` checks active org membership — both power the public-page `PreviewBanner` in both modes. Audition evaluation actions (status changes, shortlist, batch ops) are hidden unless the user `canEvaluate` (org owner/admin always can).
- **Analytics & monitoring (dormant-safe):** `src/lib/analytics.ts` — lazy PostHog wrapper (`track`/`identify`/`resetAnalytics`); every call is a silent no-op unless `NEXT_PUBLIC_POSTHOG_KEY` is set (host override: `NEXT_PUBLIC_POSTHOG_HOST`). `AnalyticsProvider` (in the `Providers` chain) captures SPA pageviews. `identify` fires in AuthContext on sign-in/session-restore (cloud mode only, never mock personas); funnel events (`signup_completed`, `onboarding_completed`, `audition_signup`, `show_created`, `auditions_opened`, `offers_sent`, `offer_accepted`, `org_invite_sent`, `cast_list_published`) are one-liners at existing mutation success points. Sentry: `src/instrumentation.ts` + `src/instrumentation-client.ts` + root `sentry.server/edge.config.ts`, all gated on `NEXT_PUBLIC_SENTRY_DSN` — zero effect (and zero bundle download) when unset. Reminder cron: `supabase/functions/send-reminders` + `reminder_log` (migration 008, service-role only) — see `supabase/SETUP_REMINDERS.md`.
- **Show Hub data:** `src/lib/api/hub.ts` — same dual-mode contract as client.ts (kept separate to stay maintainable). Migration 010 (in `PASTE_ME_NEXT.sql`) adds `rehearsals` + `rehearsal_calls`/`rehearsal_call_people`, `rehearsal_absences`, `announcements` + `announcement_reads`, `show_files` (+ private `show-files` storage bucket, path `${showId}/...`), `show_comm_norms` (one jsonb row per show: `[{topic, contact, method}]` — the "who to contact" routing card), `volunteer_needs`/`volunteer_signups` (tables + guest RPCs only; UI is part 2), a `is_production_member(show_id)` SQL helper (accepted cast + show team + org owner/admin — hub RLS keys off it), and `announce_to_show()` (SECURITY DEFINER fan-out of an announcement to its targeted members as `notifications` type `system`; email rides the existing pipeline). Cloud reads of all 010 tables are try/catch-wrapped → `[]` pre-paste. `getHubData(showId, userId)` composes show/roles/team/accepted-cast/rehearsals/absences/announcements/norms/conflicts in one Promise.all; `getHubAccess` is the production-member gate (the `(production)` layout uses it for `/hub` routes instead of team-only `getShowAccess`). Called-scope resolution (`everyone` = cast+team · `group` principals/ensemble by role_type, crew = team · `custom` = picked people) lives in `resolveCalledUserIds` and is mirrored by `announce_to_show` and the rehearsal scan in `send-reminders`. Mock hub data: `src/data/hub.ts` (rehearsal dates generated relative to today so the demo always has a next call). **Volunteers (part 2):** hub.ts also carries the dual-path volunteer API — `getVolunteerNeeds` (needs + confirmed signups w/ guest flag, production-member RLS), need CRUD, `claimVolunteerSlot` (member one-tap AND anonymous guest via the `claim_volunteer_slot` SECURITY DEFINER RPC; returns the cancel token), `unclaimVolunteerSlot` (own token → `cancel_volunteer_signup`), plus the anon-safe public reads `getVolunteerBoard`/`getVolunteerShiftInfo`/`cancelVolunteerByToken` (RPCs `get_volunteer_page`/`get_volunteer_signup_info` — never expose signer names to anon). Migration 011 (appended to `PASTE_ME_NEXT.sql`) adds those RPCs, the `guest_emails` outbound queue (service-role only; sent by the `send-reminders` cron via Resend — guests have no user_id so notifications can't reach them), replaces `claim_volunteer_slot` to notify the show team in-app + enqueue the guest confirmation email on guest claims (best-effort), and `claim_volunteer_signups()` — auto-links guest signups to a new account by email, called from `claimPendingInvites()` at the same sign-in/onboarding moments. Mock volunteer data on show-1 (`src/data/hub.ts`).
- **Conflict Calendar data:** actors' signup conflict ranges are stored structured in `signup_conflicts` (migration 009, in `PASTE_ME_NEXT.sql`) alongside the legacy freetext `audition_signups.conflicts` string (untouched). `signUpForAudition` now takes `conflictDates` and writes both (best-effort on the structured rows; revive-after-withdraw replaces them); `getShowConflicts(showId)` is the dual-mode read (cloud try/catch → `[]` pre-paste; mock derives from `conflictDates` on mock signups).
- **Account settings & leads (migration 012, in `PASTE_ME_NEXT.sql`):** `profiles.notification_prefs` jsonb (`{reminders, announcements, offers}`, all default true — EMAIL toggles only; in-app notifications are always created) read/written via `getNotificationPrefs`/`updateNotificationPrefs` in client.ts (cloud read try/catch → defaults pre-paste; mock = in-memory). `notifications.category` tags rows so `send-notification-email` (the single member-email egress) can skip emails per prefs: `create_notification` tags callback/cast → 'offers', `announce_to_show` → 'announcements' (both replaced in 012), `send-reminders` → 'reminders' (with a retry-without-column fallback pre-paste); untagged rows always email. `delete_my_account()` SECURITY DEFINER RPC deletes the auth.users row (cascades per 001; storage objects orphan — noted in UI copy). `resource_leads` + anon `submit_resource_lead(name, email, honeypot)` RPC backs the `/resources` email capture (RLS on, no policies — app can never read it). Casting fit heuristics for the board upgrades live in `src/lib/castingFit.ts` (conflict-day counting from `getShowConflicts`, voice-part + age-range mismatch checks).
- **Mock data:** `src/data/shows.ts` and `src/data/actors.ts`
- **State management:** TanStack Query for server state, Zustand for UI state
- **Queries:** Use `useQuery` with descriptive `queryKey` arrays
- **Mutations:** Use `useMutation` with `onSuccess` → `invalidateQueries` + toast

---

## Route Structure

### Public routes (`(public)/`) — viewable logged-OUT (auth-aware Nav, NO guard)
| Route                | Purpose                                                  | Status |
|----------------------|----------------------------------------------------------|--------|
| `/browse`            | Public open-auditions list; sign-up nudge when logged out | Built  |
| `/auditions/[id]`    | Audition detail — phase-aware; anonymous sees `browsing` phase. *(Action/people gating = #3)* | Built  |
| `/terms`, `/privacy` | Draft legal pages ("Draft — beta"); linked from signup, landing footer, auth layout | Built |
| `/theatres/[orgId]`  | Public theatre page — REPUTATION surface ("should I work here?"): hero (logo/location/est. year/productions stat + website/FB/IG/ticketing links), mission, Key People, Performance Spaces (venue + Google-Maps link + accessibility/parking), upcoming season, open auditions, photo gallery, past productions, code of conduct. Empty sections OMITTED (no visitor prompts). | Built  |
| `/volunteer/[showId]` | Public volunteer signup (mobile-first, warm) — show header + needs w/ open-slot counts (full slots shown as full, never who signed up). Signed-in users one-tap claim; anonymous guests claim with name + email (phone optional) via `claim_volunteer_slot` RPC — the APPROVED gating exception. Success state: shift details + .ics + cancel link + "create a free account" upsell. Friendly empty state if the show/RPC isn't there. | Built |
| `/volunteer/cancel/[token]` | Tokened guest cancel — no login; the token (from claim success + confirmation email) proves ownership. Confirms the shift → "Give up my spot" → `cancel_volunteer_signup` → warm goodbye. | Built |
| `/resources`          | Free printable templates (lead magnet) — 3 template cards + email capture (name+email → `resource_leads` via honeypot-checked anon `submit_resource_lead` RPC, migration 012; mock toasts without storing). Linked from landing footer + logged-out Nav. | Built |
| `/resources/audition-notice` · `/resources/casting-checklist` · `/resources/rehearsal-schedule` | Printable template pages — shared `TemplatePage` scaffold (`@/components/resources/TemplatePage`): screen chrome + "Print / Save as PDF" (`window.print()`); print CSS shows ONLY `#print-area`, black-on-white document styling (intentional hex exception to the token rule — these are paper documents, not UI). | Built |

See [[overture-access-gating]] memory for the full public-vs-gated model. The `(public)` group has NO auth guard; `(actor)` will get one in gating step #3.

### Actor routes (`(actor)/`) — gated (guard pending, step #3)
| Route              | Purpose                                                 | Status |
|--------------------|---------------------------------------------------------|--------|
| `/discover`        | Browse open auditions (radius, sort, filter, promoted) — personalized | Built  |
| `/my-shows`        | Show hub — per-show timelines, past credits             | Built  |
| `/notifications`   | Activity feed — callbacks, endorsements, kudos           | Built  |
| `/profile`         | Actor showcase — single scrolling page; editing via focused modals (see below) | Built  |
| `/offers/[id]`     | Cast offer — celebratory accept/decline with agreements  | Built  |
| `/onboarding`      | New user setup flow — forks Actor / Theatre-maker; standalone (not under actor/production nav) | Built  |
| `/settings`        | Account settings — email change (Supabase confirmation-link flow), password change (min 8 + confirm), per-category email notification toggles (reminders / announcements / offers — email only, in-app always on), sign-out-everywhere (`signOut({scope:'global'})`), danger-zone delete (type DELETE → `delete_my_account()` RPC → sign out → `/`). In the actor group but serves everyone — linked from BOTH avatar dropdowns + mobile menu. Mock: cloud-only actions toast. | Built  |

### Production routes (`(production)/`)
| Route                              | Purpose                | Status |
|------------------------------------|------------------------|--------|
| `/shows`                           | Shows list + command center — attention panel (offers awaiting > callbacks to send > auditions filling > setup incomplete), status strip on active show cards, offer tracker, "Coming up" timeline (next 5 dates) | Built  |
| `/shows/new`                       | Create a show — ONE instant screen (title/type/season/rough audition dates; city/state + locations pre-filled from `useOrg`, editable). Creates in `setup` (private draft) → redirects to the show home. *(Replaced the old 4-step wizard, Sprint D.)* | Built |
| `/shows/[showId]/setup`            | Show home — **checklist-forward** (Sprint D): a "Get this show ready" progress card leads (Show created · Add roles · Build team [optional] · Schedule auditions · Open auditions), each step done/todo with a CTA; the detailed edit sections (details/roles/schedule/team) remain below. A show sits happily in `setup` (private) until you open auditions. Audition scheduling uses **day-based generation** (pick a day + window + block length + capacity → one Generate makes all the `audition_groups`; live preview; blocks individually deletable) — no more per-block datetime entry. | Built  |
| `/shows/[showId]/auditions`        | Audition schedule      | Built  |
| `/shows/[showId]/callbacks`        | Callback management    | Built  |
| `/shows/[showId]/casting`          | Casting board — LOCKED flow + Week 4 ADDITIVE upgrades in the assign modal: conflict filter chips ("All" default = original), conflict-day counts on candidate rows, compare checkboxes (2–3) → side-by-side `CompareActorsModal`, soft vocal/age fit warnings on selection | Built  |
| `/shows/[showId]/cast-list`        | Published cast list    | Built  |
| `/shows/[showId]/conflicts`        | Conflict Calendar — rehearsal-period availability from structured signup conflicts: 0/1–2/3–4/5+ buckets, per-day heat calendar, problem dates (who's out when), filter tabs (all/shortlisted+/cast), email-3+/CSV/print actions | Built  |
| `/shows/[showId]/hub`              | Show Hub — post-casting command center, role-aware single page: personalized next-call card (.ics + "Can't make it" absence w/ undo), announcements (team compose w/ audience targeting company/cast/principals/crew/per-rehearsal, pin, "also email" flag, read receipts "read by N of M" + who-hasn't, mark-read on view), this-week + full schedule (day-grouped, who's-called chips, per-row conflict/absence counts, add/edit rehearsals w/ called-scope picker), people (cast + team + editable "who to contact" routing card), resources (`show-files` bucket, 10MB, file-type icons; cloud-only note in mock), volunteers (team adds/edits needs + "Share public signup link"; members one-tap claim/unclaim; fill state + signer names w/ guest pills). Access: production members (accepted cast + team + org admin) via `getHubAccess`; subnav "Hub" tab phase-gated to cast; actors reach it from `/my-shows` on cast shows | Built  |
| `/shows/[showId]/messages`         | Per-show communication | Planned |
| `/org`                             | Theatre hub — details (incl. founded/mission/FB/IG/ticketing), Performance Spaces, Key People, Photos (cloud-only upload), code of conduct, members + real invites (auto-accepted at invitee's next sign-in), show collaborators. Hub sections DO show empty-state prompts (unlike the public page). | Built  |
| `/org/dashboard`                   | Billing / subscription | Planned (V2) |

### Auth routes (`(auth)/`)
| Route       | Purpose            | Status |
|-------------|--------------------|--------|
| `/login`    | Real Supabase email+password sign-in (inline errors); Google button toasts until provider setup | Built |
| `/signup`   | Real email+password signup (≥8 chars, confirm field, email-confirmation state) | Built |

**Auth:** `AuthContext` is dual-mode — real Supabase sessions (signUp/signInWithPassword/signOut, restore via `getSession` + `onAuthStateChange`, profile row mapped to `User`) when `.env.local` is configured; the mock personas remain the fallback. Never use the service key — anon key only.

### Dead routes — DELETE these
- `(actor)/dashboard/page.tsx` — replaced by `/my-shows`
- `(actor)/callbacks/page.tsx` — merged into `/my-shows`
- `(actor)/offers/page.tsx` — DELETED (offer flow lives at `/offers/[id]`)

---

## Known Issues (Fix Before Building New Pages)

These are bugs and gaps in existing pages that MUST be fixed:

- [x] **Dead buttons:** Set Up Profile, Add Measurements, camera icon — wired to edit modal. Upload Photos → "Coming Soon" badge.
- [x] **ProfileEditModal data loss:** Verified — save function already sends ALL fields from ALL sections.
- [x] **Signup modal validation:** Errors now only show after user attempts to submit (hasAttemptedSubmit gate).
- [x] **Signup modal data loss:** FIXED — all five acknowledgment fields (`isMember`, `mailingList`, `referralSource`, `mediaConsent`, `commitmentAcknowledged`) persist to `audition_signups` in cloud mode (verified in-browser 2026-06-11).
- [x] **Dead link:** `/theatres/[orgId]` link removed from audition detail page (org name shown as plain text).
- [x] **Contact buttons:** Phone/email buttons now use real `tel:` and `mailto:` href attributes.
- [x] **Notifications:** Mark-as-read on click + "Mark all read" button added.
- [x] **Withdraw:** Confirmation dialog added before withdrawing from an audition.
- [x] **Profile icon:** MapPin on profile hero fixed to `text-stage-500`.
- [x] **Cache invalidation:** My Shows now invalidates `actorCallbacks` and `notifications` alongside `my-shows`.
- [x] **Media consent:** No longer required to sign up — commitmentAck is the only required checkbox.
- [x] **"Nearby" label:** Renamed to "Further Out" on Discover page.
- [x] **Dead routes:** Deleted `/dashboard`, `/callbacks`, `/offers` pages.
- [x] **Profile redesign:** Removed address + union status; added bucket list, appearance, accessibility, dealbreakers, guardian/minor fields, three-tier privacy.
- [x] **Profile history editing:** Production credits, training, and awards are now editable via focused modals (see Profile Structure).
- [x] **Route guards:** `(actor)` + `(production)` groups wrapped in `AuthGuard` → anonymous redirected to `/login?next=<path>` with deep-link return (threaded through login, signup, and onboarding).
- [x] **Sign-up wall:** Anonymous "Sign Up to Audition" routes to signup with `next`; onboarding Done CTA becomes "Pick Up Where You Left Off". SM contact gated behind login on public audition pages; public signup-count teaser added.
- [x] **Guardian consent:** Cast-offer agreements name and bind the guardian for minor accounts ("Accept as Guardian"); guardian fields editable in ProfileEditModal Private tab.
- [x] **Share/Calendar buttons:** Share uses navigator.share/clipboard; Add to Calendar downloads an .ics for the signed-up slot. Save button removed (saved-shows list is a later feature).
- [x] **Search bar placeholder:** Now reads "Search shows & theatres..." (accurate).
- [x] **Nav notification badge:** Derived from real unread notifications (was hardcoded true).
- [x] **Archive show:** Button on Setup quick actions when show is cast.
- [ ] **Availability + Invite to Audition:** `isAvailable` toggle and director-initiated audition invites deferred to Phase 2 (ships with comms layer).
- [x] **Photos:** Headshot upload (wired to hero camera button + `profiles.avatar_url`), production photo grid with captions/show tags + inline delete confirm, and private resume PDF (signed URLs) via `PhotoSection`/`ResumeSection` in `@/components/profile/PhotoSection`. Cloud-only — mock mode still shows "Coming Soon".

---

## Before You Build

1. **Read this file.**
2. **Check existing pages** for the pattern you need. Don't invent.
3. **Use the component inventory.** If a component exists, use it.
4. **Copy class strings exactly** from the Standard Patterns section.
5. **When in doubt, match the audition detail page** (`/auditions/[id]`) — it's the most thoroughly designed page.
6. **Check the Known Issues list above** — don't introduce the same bugs in new pages.
