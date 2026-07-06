-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PASTE_ME_NEXT — Migration 014 only (008–013 already applied)          ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- Paste this whole file once in Supabase Dashboard → SQL Editor → Run.

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 014 — keep the invitee's name on org invites                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- The invite modal on /org already asks for a name, but org_invites had no
-- column for it — pending rows fell back to the email prefix ("chris" for
-- chris@example.com). This stores what the inviter typed so the members list
-- shows a real name while the invite is pending. Display-only; acceptance
-- still keys off the email, and the invitee's own profile name wins once
-- they join.
--
-- Idempotent — safe to paste more than once.

ALTER TABLE public.org_invites
  ADD COLUMN IF NOT EXISTS invited_name text;
