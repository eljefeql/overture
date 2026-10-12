-- ============================================================================
-- Overture 2.0 — Migration 020: real theatre-invite emails + email-gating fixes
-- ============================================================================
-- QC Master List P1-3 + P1-4. Prerequisites: migrations through 018 (needs
-- 011's guest_emails, 014's org_invites.invited_name, 015's is_show_manager).
--
--   1. guest_emails grows two generic columns:
--        kind     — what template the sender (send-reminders Edge Function)
--                   should use ('org_invite'; NULL = legacy volunteer style)
--        link_url — relative CTA path the sender turns into an absolute
--                   APP_URL link (mirrors notifications.link_url)
--   2. notify_org_invite REPLACED (same signature — the app already calls it
--      after every invite insert):
--        · invitee HAS an account  → in-app notification (unchanged path;
--          email rides the notifications webhook)
--        · invitee has NO account  → enqueue a warm invite email in
--          guest_emails ("{Inviter} invited you to join {Theatre} on
--          Overture" + signup CTA). Delivered by the send-reminders cron
--          (≤15 min). Idempotent via dedupe_key = 'org_invite:<invite id>'.
--   3. announce_to_show REPLACED (same body as 015, one fix): the composer's
--      "also email" flag (announcements.emailed) is now honored — when it's
--      false the fan-out notifications are tagged category 'in_app', which
--      the send-notification-email function skips entirely. Previously every
--      announcement emailed regardless of the flag (P1-4 audit gap).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run (staging AND prod).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. guest_emails: generic kind + CTA link
-- ----------------------------------------------------------------------------
ALTER TABLE guest_emails ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE guest_emails ADD COLUMN IF NOT EXISTS link_url text;

-- ----------------------------------------------------------------------------
-- 2. notify_org_invite — v3: existing accounts get the in-app notification
--    (untagged → always emails via the webhook, correct for a transactional
--    invite); new people get a queued invite email.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_org_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_recipient uuid;
  v_org_name text;
  v_inviter text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite FROM org_invites WHERE id = p_invite_id;
  IF v_invite IS NULL OR v_invite.status <> 'pending' THEN
    RETURN;
  END IF;
  IF NOT is_org_admin(v_invite.org_id) THEN
    RAISE EXCEPTION 'Only org admins can send invite notifications';
  END IF;

  SELECT name INTO v_org_name FROM orgs WHERE id = v_invite.org_id;
  SELECT display_name INTO v_inviter
    FROM profiles WHERE id = coalesce(v_invite.invited_by, auth.uid());

  SELECT id INTO v_recipient
    FROM profiles WHERE lower(email) = lower(v_invite.email);

  IF v_recipient IS NOT NULL THEN
    -- Existing Overture user → in-app notification; email rides the
    -- notifications → send-notification-email webhook (untagged = sent).
    INSERT INTO notifications (user_id, type, title, body, link_url)
    VALUES (
      v_recipient,
      'system',
      'Theatre Invitation',
      'You''ve been invited to join ' || coalesce(v_org_name, 'a theatre') ||
        '. Sign out and back in (or just keep using Overture) — you''ll be added automatically.',
      '/org'
    );
  ELSE
    -- No account yet → queue a real invite email. Sent by the send-reminders
    -- cron via Resend (≤15 min). The dedupe_key makes repeat calls harmless.
    INSERT INTO guest_emails
      (to_email, to_name, subject, body, show_title, kind, link_url, dedupe_key)
    VALUES (
      lower(v_invite.email),
      nullif(btrim(coalesce(v_invite.invited_name, '')), ''),
      coalesce(nullif(btrim(coalesce(v_inviter, '')), ''), 'Someone') ||
        ' invited you to join ' || coalesce(v_org_name, 'a theatre') || ' on Overture',
      coalesce(nullif(btrim(coalesce(v_inviter, '')), ''), 'Someone') ||
        ' added you to ' || coalesce(v_org_name, 'their theatre') ||
        ' on Overture — the app ' || coalesce(v_org_name, 'the theatre') ||
        ' uses to organize auditions, casting, and show communication.' ||
        ' Create your free account with this email address and you''ll be' ||
        ' connected to the theatre automatically.',
      NULL,
      'org_invite',
      '/signup?next=/org',
      'org_invite:' || v_invite.id
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_org_invite(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. announce_to_show — same as migration 015 (is_show_manager gate,
--    identical recipient resolution) PLUS: honor the composer's "also email"
--    flag. announcements.emailed = false → notifications tagged 'in_app',
--    which send-notification-email never emails. emailed = true → the
--    existing 'announcements' category (prefs-gated as before).
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
  v_emailed boolean;
  v_category text;
  v_scope text;
  v_group text;
  v_count integer := 0;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT show_id, audience, rehearsal_id, emailed
    INTO v_show_id, v_audience, v_rehearsal_id, v_emailed
    FROM announcements WHERE id = p_announcement_id;
  IF v_show_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;
  IF NOT is_show_manager(v_show_id) THEN
    RAISE EXCEPTION 'Only the show team or theatre admins can post announcements';
  END IF;

  -- "Also email" flag → category. 'in_app' is never emailed by the pipeline.
  v_category := CASE WHEN coalesce(v_emailed, true) THEN 'announcements' ELSE 'in_app' END;

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
           '/shows/' || v_show_id || '/hub', v_category
    FROM recipients
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.announce_to_show(uuid, text, text, text) TO authenticated;
