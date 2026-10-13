# Supplemental Casting Calls + Already-Cast Shows — approved spec (2026-10-13)

Owner decisions locked this session. QC items #12 and #27.

## Feature 1 — Supplemental casting call

A role-scoped mini-audition for shows past `auditions_closed` (callbacks/casting/cast/archived).
Show status NEVER moves backward; calls are orthogonal to the status machine.

- **Entry points (decided):** per-role "Open a casting call" on the Casting board (unfilled or
  vacated roles, any late status) + a "Need to recast a role?" card on show home for late-stage
  shows. Deliberately NOT on the Hub.
- **Opening a call:** pick role(s) + audition day/blocks (reuse the day-based generator) +
  optional public note ("seeking a strong tenor"). Data: `audition_groups.supplemental boolean`
  + `audition_groups.target_role_ids uuid[]` (migration 023) — or a `casting_calls` table if
  cleaner; implementer's judgment, idempotent + pre-paste-degradable either way.
- **Public audition page:** when a show is past auditions but has open supplemental blocks, the
  page reframes: "Now casting: {roles}" — only sought roles listed, signup restricted to
  supplemental blocks, roles-interested constrained to target roles. Cast list/dates unchanged.
- **Browse/Discover (decided: YES, visible):** show reappears while a call is open, badged
  "Seeking: {role}".
- **Team side:** signups land on the normal auditions board (clearly badged/filterable to the
  call); shortlist → callback → offer unchanged; filling the role closes the call (manual close
  too). Post-publish offers (QC #19) become the intentional final step.

## Feature 2 — Already-cast shows (modular adoption)

One question on the EXISTING instant create screen (no new wizard):
"Where is this production right now?" → "We'll audition through Overture" (default) /
"We've already cast it — we just want the Show Hub". Stored e.g. `shows.precast boolean`
(migration 024).

- **Checklist reorders** for precast shows: Add your cast → Build your team → Hub live. No
  audition scheduling steps. Subnav shows only used modules (Hub, Cast List, People…) —
  **EXCEPT (decided): the Casting board stays reachable** for flexibility; the supplemental-call
  card is how a precast show later recruits (unifies the two features).
- **Bulk add cast:** rows of role + name + email; roles created on the fly (no separate role
  setup). Assignments are director-confirmed (status accepted, no offer dance — it's their
  existing cast; flag `added_directly` for honesty in history).
- **Invitation emails (decided): batch behind a "Review & send invitations" confirm button** —
  never auto-fire on row save (typo protection). Email: warm "You've been added to the cast of
  {show} at {theatre} — create your free account to see your schedule" via the guest_emails
  queue; signing up with that email auto-links into the cast (mirror claim_org_invites /
  claim_volunteer_signups patterns — claim_cast_assignments by email).
- **Hub people list** shows invited vs joined so the SM can nudge stragglers. Un-joined members
  simply aren't reachable by announcements yet (honest copy).
- Show status for precast shows: lands in `cast` once the cast is added + published (reuse
  publish semantics; implementer verifies the cleanest path — possibly create in `setup`,
  "publish cast" flips to `cast` exactly as today).

## Build order
Wave 1: supplemental calls (migration 023). Wave 2: already-cast flow (migration 024) — runs
after wave 1 lands because both touch the show home/setup page.
