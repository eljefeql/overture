-- ============================================================================
-- Overture 2.0 — Migration 025: "My conflicts" on the Show Hub
-- ============================================================================
-- Owner finding (2026-10-13): cast members could record schedule conflicts
-- ONLY at audition signup (signup_conflicts, migration 009). After casting
-- the hub offered just "Can't make it" on the next call, and already-cast
-- (precast, migration 024) shows had NO conflicts on record at all — their
-- cast never auditioned.
--
-- This table lets ANY production member (accepted cast + show team) record
-- date ranges they can't rehearse, directly on the hub. The app UNIONS these
-- with signup_conflicts everywhere the team already sees conflicts (hub
-- per-row counts, the Conflict Calendar, casting-board fit chips, and the
-- new "N people have conflicts that day" line in the add/edit rehearsal
-- modal — QC #17).
--
-- Privacy: a member sees and manages ONLY their own rows; show managers
-- (team OR org owner/admin — is_show_manager, migration 015) can read every
-- row for their show. Production members do NOT see each other's conflicts
-- (only the team needs them).
--
-- Prerequisites: migrations through 024 (015's is_show_manager, 010's
-- is_production_member).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_member_conflicts_show_user
  ON member_conflicts(show_id, user_id);

ALTER TABLE member_conflicts ENABLE ROW LEVEL SECURITY;

-- Members manage their own rows. The INSERT check also requires production
-- membership of the show so a stray account can't attach rows to a show it
-- isn't part of.
DROP POLICY IF EXISTS "member_conflicts_own_select" ON member_conflicts;
CREATE POLICY "member_conflicts_own_select" ON member_conflicts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "member_conflicts_own_insert" ON member_conflicts;
CREATE POLICY "member_conflicts_own_insert" ON member_conflicts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_production_member(show_id));

DROP POLICY IF EXISTS "member_conflicts_own_update" ON member_conflicts;
CREATE POLICY "member_conflicts_own_update" ON member_conflicts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "member_conflicts_own_delete" ON member_conflicts;
CREATE POLICY "member_conflicts_own_delete" ON member_conflicts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Show managers (team + org owner/admin) read every row for their show —
-- this is what feeds the Conflict Calendar and the scheduling warnings.
DROP POLICY IF EXISTS "member_conflicts_manager_select" ON member_conflicts;
CREATE POLICY "member_conflicts_manager_select" ON member_conflicts
  FOR SELECT TO authenticated
  USING (is_show_manager(show_id));

-- NOTE: no change to signup_conflicts is needed — migration 009 already lets
-- an actor DELETE the rows hanging off their own signup, which is how
-- "Remove" works on audition-origin ranges from the hub card.
