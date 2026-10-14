-- ============================================================================
-- Overture 2.0 — Migration 026: Hub polish wave — resource links + "Send a note"
-- ============================================================================
-- QC Master List #33 + #32 (owner-approved 2026-10-13).
--
--   1. show_files grows `url` (nullable) so Resources holds LINKS (Drive,
--      YouTube, docs) beside uploads. `storage_path` becomes nullable; a CHECK
--      enforces exactly one of (storage_path, url). Existing rows are all
--      file rows (storage_path set, url null) and pass unchanged. RLS is
--      untouched — link rows ride the same production-member read / team
--      write policies from migration 010.
--
--   2. notifications.reply_to — an email address the send-notification-email
--      Edge Function puts in the outbound Resend `reply_to`, so a recipient
--      can hit Reply and land in the sender's inbox. NULL = no reply-to
--      (every existing writer leaves it NULL; nothing changes for them).
--
--   3. send_show_note(p_show_id, p_recipient_id, p_title, p_body) —
--      SECURITY DEFINER. A production member (accepted cast + show team +
--      org owner/admin — is_production_member, migration 010) sends a short
--      note to a PRODUCTION TEAM MEMBER of the same show. v1 is team-only on
--      purpose: cast-to-cast messaging is a later roadmap item. Inserts one
--      `notifications` row (type 'system', category 'messages', reply_to =
--      the sender's own account email, looked up server-side so a client
--      can't spoof it). Email delivery rides the existing notifications →
--      send-notification-email webhook. The 'messages' category is a NEW
--      prefs key (profiles.notification_prefs.messages) — absent = true, so
--      nobody has to re-save their settings. Pre-paste the app falls back to
--      create_notification (uncategorized → always emails, no reply-to).
--
-- Prerequisites: migrations through 024 (010's show_files +
-- is_production_member, 012's notifications.category, 015's show_org_id /
-- is_org_admin). Independent of 025 (member_conflicts).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run (staging AND prod).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. show_files: links beside files
-- ----------------------------------------------------------------------------
ALTER TABLE show_files ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE show_files ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE show_files DROP CONSTRAINT IF EXISTS show_files_one_source;
ALTER TABLE show_files ADD CONSTRAINT show_files_one_source
  CHECK (
    (storage_path IS NOT NULL AND url IS NULL)
    OR (storage_path IS NULL AND url IS NOT NULL)
  );

-- Links must be web URLs — never javascript:/data: — the app validates too.
ALTER TABLE show_files DROP CONSTRAINT IF EXISTS show_files_url_http;
ALTER TABLE show_files ADD CONSTRAINT show_files_url_http
  CHECK (url IS NULL OR url ~* '^https?://');

-- ----------------------------------------------------------------------------
-- 2. notifications.reply_to — outbound email Reply-To
-- ----------------------------------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reply_to text;

-- ----------------------------------------------------------------------------
-- 3. send_show_note — production member → production team member
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_show_note(
  p_show_id uuid,
  p_recipient_id uuid,
  p_title text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_sender_email text;
  v_show_title text;
  v_id uuid;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_recipient_id = v_sender THEN
    RAISE EXCEPTION 'You can''t send a note to yourself.';
  END IF;
  IF COALESCE(btrim(p_body), '') = '' THEN
    RAISE EXCEPTION 'Write something first.';
  END IF;
  IF length(p_body) > 1000 THEN
    RAISE EXCEPTION 'Notes are limited to 1000 characters.';
  END IF;

  -- Sender must be inside the production (cast, team, or org admin).
  IF NOT is_production_member(p_show_id) THEN
    RAISE EXCEPTION 'Only members of this production can send notes.';
  END IF;

  -- v1: recipients are production TEAM members with accounts only.
  IF NOT EXISTS (
    SELECT 1 FROM show_team_members
    WHERE show_id = p_show_id AND user_id = p_recipient_id
  ) THEN
    RAISE EXCEPTION 'Notes can only be sent to the production team for now.';
  END IF;

  SELECT email INTO v_sender_email FROM profiles WHERE id = v_sender;
  SELECT title INTO v_show_title FROM shows WHERE id = p_show_id;

  INSERT INTO notifications
    (user_id, type, title, body, show_title, link_url, category, reply_to)
  VALUES (
    p_recipient_id,
    'system',
    p_title,
    p_body,
    v_show_title,
    '/shows/' || p_show_id || '/hub',
    'messages',
    v_sender_email
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_show_note(uuid, uuid, text, text) TO authenticated;
