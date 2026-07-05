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
