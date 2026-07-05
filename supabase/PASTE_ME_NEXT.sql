-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PASTE_ME_NEXT — Migrations 008 + 009 (paste the whole file once)     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 008 — reminder engine log                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- Overture 2.0 — Migration 008: reminder engine log
-- ============================================================================
-- Backs the `send-reminders` scheduled Edge Function (supabase/functions/
-- send-reminders). The function scans upcoming audition slots + stale cast
-- offers and inserts notification rows; `reminder_log` is its idempotency
-- ledger — one row per (kind, subject, recipient, window) means each
-- reminder can only ever be sent once, no matter how often the cron runs.
--
-- Written/read ONLY by the Edge Function's service-role client. RLS is on
-- with no policies, so app users can't see or touch it.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What kind of reminder: 'audition_slot' | 'offer_nudge'
  -- (Week 3 adds 'rehearsal' — see the extension point in the function.)
  kind text NOT NULL,
  -- The row the reminder is about (audition_signups.id, cast_assignments.id, …)
  subject_id uuid NOT NULL,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Which reminder window fired: '24h' | '2h' | '48h' …
  "window" text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, subject_id, recipient_id, "window")
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_recipient
  ON reminder_log(recipient_id);

-- RLS on, no policies: service role (Edge Function) only.
ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 009 — structured signup conflicts (Conflict Calendar)      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

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
