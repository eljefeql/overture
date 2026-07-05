-- ============================================================================
-- Overture 2.0 — Migration 012: account settings + resources lead capture
-- ============================================================================
-- Backs the Week 4 batch:
--   1. profiles.notification_prefs — per-category EMAIL toggles (jsonb).
--      Categories: reminders | announcements | offers. In-app notifications
--      are ALWAYS created; prefs only gate email delivery.
--   2. notifications.category — lets the send-notification-email Edge
--      Function know which pref gates a given email. Writers:
--        · send-reminders tags its rows 'reminders'
--        · announce_to_show (replaced below) tags 'announcements'
--        · create_notification (replaced below) tags callback/cast → 'offers'
--      NULL category = uncategorized → always emailed (safe default).
--   3. delete_my_account() — SECURITY DEFINER self-deletion. Removes the
--      auth.users row; profiles (and everything referencing it) cascades
--      per migrations 001+.
--   4. resource_leads — the /resources email-capture list. Anonymous
--      INSERT-only via the submit_resource_lead() RPC (honeypot-checked),
--      same pattern as the volunteer guest RPCs. Nobody can read it from
--      the app (service role / dashboard only).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.notification_prefs — per-category email toggles
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL
  DEFAULT '{"reminders": true, "announcements": true, "offers": true}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. notifications.category — email-gating hint for the pipeline
-- ----------------------------------------------------------------------------
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category text;

