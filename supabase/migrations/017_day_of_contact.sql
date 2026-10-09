-- ============================================================================
-- Overture 2.0 — Migration 017: editable day-of contact on shows
-- ============================================================================
-- Production-launch QA, owner-approved finding 11: the public audition page's
-- "Questions or Last-Minute Issues?" block only ever showed the stage manager
-- from the show team — there was no way to say "actually, call Jamie at this
-- number on audition day." The show setup page's Edit Details modal now has a
-- "Day-of Contact" name + phone/email pair stored on the show itself.
--
-- Display rules (unchanged privacy line): the contact renders on the public
-- audition page behind the EXISTING signed-in gating — anonymous visitors
-- never see a person. When both fields are empty, the stage manager from the
-- show team remains the fallback, exactly as before.
--
-- The app writes these columns with a retry-without-column fallback
-- (updateShow in client.ts, same pattern as open_to_ensemble), so nothing
-- breaks before this is pasted.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before new production projects are set up.
-- ============================================================================

ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS day_of_contact_name text,
  ADD COLUMN IF NOT EXISTS day_of_contact_info text;
