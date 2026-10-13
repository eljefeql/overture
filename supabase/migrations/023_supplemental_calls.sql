-- ============================================================================
-- Overture 2.0 — Migration 023: Supplemental casting calls
-- ============================================================================
-- SUPPLEMENTAL_AND_PRECAST_SPEC.md, Feature 1 (QC item 12) — wave 1.
--
-- A supplemental casting call is a role-scoped mini-audition for a show past
-- auditions_closed (callbacks/casting/cast/archived). It rides the EXISTING
-- audition_groups + audition_signups machinery — a call is simply one or more
-- audition_groups rows flagged `supplemental`, targeting specific roles:
--
--   supplemental            — marks the block as part of a casting call
--   target_role_ids         — the role(s) the call is seeking (uuid[] into
--                             show_roles; roles are removed as they fill)
--   supplemental_note       — optional public note ("seeking a strong tenor")
--   supplemental_closed_at  — null = the call is OPEN (public page reframes,
--                             show reappears on Browse/Discover); set = closed
--
-- Because these are plain audition_groups columns, everything downstream is
-- automatic: signups land in audition_signups and show on the auditions board,
-- the send-reminders cron's T-24h/T-2h audition scan picks the blocks up with
-- no changes, and the existing RLS carries over (anon can read groups of
-- non-setup shows per 003; only the show team can insert/update).
--
-- AUTO-CLOSE: when a targeted (non-ensemble) role gains an ACCEPTED primary
-- assignment, the trigger below removes that role from every open call's
-- target list, and closes the call when no sought roles remain. SECURITY
-- DEFINER because the acceptance is written by the ACTOR, whose RLS cannot
-- update audition_groups. Ensemble/featured_ensemble roles never auto-close —
-- an ensemble pot can always take more members (manual close only).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run (staging AND prod).

ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS supplemental boolean NOT NULL DEFAULT false;
ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS target_role_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS supplemental_note text;
ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS supplemental_closed_at timestamptz;

-- Fast lookup of shows with an open call (Browse/Discover reappearance).
CREATE INDEX IF NOT EXISTS idx_audition_groups_open_supplemental
  ON audition_groups (show_id)
  WHERE supplemental AND supplemental_closed_at IS NULL;

-- ── Auto-close on offer acceptance ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_supplemental_calls_on_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only an accepted PRIMARY assignment fills a role; understudies/alternates
  -- don't. Ensemble-type roles are pots — they never auto-close a call.
  IF NEW.status = 'accepted'
     AND NEW.assignment_type = 'primary'
     AND NOT EXISTS (
       SELECT 1 FROM show_roles r
       WHERE r.id = NEW.role_id
         AND r.role_type IN ('ensemble', 'featured_ensemble')
     )
  THEN
    UPDATE audition_groups g
    SET target_role_ids = array_remove(g.target_role_ids, NEW.role_id),
        supplemental_closed_at = CASE
          WHEN array_remove(g.target_role_ids, NEW.role_id) = '{}'::uuid[]
            THEN now()
          ELSE g.supplemental_closed_at
        END
    WHERE g.show_id = NEW.show_id
      AND g.supplemental
      AND g.supplemental_closed_at IS NULL
      AND NEW.role_id = ANY (g.target_role_ids);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_supplemental_calls ON cast_assignments;
CREATE TRIGGER trg_close_supplemental_calls
  AFTER INSERT OR UPDATE OF status ON cast_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.close_supplemental_calls_on_acceptance();
