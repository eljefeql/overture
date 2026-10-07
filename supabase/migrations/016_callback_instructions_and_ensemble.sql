-- ============================================================================
-- Overture 2.0 — Migration 016: ensemble willingness at signup
--                               (+ callback-instructions note, no DDL needed)
-- ============================================================================
-- Director QA round, two owner-approved findings:
--
-- 1. ENSEMBLE WILLINGNESS (finding 8): actors acknowledge at audition signup
--    whether they'd happily accept an ensemble/smaller role in THIS show —
--    per-show, never a standing profile flag ("there are shows I'd gladly be
--    in the ensemble for, and there are shows I'd just want a good part").
--    New column below; the signup modal collects it, the casting board's
--    assign modal shows an "Open to ensemble" chip. The app writes it with a
--    retry-without-column fallback, so nothing breaks before this is pasted.
--
-- 2. SHARED CALLBACK INSTRUCTIONS (finding 5): one instructions box for the
--    whole callback session replaces per-callback prep-note ENTRY ("entering
--    the same thing for 60 callbacks would make SMs cringe"). This reuses the
--    EXISTING shows.callback_notes column (migration 001) — the callbacks
--    page now edits it directly and actors already see it on their callback
--    surfaces, so NO schema change is needed. callbacks.prep_notes is kept
--    (never dropped): legacy per-callback notes still display if present.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

ALTER TABLE public.audition_signups
  ADD COLUMN IF NOT EXISTS open_to_ensemble boolean NOT NULL DEFAULT false;
