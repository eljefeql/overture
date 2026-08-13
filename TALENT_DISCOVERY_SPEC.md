# Talent Discovery Engine — Re-scoped (2026-08-13)

**Trigger:** competitive audit of Your Theater 411 (yourtheater411.com). Their "Calls for Production Staff"
category had 11 live Boston-area listings recruiting roles our structured model can't represent yet.
North star unchanged: talent discovery for ALL creative roles ([[overture-crew-talent-model]]).

## What the market is actually recruiting (observed 2026-08, Boston 40mi)

From YT411's live staff calls: Choreographer · Pianist/Musical Director · Stage Manager · Costumer ·
Wardrobe Assistant · **Musicians (pit)** · Production Assistant · **Lighting Designer** (×2) ·
Playwrights · "Various positions".

## Gap analysis vs our current model

Our `TeamRole` enum (show leadership): `director, music_director, choreographer, stage_manager,
producer, asst_director, asst_stage_manager, accompanist`.

| Market demand | Our coverage today |
|---|---|
| Choreographer, MD/pianist, SM | ✅ TeamRole |
| **Designers** (lighting, costume, set, sound, props, hair/makeup) | ❌ nothing structured |
| **Pit musicians** (instrument-specific) | ❌ nothing |
| **Technical/run crew** (wardrobe asst., production asst., board ops, run crew) | ❌ free-text crew credits only |
| Playwrights / new-works | ❌ out of scope for now (note only) |

Conclusion: our taxonomy covers the *leadership table* but not the *design/tech/music bench* — which is
exactly the part community theatres are desperate for (volunteer SMs and designers are chronically scarce).

## Re-scoped taxonomy: `CreativeRole` categories

A single role vocabulary used by staff calls, crew credits, and (later) discovery search.
Structured category + specific position + optional free-text detail (e.g. instrument).

1. **Direction** — director, asst. director, intimacy/fight choreographer, dialect coach
2. **Music** — music director, accompanist/rehearsal pianist, **pit musician (+ instrument detail)**, vocal captain
3. **Movement** — choreographer, asst. choreographer, dance captain
4. **Stage management** — SM, ASM, production assistant
5. **Design** — set, lighting, sound, costume, props, hair/makeup, projections
6. **Technical / run crew** — master carpenter, electrician, board op (light/sound), run crew, wardrobe, fly
7. **Production / admin** — producer, house manager, marketing/graphics, photographer/videographer
8. **Other** — free text (the "Various positions" catch-all; never block a real need)

`TeamRole` (permissions enum) stays as-is — it governs who can DO things on a show.
`CreativeRole` is the discovery/credit vocabulary layered next to it. No migration of existing data.

## Feature: Staff Calls ("Help Wanted" for shows)

The YT411 category we're taking, done our way — same pattern as the volunteer dual-path:

- **Team side:** on the show (setup or hub), post open positions: CreativeRole + description +
  paid/volunteer/stipend + fill-by date. Managed like volunteer needs.
- **Public side:** staff calls appear on the public audition page, on `/browse` (new "Crew & Staff" filter),
  and on the public theatre page. SEO pages like auditions get.
- **Respond:** signed-in users one-tap "I'm interested" (+ optional note) → team sees responders with their
  profile (crew credits front and center). Same access-gating model as everything else — anon can SEE calls,
  responding requires an account. No guest exception here (unlike volunteers): these are skilled roles where
  the profile IS the pitch.
- **Close the loop:** filling a position through Overture creates a **verified crew credit** — the
  discovery-flywheel hook no bulletin board can copy.
- **Digest inclusion:** staff calls ride the same email digest as auditions (below).

## Feature: Audition & Staff-Call Email Digest

YT411's stickiest feature, upgraded:
- Weekly (default) or daily opt-in email: new auditions + staff calls within the actor's radius.
- Runs on the existing `send-reminders` cron + Resend pipeline + `notification_prefs` (new `digest` category,
  default weekly for actors; managed in `/settings`).
- Sections: New auditions near you · Crew & staff calls · Closing soon. Plain, warm, one-click through.
- V1 radius = same approximate city/state logic Discover uses today (real geocoding is a fast-follow).

## Profile alignment (small)

- Crew-credit position field gets suggestions from the CreativeRole taxonomy (stays free-text underneath).
- Later (with discovery search): "open to crew work" flag + positions-I-do list on the profile.

## Sequencing

Both features are **post-beta fast-follows** — they need real theatres posting real needs to matter.
Priority within fast-follow: digest first (retention for the users we get at launch), staff calls second
(supply-side differentiation), discovery search for crew third (needs profile density).
