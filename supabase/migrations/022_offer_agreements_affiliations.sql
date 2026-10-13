-- ============================================================================
-- Overture 2.0 — Migration 022: editable offer agreements + theatre affiliations
-- ============================================================================
-- QC master list items 25 + 24 (owner-approved 2026-10-12).
--
-- 25 · shows.offer_agreements (jsonb) — the commitments an actor checks off
--     when accepting a cast offer. An array of strings; each string's FIRST
--     LINE renders as the agreement title, the rest as its body. NULL (or
--     empty) means "use Overture's defaults" — the exact copy that was
--     hard-coded in the offer page until now — so every existing show keeps
--     behaving identically. Edited from the show setup page ("Offer
--     Agreements" card); the app writes the column with a retry-without-column
--     fallback (updateShow), so saves never fail before this is pasted.
--
-- 24 · orgs.affiliations (text[]) — organizations the theatre belongs to
--     (EMACT, AACT, NETC, or anything typed free-form). Edited in the org
--     page's Edit Theatre modal (chip input); displayed as badges near the
--     public theatre page hero. Same retry-without-column fallback (updateOrg).
--
-- No RLS changes: both columns ride their tables' existing policies
-- (shows are publicly readable past setup; orgs are publicly readable;
-- writes stay owner/team-gated exactly as before).
--
-- Item 21 (viewable actor profiles) needs NO DDL — profiles, actor_details,
-- training, awards, production_credits, endorsements, bucket_list_shows and
-- profile_photos are already SELECT-able by all authenticated users (002/003/
-- storage_setup), which is exactly the public-tier read the new /actors/[id]
-- page performs. Measurements/contact stay gated and are never rendered there.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run (staging AND prod).

ALTER TABLE shows ADD COLUMN IF NOT EXISTS offer_agreements jsonb;

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS affiliations text[] NOT NULL DEFAULT '{}';
