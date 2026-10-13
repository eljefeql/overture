# QC Master List — the week to "perfect" (compiled 2026-10-10, batch 3 added 2026-10-12)

One list to rule the hardening week. Sources: owner deep-QC batch 2 (19 items), hub walkthrough
findings (3), Fiddler population findings (2), carried infrastructure. Status moves here as work lands.

## P1 — Bugs / trust breakers (fix first)

| # | Item | Notes |
|---|---|---|
| 1 | Cast members see only themselves in Hub "People" (Cast (1)) | **BUILT 2026-10-12, needs migration 019 paste.** New additive SELECT policy on cast_assignments: production members read ACCEPTED rows on shows with status cast/archived (the honest publish signal — publishCastList flips status). Pre-paste degrades exactly as today. |
| 2 | Cast members get the full production toolbar on the Hub | **FIXED 2026-10-12 (live-verified).** (production) layout: on hub routes, a getShowAccess chrome check (both modes) renders the actor `Nav` for hub-only viewers, production chrome for team/org admins; no chrome until the check resolves (no toolbar flash). |
| 3 | Theatre member invites never email the invitee | Owner-ordered. Build real invite emails through Resend (guest_emails queue or direct edge fn call on invite insert). Covers "hook all flows to Resend" for the invite path. |
| 4 | Resend audit — every notification-producing flow actually emails | Audit each create_notification/announce path + confirm webhook coverage; fix gaps. (Known good: offers, callbacks, announcements, reminders, guest volunteer.) |
| 5 | Share button on audition page → real shareable link | Investigate: which surface has the dead/unclear share; ensure copyable public URL everywhere. |
| 6 | Principals-targeted announcements display to everyone | **FIXED 2026-10-12 (live-verified app-side; RLS half in 019).** getHubData filters announcements for non-managers by the same audience resolution as the fan-out; migration 019 adds is_announcement_recipient() + replaces announcements_member_read so the DB agrees. Managers keep seeing all with labels + receipts. |
| 7 | Past-dated volunteer shifts still render claimable | **FIXED 2026-10-12 (live-verified app-side; RPC half in 019).** Hub board: past shifts collapsed under "Past shifts (N)", never claimable; public /volunteer page hides them entirely; mock claim + migration 019's claim_volunteer_slot both reject past-shift claims. |

## P2 — Workflow gaps (owner-felt friction, this week)

