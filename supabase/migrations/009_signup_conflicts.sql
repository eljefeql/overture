-- ============================================================================
-- Overture 2.0 — Migration 009: structured signup conflicts
-- ============================================================================
-- Backs the Conflict Calendar (/shows/[showId]/conflicts). Actors already
-- enter scheduling conflicts as date RANGES in the audition signup modal;
-- until now those ranges were flattened into the freetext
-- `audition_signups.conflicts` string and the structure was lost. This table
-- keeps each range as real dates so the director's conflict calendar can
-- count unavailable people per day, bucket auditionees by conflict load,
-- and surface problem dates.
--
-- The freetext `conflicts` column is left untouched (display back-compat).
-- Rows are written by the actor at signup; on withdraw + re-signup the old
-- rows are replaced. RLS mirrors audition_signups: the actor owns their own
-- rows (via their signup), the show team can read them for their show.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

CREATE TABLE IF NOT EXISTS signup_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id uuid NOT NULL REFERENCES audition_signups(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_signup_conflicts_signup
  ON signup_conflicts(signup_id);

ALTER TABLE signup_conflicts ENABLE ROW LEVEL SECURITY;

-- Actors own the conflict rows hanging off their own signup.
DROP POLICY IF EXISTS "Actors can read own signup conflicts" ON signup_conflicts;
CREATE POLICY "Actors can read own signup conflicts"
  ON signup_conflicts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND s.actor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Actors can add conflicts to own signup" ON signup_conflicts;
CREATE POLICY "Actors can add conflicts to own signup"
  ON signup_conflicts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND s.actor_id = auth.uid()
    )
  );

-- Delete is needed for the withdraw → re-signup revive path (old ranges are
-- replaced with the fresh ones from the new signup form).
DROP POLICY IF EXISTS "Actors can delete own signup conflicts" ON signup_conflicts;
CREATE POLICY "Actors can delete own signup conflicts"
  ON signup_conflicts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND s.actor_id = auth.uid()
    )
  );

-- Show team reads conflicts for their show (mirrors
-- "Show team can see signups for their show" on audition_signups).
DROP POLICY IF EXISTS "Show team can read conflicts for their show" ON signup_conflicts;
CREATE POLICY "Show team can read conflicts for their show"
  ON signup_conflicts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND is_show_team(s.show_id)
    )
  );
