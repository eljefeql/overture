-- ============================================================================
-- Overture 2.0 — Migration 028: Tokened invite links + no silent expiry
-- ============================================================================
-- Prod incident 2026-11-23: a theatre invited a real person; the invite email
-- sat unsent for weeks (RESEND_FROM), by the time it went out the invite had
-- auto-expired (14-day default), so her sign-in claimed nothing, she was
-- walked through "create your theatre", and her theatre never appeared.
-- Email-matching was the ONLY join mechanism, and it had three silent
-- failure modes: expiry, a different sign-up address, and a claim that ran
-- fire-and-forget before the screens that needed it.
--
-- This migration makes joining a theatre bulletproof:
--
--   1. Invites no longer expire on their own (default 1 year, claim ignores
--      the date). Time-expired rows are restored to pending. Revoked rows
--      (status 'expired' with a future expires_at) stay revoked.
--   2. Every invite is a LINK: /join/<invite id>. The id is an unguessable
--      uuid; possessing the link proves possession of the invite. Works for
--      any signed-in account, any email, any time — and the admin can copy
--      it off the members list and text it, so email is never the only path.
--   3. get_org_invite(id)  — anon-safe preview (theatre, inviter, role,
--      masked email, whether the viewer's email matches).
--   4. accept_org_invite(id) — claims THIS invite for the signed-in user
--      regardless of email. Idempotent. Records accepted_by / accepted_at.
--   5. claim_org_invites() — email path kept (no expiry; also matches the
--      auth email, not just profiles.email).
--   6. notify_org_invite — emails and in-app pings now link to /join/<id>.
-- ============================================================================

-- 1. Expiry ------------------------------------------------------------------
ALTER TABLE public.org_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 year');

ALTER TABLE public.org_invites
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Restore invites that expired purely by time (never used, never revoked).
UPDATE public.org_invites
SET status = 'pending', expires_at = now() + interval '1 year'
WHERE status = 'expired' AND expires_at <= now();

-- Push out every still-pending invite so none can lapse.
UPDATE public.org_invites
SET expires_at = greatest(expires_at, now() + interval '1 year')
WHERE status = 'pending';

-- 2. Anyone (incl. anon) may read a single invite by id -----------------------
CREATE OR REPLACE FUNCTION public.get_org_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_org record;
  v_inviter text;
  v_viewer_email text;
  v_local text;
  v_domain text;
BEGIN
  SELECT * INTO v_invite FROM org_invites WHERE id = p_invite_id;
  IF v_invite IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id, name, slug INTO v_org FROM orgs WHERE id = v_invite.org_id;
  SELECT display_name INTO v_inviter FROM profiles WHERE id = v_invite.invited_by;

  v_viewer_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_local  := split_part(v_invite.email, '@', 1);
  v_domain := split_part(v_invite.email, '@', 2);

  RETURN jsonb_build_object(
    'id',            v_invite.id,
    'orgId',         v_org.id,
    'orgName',       v_org.name,
    'orgSlug',       v_org.slug,
    'role',          v_invite.role,
    'invitedName',   v_invite.invited_name,
    'inviterName',   nullif(btrim(coalesce(v_inviter, '')), ''),
    'status',        v_invite.status,
    -- "c•••@gmail.com": enough for the person to recognise it, nothing to leak.
    'emailHint',     left(v_local, 1) || '•••@' || v_domain,
    'viewerMatches', (v_viewer_email <> '' AND v_viewer_email = lower(v_invite.email)),
    'viewerIsMember', (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM org_members WHERE org_id = v_invite.org_id AND user_id = auth.uid()
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_invite(uuid) TO anon, authenticated;

-- 3. Accept THIS invite for the signed-in user, whatever their email ----------
CREATE OR REPLACE FUNCTION public.accept_org_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_invite record;
  v_name text;
  v_email text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite FROM org_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'This invite link isn''t valid.';
  END IF;

  -- Already a member (by this or any route) → return quietly and leave the
  -- invite alone: an admin opening a link they copied must not burn it.
  IF EXISTS (SELECT 1 FROM org_members WHERE org_id = v_invite.org_id AND user_id = v_user) THEN
    RETURN v_invite.org_id;
  END IF;

  IF v_invite.status = 'accepted' AND v_invite.accepted_by IS NOT NULL
     AND v_invite.accepted_by <> v_user THEN
    RAISE EXCEPTION 'This invite link has already been used by someone else. Ask the theatre to send a new one.';
  END IF;
  IF v_invite.status = 'expired' THEN
    RAISE EXCEPTION 'This invite was cancelled by the theatre. Ask them to send a new one.';
  END IF;

  INSERT INTO org_members (org_id, user_id, role, invited_by)
  VALUES (v_invite.org_id, v_user, v_invite.role, v_invite.invited_by)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE org_invites
  SET status = 'accepted', accepted_by = v_user, accepted_at = now()
  WHERE id = v_invite.id;

  -- Tell the inviter.
  SELECT display_name, email INTO v_name, v_email FROM profiles WHERE id = v_user;
  IF v_invite.invited_by IS NOT NULL AND v_invite.invited_by <> v_user THEN
    INSERT INTO notifications (user_id, type, title, body, link_url)
    VALUES (
      v_invite.invited_by,
      'system',
      'Invite Accepted',
      coalesce(nullif(v_name, ''), v_email, 'Someone') || ' joined your theatre.',
      '/org'
    );
  END IF;

  RETURN v_invite.org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_org_invite(uuid) TO authenticated;

-- 4. Email-match claim: no expiry, matches the auth email too ----------------
CREATE OR REPLACE FUNCTION public.claim_org_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_auth_email text;
  v_name text;
  v_invite record;
  v_claimed integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, display_name INTO v_email, v_name FROM profiles WHERE id = v_user;
  v_auth_email := auth.jwt() ->> 'email';
  IF v_email IS NULL AND v_auth_email IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_invite IN
    SELECT * FROM org_invites
    WHERE status = 'pending'
      AND (lower(email) = lower(coalesce(v_email, ''))
           OR lower(email) = lower(coalesce(v_auth_email, '')))
  LOOP
    INSERT INTO org_members (org_id, user_id, role, invited_by)
    VALUES (v_invite.org_id, v_user, v_invite.role, v_invite.invited_by)
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE org_invites
    SET status = 'accepted', accepted_by = v_user, accepted_at = now()
    WHERE id = v_invite.id;
    v_claimed := v_claimed + 1;

    IF v_invite.invited_by IS NOT NULL AND v_invite.invited_by <> v_user THEN
      INSERT INTO notifications (user_id, type, title, body, link_url)
      VALUES (
        v_invite.invited_by,
        'system',
        'Invite Accepted',
        coalesce(nullif(v_name, ''), v_email, v_auth_email) || ' joined your theatre.',
        '/org'
      );
    END IF;
  END LOOP;

  RETURN v_claimed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_org_invites() TO authenticated;

-- 5. Invite notifications link to the tokened join page ----------------------
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
  v_link text;
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
  v_link := '/join/' || v_invite.id::text;

  SELECT id INTO v_recipient
    FROM profiles WHERE lower(email) = lower(v_invite.email);

  IF v_recipient IS NOT NULL THEN
    -- Existing Overture user → in-app notification (emails via the
    -- notifications webhook). Clicking it accepts the invite.
    INSERT INTO notifications (user_id, type, title, body, link_url)
    VALUES (
      v_recipient,
      'system',
      'Theatre Invitation',
      coalesce(nullif(btrim(coalesce(v_inviter, '')), ''), 'Someone') ||
        ' invited you to join ' || coalesce(v_org_name, 'a theatre') ||
        '. Open this to accept.',
      v_link
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
        ' Use the button below to accept: create a free account (any email' ||
        ' address is fine) or sign in, and you''ll be added to the theatre.',
      NULL,
      'org_invite',
      v_link,
      'org_invite:' || v_invite.id
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_org_invite(uuid) TO authenticated;

-- 6. Pending invite emails already queued (not yet sent) get the new link ----
UPDATE public.guest_emails g
SET link_url = '/join/' || replace(g.dedupe_key, 'org_invite:', '')
WHERE g.kind = 'org_invite' AND g.status = 'pending';
