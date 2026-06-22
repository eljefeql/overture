-- ============================================================================
-- Overture 2.0 — Migration 006: org membership & team cloud plumbing
-- ============================================================================
-- Ships with the theatre-side cloud migration (org identity, invites, teams):
--   1. claim_org_invites()  — invited users can't INSERT org_members or
--      UPDATE org_invites under 002's policies, so acceptance happens in a
--      SECURITY DEFINER RPC called on sign-in / onboarding completion.
--   2. notify_org_invite()  — lets an org admin notify an EXISTING user that
--      they've been invited (create_notification requires a shared show,
--      which doesn't exist yet at invite time).
--   3. Org admins can remove non-owner members (002 only allowed self-leave).
--   4. Org admins can manage show roles + audition slots even when they're
--      not on that show's team (002 was show-team-only).
--   5. create_notification: also allow team→team within the same show
--      (used when someone is added to a production team).
-- ============================================================================

-- ───────────────────────────────────────────────────────────
-- 0. Migration 004 was never applied to the hosted project
--    (verified 2026-06-12: org_has_members() missing, founder
--    org_members INSERT 403s). Included here so one paste fixes
--    theatre-maker onboarding too. Safe to re-run.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION org_has_members(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM org_members WHERE org_id = org_uuid);
$$;

GRANT EXECUTE ON FUNCTION org_has_members(uuid) TO authenticated;

DROP POLICY IF EXISTS "Founder can claim empty org as owner" ON org_members;
CREATE POLICY "Founder can claim empty org as owner"
  ON org_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND NOT org_has_members(org_id)
  );

-- ───────────────────────────────────────────────────────────
-- 1. claim_org_invites — accept pending invites for my email
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_org_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_name text;
  v_invite record;
  v_claimed integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, display_name INTO v_email, v_name
  FROM profiles WHERE id = v_user;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_invite IN
    SELECT * FROM org_invites
    WHERE lower(email) = lower(v_email)
      AND status = 'pending'
      AND expires_at > now()
  LOOP
    -- Join the theatre with the invited role (idempotent).
    INSERT INTO org_members (org_id, user_id, role, invited_by)
    VALUES (v_invite.org_id, v_user, v_invite.role, v_invite.invited_by)
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE org_invites SET status = 'accepted' WHERE id = v_invite.id;
    v_claimed := v_claimed + 1;

    -- Tell the inviter their invite was accepted.
    IF v_invite.invited_by IS NOT NULL AND v_invite.invited_by <> v_user THEN
      INSERT INTO notifications (user_id, type, title, body, link_url)
      VALUES (
        v_invite.invited_by,
        'system',
        'Invite Accepted',
        coalesce(nullif(v_name, ''), v_email) || ' joined your theatre.',
        '/org'
      );
    END IF;
  END LOOP;

  -- Tidy up anything past its expiry while we're here.
  UPDATE org_invites
  SET status = 'expired'
  WHERE lower(email) = lower(v_email)
    AND status = 'pending'
    AND expires_at <= now();

  RETURN v_claimed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_org_invites() TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 2. notify_org_invite — in-app ping for invitees who already
--    have an Overture account
-- ───────────────────────────────────────────────────────────
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

  SELECT id INTO v_recipient FROM profiles WHERE lower(email) = lower(v_invite.email);
  IF v_recipient IS NULL THEN
    RETURN; -- no account yet; they'll claim the invite at sign-up
  END IF;

  SELECT name INTO v_org_name FROM orgs WHERE id = v_invite.org_id;

  INSERT INTO notifications (user_id, type, title, body, link_url)
  VALUES (
    v_recipient,
    'system',
    'Theatre Invitation',
    'You''ve been invited to join ' || coalesce(v_org_name, 'a theatre') ||
      '. Sign out and back in (or just keep using Overture) — you''ll be added automatically.',
    '/org'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_org_invite(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 3. Org admins can remove non-owner members
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org admins can remove members" ON org_members;
CREATE POLICY "Org admins can remove members"
  ON org_members FOR DELETE
  TO authenticated
  USING (is_org_admin(org_id) AND role <> 'owner');

-- ───────────────────────────────────────────────────────────
-- 4. Org admins can manage show roles + audition slots
--    (002 limited writes to the show team; admins/owners of the
--    producing theatre should always be able to edit setup)
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org admins can manage show roles" ON show_roles;
CREATE POLICY "Org admins can manage show roles"
  ON show_roles FOR ALL
  TO authenticated
  USING (is_org_admin(show_org_id(show_id)))
  WITH CHECK (is_org_admin(show_org_id(show_id)));

DROP POLICY IF EXISTS "Org admins can manage audition groups" ON audition_groups;
CREATE POLICY "Org admins can manage audition groups"
  ON audition_groups FOR ALL
  TO authenticated
  USING (is_org_admin(show_org_id(show_id)))
  WITH CHECK (is_org_admin(show_org_id(show_id)));

-- ───────────────────────────────────────────────────────────
-- 5. create_notification: allow team→team within the same show
--    (e.g. "You've been added to a production team")
-- ───────────────────────────────────────────────────────────
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

  INSERT INTO notifications (user_id, type, title, body, show_title, link_url)
  VALUES (p_recipient_id, p_type, p_title, p_body, p_show_title, p_link_url)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, notification_type, text, text, text, text) TO authenticated;