| # | Item | Notes |
|---|---|---|
| 8 | Add team members from the THEATRE page too | /org should list active shows with an add-to-team affordance (mirror of setup's team section). |
| 9 | Show setup "add team member" should suggest org members | Picker of existing org people first; email entry stays for outsiders. |
| 10 | Slide-out panel: maximize headshot (Lightbox) | ✅ 2026-10-13 — slide-panel headshot opens Lightbox (+gallery); resume link intact. Resume link already exists (July); verify + add photo zoom. |
| 11 | Dance styles → options, not free CSV | ✅ 2026-10-13 — DanceStylesField chips + Other, profile edit + onboarding. Curated multi-select chips (ballet, tap, jazz, ballroom, hip-hop, contemporary, partner/swing, none) + free-text "other". Profile edit + onboarding. |
| 12 | Supplemental casting call after callbacks/casting/cast | Real scenario ×2: need one more role cast late. Design: "Add audition block" allowed in late statuses + role-scoped mini-call; public page copy for "seeking: X only". NEEDS DESIGN PASS before build. |
| 13 | Show creation checklist order: team BEFORE roles | "Define who you have, add who you need." Reorder checklist + setup sections. |
| 14 | Volunteer needs: multiple roles per date/event | Group shifts under an event (Set build Saturday → carpentry/painters/misc). Schema addition likely (019 or 020). |
| 15 | Hub: contacts/People more prominent | Reorder sections; People/Who-to-Contact above or beside schedule. |
| 16 | Who-to-Contact edit modal is crowded | UX cleanup. |
| 17 | Rehearsal add/edit: surface conflicts | Show known cast conflicts (signup_conflicts) + existing absences for the chosen date while scheduling. |
| 18 | Declined offers vanish from history when refilled | From population run: refill forces declined→withdrawn; tracker loses the decline. Keep history (status or audit trail). |
| 19 | Post-publish offers path | Adding a cast member after publish works via API; make the UI path intentional (ties into #12). |
| 24 | Theatre affiliations (EMACT, AACT…) | ✅ 2026-10-13 — orgs.affiliations (mig 022), chips + public badges. Chips on org edit + public theatre page. Small; text/multi-select, no directory integration needed. |
| 25 | Editable offer agreements | ✅ 2026-10-13 — shows.offer_agreements (mig 022), setup card + dynamic acceptance checklist. The terms an actor agrees to when accepting a role are currently fixed copy in the offer flow — make them show-level editable (setup section, sensible defaults preserved) so each theatre/director sets their own. |
| 26 | Duplicate-theatre protection (minimal) | ✅ 2026-10-13 — findSimilarOrgs + onboarding warning card w/ Create anyway. At maker onboarding: name-similarity check → "A theatre named X already exists in CityName — is it yours?" with a request-to-join nudge instead of silent duplicate creation. Full claim flow stays parked (P4). |
| 27 | **Modular adoption: "Have you already cast this show?"** | At show creation, ask which parts they want: team recruiting / casting / hub only. Already-cast shows skip auditions entirely: director bulk-adds cast members (name+email, invite rides the new invite-email pipeline) straight into the Hub. STRATEGIC — the churn-killer for theatres scared of switching mid-season. NEEDS DESIGN PASS first (pairs with #12 supplemental calls). |
| 28 | Platform admin, minimal slice | ✅ 2026-10-13 — /admin built (directory, dupe badges, edit/archive/delete/remove/reset actions, mig 021). `platform_admin` flag on Chris's account → /admin: read-only directory of all theatres/users/shows, dupe spotting. Password resets: already available in the Supabase dashboard today (Auth → user → ⋯ → Send password recovery) — document, don't rebuild. Merge tools are P4. |

## P3 — Decisions (ANSWERED 2026-10-12 → build in P2 wave)

| # | Item | Decision |
|---|---|---|
| 20 | Headshot at audition signup | HARD NUDGE, not a block: "you'll need this to get cast"-grade prompt in the signup flow when no headshot exists, with inline upload; signup still possible without. |
| 21 | Actor profiles viewable by others | Build the missing view-someone's-profile page at PUBLIC tier only: photo, vitals/stats, past shows/credits, skills — NO contact info, NO measurements/sizing, NO location, nothing private/hidden. Any signed-in user may view (gating model: authenticated, never anon). Link from Hub people lists + casting surfaces. |
| 22 | Favicon | ✔ DONE 2026-10-12 — owner-supplied flattened purple-box star icon installed as src/app/icon.png; nav logos keep the transparent mark. |
| 23 | Landing page refresh | Own session with research & recommendations, after the hardening week. |

## P4 — Parked (explicitly later)

- Postings/search beyond auditions = Staff Calls (TALENT_DISCOVERY_SPEC.md, fast-follow) — owner re-raised; first post-week item with the email digest.
- **Pre-loaded US community theatre directory** — major initiative, owner-raised 2026-10-12: discover + pre-load theatres as unclaimed pages. Phase 1 wedge: EMACT member directory (~100 Massachusetts theatres — the Boston supply play), then AACT. Depends on the claim flow. Pairs with #26.
- Full duplicate-theatre claim/request-to-join flow (Sprint D Phase 3).
- Full god-mode admin: merge duplicate theatres/actors, cross-org edits, impersonation. (Minimal read slice is #28.)
- Pre-loaded shows DB (Concord/MTI) — content project.
- Supabase custom auth domain (paid) — when Stripe turns on.
- Email digest (spec'd).

## New candidates (found during P1, untriaged)

- Cast-list page Share button copies the TEAM-GATED production URL — recipients without access hit a lock screen. Should share the public cast list (or be removed until one exists).
- Director muting "Offers" emails also mutes actor-response notifications to them (same category). Defensible; revisit if directors complain.

## QA-data tasks (not code)

- Fresh show in `auditions_open` WITH signups so shortlist→callback flow is testable (all current staging shows are past it). Horde script exists.
- Fiddler is the fully-cast Hub specimen (done 2026-10-09). "Can't see a show hub" is RESOLVED — Fiddler, as Christopher (Director) or any qa.actor cast member.
- **Demo/tutorial theatre** (owner, 2026-10-12): a polished fake theatre + people + shows for recording tutorials. Recommend building it on STAGING (zero prod pollution, QA accounts already exist to populate it); record against localhost/staging. If tutorials must show the prod URL, revisit with a clearly-named demo org we can wipe.

## Carried infrastructure checklist (owner)

- [ ] Paste migrations 017+018 (clipboard) — BOTH staging and prod
- [ ] Vercel: GEOCODING_API_KEY (sensitive, no NEXT_PUBLIC) + redeploy
- [ ] Backfill geocode: staging + prod (owner terminal, service keys)
- [ ] Google key: API-restricted to Geocoding ✔ (done 2026-10-09)
