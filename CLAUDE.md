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
- **Navigation:** Responsive top nav (`Nav` component) — desktop shows centered links + avatar dropdown, mobile shows hamburger → slide-down menu. No bottom tabs.
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
| Nav           | `@/components/ui/Nav`             | Responsive top nav (desktop links + avatar dropdown, mobile hamburger) |
| PageHeader    | `@/components/ui/PageHeader`      | Production team dark header |
| SlidePanel    | `@/components/ui/SlidePanel`      | Side panel (production team actor view) |
| TeamNotesFeed | `@/components/casting/TeamNotesFeed` | Team notes display + input |
| ActorCard     | `@/components/actors/ActorCard`   | Actor in audition schedule grid |
| ShowCard      | `@/components/shows/ShowCard`     | Show in discover/shows list |
| AuditionSignupModal | `@/components/auditions/AuditionSignupModal` | Signup form modal |
| ConflictDatePicker  | `@/components/auditions/ConflictDatePicker`  | Date range conflict entry |

---

## Data Layer

- **Mock API client:** `src/lib/api/client.ts` — all data access goes through here
- **Mock data:** `src/data/shows.ts` and `src/data/actors.ts`
- **State management:** TanStack Query for server state, Zustand for UI state
- **Queries:** Use `useQuery` with descriptive `queryKey` arrays
- **Mutations:** Use `useMutation` with `onSuccess` → `invalidateQueries` + toast

---

## Route Structure

### Actor routes (`(actor)/`)
| Route              | Purpose                                                 | Status |
|--------------------|---------------------------------------------------------|--------|
| `/discover`        | Browse open auditions (radius, sort, filter, promoted)  | Built  |
| `/my-shows`        | Show hub — per-show timelines, past credits             | Built  |
| `/auditions/[id]`  | Audition detail — phase-aware (browse/signup/callback)  | Built  |
| `/notifications`   | Activity feed — callbacks, endorsements, kudos           | Built  |
| `/profile`         | Actor showcase (4 tabs: About, History, Photos, Details) | Built  |
| `/offers/[id]`     | Cast offer — celebratory accept/decline with agreements  | Built  |
| `/onboarding`      | New user setup flow (role select → profile → complete)   | Planned |

### Production routes (`(production)/`)
| Route                              | Purpose                | Status |
|------------------------------------|------------------------|--------|
| `/shows`                           | Shows list             | Built  |
| `/shows/new`                       | Create a new show      | Planned |
| `/shows/[showId]/auditions`        | Audition schedule      | Built  |
| `/shows/[showId]/callbacks`        | Callback management    | Built  |
| `/shows/[showId]/casting`          | Casting board          | Built  |
| `/shows/[showId]/cast-list`        | Published cast list    | Built  |
| `/shows/[showId]/messages`         | Per-show communication | Planned |
| `/org/dashboard`                   | Org home, billing      | Planned |

### Auth routes (`(auth)/`)
| Route       | Purpose            | Status |
|-------------|--------------------|--------|
| `/login`    | Sign in (Google/Apple via Supabase Auth) | Built (needs migration) |
| `/signup`   | Create account     | Built (needs migration) |

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
- [ ] **Signup modal data loss:** `isMember`, `mailingList`, `referralSource`, `mediaConsent`, `commitmentAcknowledged` are in SignupFormData but API function doesn't store them. Will resolve when migrating to Supabase.
- [x] **Dead link:** `/theatres/[orgId]` link removed from audition detail page (org name shown as plain text).
- [x] **Contact buttons:** Phone/email buttons now use real `tel:` and `mailto:` href attributes.
- [x] **Notifications:** Mark-as-read on click + "Mark all read" button added.
- [x] **Withdraw:** Confirmation dialog added before withdrawing from an audition.
- [x] **Profile icon:** MapPin on profile hero fixed to `text-stage-500`.
- [x] **Cache invalidation:** My Shows now invalidates `actorCallbacks` and `notifications` alongside `my-shows`.
- [x] **Media consent:** No longer required to sign up — commitmentAck is the only required checkbox.
- [x] **"Nearby" label:** Renamed to "Further Out" on Discover page.
- [x] **Dead routes:** Deleted `/dashboard`, `/callbacks`, `/offers` pages.
- [ ] **Save/Share/Calendar buttons:** Still decorative on audition detail page. Will implement with real functionality later.
- [ ] **Search bar placeholder:** Says "Search shows, theatres, roles..." but can't search roles. Update placeholder or add role search.

---

## Before You Build

1. **Read this file.**
2. **Check existing pages** for the pattern you need. Don't invent.
3. **Use the component inventory.** If a component exists, use it.
4. **Copy class strings exactly** from the Standard Patterns section.
5. **When in doubt, match the audition detail page** (`/auditions/[id]`) — it's the most thoroughly designed page.
6. **Check the Known Issues list above** — don't introduce the same bugs in new pages.
