# QC Master List — the week to "perfect" (compiled 2026-10-10)

One list to rule the hardening week. Sources: owner deep-QC batch 2 (19 items), hub walkthrough
findings (3), Fiddler population findings (2), carried infrastructure. Status moves here as work lands.

## P1 — Bugs / trust breakers (fix first)

| # | Item | Notes |
|---|---|---|
| 1 | Cast members see only themselves in Hub "People" (Cast (1)) | RLS: actors read own cast_assignments only. Migration 019: production members read accepted assignments on cast/published shows. CONFIRMED at DB level. |
| 2 | Cast members get the full production toolbar on the Hub | Non-team production members need actor-appropriate chrome: no Setup/Auditions/Casting/Offers tabs, no "My Theatre". |
| 3 | Theatre member invites never email the invitee | Owner-ordered. Build real invite emails through Resend (guest_emails queue or direct edge fn call on invite insert). Covers "hook all flows to Resend" for the invite path. |
| 4 | Resend audit — every notification-producing flow actually emails | Audit each create_notification/announce path + confirm webhook coverage; fix gaps. (Known good: offers, callbacks, announcements, reminders, guest volunteer.) |
| 5 | Share button on audition page → real shareable link | Investigate: which surface has the dead/unclear share; ensure copyable public URL everywhere. |
| 6 | Principals-targeted announcements display to everyone | Fan-out is targeted; display may not filter. Check hub read query. |
| 7 | Past-dated volunteer shifts still render claimable | File under "Past shifts" or hide; stop claims on past dates. |

## P2 — Workflow gaps (owner-felt friction, this week)

| # | Item | Notes |
|---|---|---|
| 8 | Add team members from the THEATRE page too | /org should list active shows with an add-to-team affordance (mirror of setup's team section). |
| 9 | Show setup "add team member" should suggest org members | Picker of existing org people first; email entry stays for outsiders. |
| 10 | Slide-out panel: maximize headshot (Lightbox) | Resume link already exists (July); verify + add photo zoom. |
| 11 | Dance styles → options, not free CSV | Curated multi-select chips (ballet, tap, jazz, ballroom, hip-hop, contemporary, partner/swing, none) + free-text "other". Profile edit + onboarding. |
| 12 | Supplemental casting call after callbacks/casting/cast | Real scenario ×2: need one more role cast late. Design: "Add audition block" allowed in late statuses + role-scoped mini-call; public page copy for "seeking: X only". NEEDS DESIGN PASS before build. |
| 13 | Show creation checklist order: team BEFORE roles | "Define who you have, add who you need." Reorder checklist + setup sections. |
| 14 | Volunteer needs: multiple roles per date/event | Group shifts under an event (Set build Saturday → carpentry/painters/misc). Schema addition likely (019 or 020). |
| 15 | Hub: contacts/People more prominent | Reorder sections; People/Who-to-Contact above or beside schedule. |
| 16 | Who-to-Contact edit modal is crowded | UX cleanup. |
| 17 | Rehearsal add/edit: surface conflicts | Show known cast conflicts (signup_conflicts) + existing absences for the chosen date while scheduling. |
| 18 | Declined offers vanish from history when refilled | From population run: refill forces declined→withdrawn; tracker loses the decline. Keep history (status or audit trail). |
| 19 | Post-publish offers path | Adding a cast member after publish works via API; make the UI path intentional (ties into #12). |

## P3 — Decisions needed from Chris before building

| # | Item | Question |
|---|---|---|
| 20 | Require headshot to sign up for auditions | Hard requirement (blocks signup until photo upload) or strong nudge? Minors? Phone-upload flow exists. |
| 21 | Actor profiles viewable from Hub / by castmates | No route exists today for viewing others' profiles (known gap). Who may view: team only? whole cast? Respect privacy tiers either way. |
| 22 | Favicon: purple box + gold O ("Overture-icon.png") | Need the file from Chris (or I re-create the old mark as an icon). Replaces the star favicon only — nav logos stay the star. |
| 23 | Landing page refresh | Owner wants a refresh; scope TBD — separate design conversation, not in the bug batch. |

## P4 — Parked (explicitly later)

- Postings/search beyond auditions = Staff Calls (TALENT_DISCOVERY_SPEC.md, fast-follow) — owner re-raised; first post-week item with the email digest.
- Pre-loaded shows DB (Concord/MTI) — content project.
- Supabase custom auth domain (paid) — when Stripe turns on.
- Email digest (spec'd).

## QA-data tasks (not code)

- Fresh show in `auditions_open` WITH signups so shortlist→callback flow is testable (all current staging shows are past it). Horde script exists.
- Fiddler is the fully-cast Hub specimen (done 2026-10-09). "Can't see a show hub" is RESOLVED — Fiddler, as Christopher (Director) or any qa.actor cast member.

## Carried infrastructure checklist (owner)

- [ ] Paste migrations 017+018 (clipboard) — BOTH staging and prod
- [ ] Vercel: GEOCODING_API_KEY (sensitive, no NEXT_PUBLIC) + redeploy
- [ ] Backfill geocode: staging + prod (owner terminal, service keys)
- [ ] Google key: API-restricted to Geocoding ✔ (done 2026-10-09)
