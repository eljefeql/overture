-- ============================================================================
-- Overture 2.0 — Migration 018: geocoding coordinates
-- ============================================================================
-- Sprint D Phase 4: real distances on Discover/browse. Adds latitude /
-- longitude columns to the three places a location lives:
--
--   profiles  — the actor's home city/state (profiles.location_city/state)
--   orgs      — the theatre's city/state
--   venues    — individual spaces (free-text address)
--
-- No PostGIS: at beta scale distance is computed client-side with a
-- haversine (src/lib/utils.ts → haversineMiles). Coordinates are written
-- best-effort at save time via /api/geocode (Google Geocoding, server-only
-- key) and backfilled with scripts/backfill-geocode.mjs (owner-run,
-- service-role key passed explicitly on the command line).
--
-- The app writes these columns with a retry-without-column fallback (the
-- open_to_ensemble pattern in client.ts), so nothing breaks before this is
-- pasted; reads degrade to null coordinates (= no distance shown).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before new production projects are set up.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