-- ----------------------------------------------------------------------------
-- 2a. create_notification — same behavior as migration 006, plus: tag
--     callback/cast notifications with category 'offers' so the email
--     pipeline can honor the "Offers & callbacks" pref.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id uuid,
  p_show_id uuid,
  p_type notification_type,
  p_title text,
  p_body text,
  p_show_title text DEFAULT NULL,
  p_link_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_id uuid;
  v_sender_is_team boolean;
  v_recipient_is_team boolean;
  v_recipient_involved boolean;
  v_sender_involved boolean;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM show_team_members
    WHERE show_id = p_show_id AND user_id = v_sender
  ) INTO v_sender_is_team;

  SELECT EXISTS (
    SELECT 1 FROM show_team_members
    WHERE show_id = p_show_id AND user_id = p_recipient_id
  ) INTO v_recipient_is_team;

  SELECT EXISTS (
    SELECT 1 FROM audition_signups WHERE show_id = p_show_id AND actor_id = p_recipient_id
    UNION ALL
    SELECT 1 FROM callbacks WHERE show_id = p_show_id AND actor_id = p_recipient_id
    UNION ALL
    SELECT 1 FROM cast_assignments WHERE show_id = p_show_id AND actor_id = p_recipient_id
  ) INTO v_recipient_involved;

  SELECT EXISTS (
    SELECT 1 FROM audition_signups WHERE show_id = p_show_id AND actor_id = v_sender
    UNION ALL
    SELECT 1 FROM callbacks WHERE show_id = p_show_id AND actor_id = v_sender
    UNION ALL
    SELECT 1 FROM cast_assignments WHERE show_id = p_show_id AND actor_id = v_sender
  ) INTO v_sender_involved;

  -- Team member notifying an actor involved in their show,
  -- an actor notifying a team member of a show they're involved in,
  -- a team member notifying a teammate on the same show,
  -- or an org admin of the show's org notifying a team member.
  IF NOT (
    (v_sender_is_team AND v_recipient_involved)
    OR (v_recipient_is_team AND v_sender_involved)
    OR (v_sender_is_team AND v_recipient_is_team)
    OR (v_recipient_is_team AND is_org_admin(show_org_id(p_show_id)))
  ) THEN
    RAISE EXCEPTION 'Not allowed to notify this user';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, show_title, link_url, category)
  VALUES (
    p_recipient_id, p_type, p_title, p_body, p_show_title, p_link_url,
    CASE WHEN p_type IN ('callback', 'cast') THEN 'offers' ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, notification_type, text, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2b. announce_to_show — same fan-out as migration 010, plus: tag the
--     notifications with category 'announcements' so the email pipeline
--     can honor the "Announcements" pref.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announce_to_show(
  p_announcement_id uuid,
  p_title text,
  p_body text,
  p_show_title text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_show_id uuid;
  v_audience text;
  v_rehearsal_id uuid;
  v_scope text;
  v_group text;
  v_count integer := 0;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT show_id, audience, rehearsal_id
    INTO v_show_id, v_audience, v_rehearsal_id
    FROM announcements WHERE id = p_announcement_id;
  IF v_show_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;
  IF NOT is_show_team(v_show_id) THEN
    RAISE EXCEPTION 'Only the show team can post announcements';
  END IF;

  -- "everyone called to [rehearsal]" resolves through the rehearsal's call.
  IF v_audience = 'rehearsal' AND v_rehearsal_id IS NOT NULL THEN
    SELECT called_scope, group_key INTO v_scope, v_group
      FROM rehearsal_calls WHERE rehearsal_id = v_rehearsal_id;
    v_scope := COALESCE(v_scope, 'everyone');
    IF v_scope = 'everyone' THEN v_audience := 'company';
    ELSIF v_scope = 'group' THEN v_audience := COALESCE(v_group, 'company');
    ELSE v_audience := 'rehearsal_custom';
    END IF;
  ELSIF v_audience = 'rehearsal' THEN
    v_audience := 'company';
  END IF;

  WITH accepted_cast AS (
    SELECT ca.actor_id AS user_id, sr.role_type
    FROM cast_assignments ca
    JOIN show_roles sr ON sr.id = ca.role_id
    WHERE ca.show_id = v_show_id AND ca.status = 'accepted'
  ),
  team AS (
    SELECT user_id FROM show_team_members
    WHERE show_id = v_show_id AND user_id IS NOT NULL
  ),
  recipients AS (
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM accepted_cast
        WHERE v_audience IN ('company', 'cast')
      UNION ALL
      SELECT user_id FROM accepted_cast
        WHERE v_audience = 'principals' AND role_type IN ('lead', 'supporting')
      UNION ALL
      SELECT user_id FROM accepted_cast
        WHERE v_audience = 'ensemble' AND role_type NOT IN ('lead', 'supporting')
      UNION ALL
      SELECT user_id FROM team
        WHERE v_audience IN ('company', 'crew')
      UNION ALL
      SELECT user_id FROM rehearsal_call_people
        WHERE v_audience = 'rehearsal_custom' AND rehearsal_id = v_rehearsal_id
    ) u
    WHERE user_id IS NOT NULL AND user_id <> v_sender
  ),
  inserted AS (
    INSERT INTO notifications (user_id, type, title, body, show_title, link_url, category)
    SELECT user_id, 'system', p_title, p_body, p_show_title,
           '/shows/' || v_show_id || '/hub', 'announcements'
    FROM recipients
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.announce_to_show(uuid, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. delete_my_account — self-service account deletion
--    Deleting the auth.users row cascades to profiles (001: profiles.id
--    REFERENCES auth.users ON DELETE CASCADE) and from there through every
--    table that references profiles. Storage objects (photos/resumes) are
--    orphaned, not deleted — acceptable for now, noted in the UI copy.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. resource_leads — /resources email capture (lead magnet list)
--    RLS on with NO policies: the app can never read this table. Writes go
--    through the honeypot-checked RPC below (same low-risk anonymous-write
--    pattern as the approved volunteer guest signup).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  -- Where they signed up from, e.g. 'resources' (future-proofing)
  source text NOT NULL DEFAULT 'resources',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per address — repeat signups are a friendly no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_leads_email
  ON resource_leads (lower(email));

ALTER TABLE resource_leads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.submit_resource_lead(
  p_name text,
  p_email text,
  -- Honeypot: real people never fill this hidden field. Bots do. When it
  -- has content we return quietly WITHOUT storing anything.
  p_website text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(p_website, '') <> '' THEN
    RETURN; -- bot: silent no-op
  END IF;
  IF COALESCE(trim(p_name), '') = '' OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A name and a valid email are required';
  END IF;

  INSERT INTO resource_leads (name, email)
  VALUES (trim(p_name), lower(trim(p_email)))
  ON CONFLICT (lower(email)) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_resource_lead(text, text, text) TO anon, authenticated;
