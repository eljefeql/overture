-- ============================================================================
-- Overture 2.0 — Migration 017: editable day-of contact on shows
-- ============================================================================
-- Production-launch QA, owner-approved finding 11: the public audition page's
-- "Questions or Last-Minute Issues?" block only ever showed the stage manager
-- from the show team — there was no way to say "actually, call Jamie at this
-- number on audition day." The show setup page's Edit Details modal now has a
-- "Day-of Contact" name + phone/email pair stored on the show itself.
--
-- Display rules (unchanged privacy line): the contact renders on the public
-- audition page behind the EXISTING signed-in gating — anonymous visitors
-- never see a person. When both fields are empty, the stage manager from the
-- show team remains the fallback, exactly as before.
--
-- The app writes these columns with a retry-without-column fallback
-- (updateShow in client.ts, same pattern as open_to_ensemble), so nothing
-- breaks before this is pasted.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before new production projects are set up.
-- ============================================================================

ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS day_of_contact_name text,
  ADD COLUMN IF NOT EXISTS day_of_contact_info text;
-- ============================================================================
-- Overture 2.0 — Migration 018: geocoding coordinates
-- ============================================================================
-- Sprint D Phase 4: real distances on Discover/browse. Adds latitude /
-- longitude columns to the three places a location lives:
--
--   profiles  — the actor's home city/state (profiles.location_city/state)
--   orgs      — the theatre's city/state
--   venues    — individual spaces (free-text address)
--
-- No PostGIS: at beta scale distance is computed client-side with a
-- haversine (src/lib/utils.ts → haversineMiles). Coordinates are written
-- best-effort at save time via /api/geocode (Google Geocoding, server-only
-- key) and backfilled with scripts/backfill-geocode.mjs (owner-run,
-- service-role key passed explicitly on the command line).
--
-- The app writes these columns with a retry-without-column fallback (the
-- open_to_ensemble pattern in client.ts), so nothing breaks before this is
-- pasted; reads degrade to null coordinates (= no distance shown).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before new production projects are set up.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
-- ============================================================================
-- Overture 2.0 — Migration 019: Hub trust fixes — cast visibility, targeted
-- announcement reads, no claiming past volunteer shifts
-- ============================================================================
-- QC Master List P1 items 1, 6, 7 (hardening week, 2026-10-12).
--
--   1. CAST VISIBILITY (P1-1, confirmed at the DB level): cast members open
--      the Show Hub and see "Cast (1)" — themselves. RLS on cast_assignments
--      (002, widened to managers in 015) lets an actor read only their OWN
--      rows. New read policy: PRODUCTION MEMBERS (is_production_member from
--      010 — accepted cast + show team + org owner/admin) can read ACCEPTED
--      assignments once the cast list is published. The honest publish
--      signal is shows.status: publishCastList() sets 'cast' and
--      unpublishCastList() reverts to 'casting' (there is no separate
--      published flag), and 'archived' is only reachable FROM 'cast', so the
--      gate is status IN ('cast', 'archived'). Pending / declined /
--      withdrawn / draft / sent rows stay invisible to castmates, and no
--      write policy changes. (Castmate display names ride the existing
--      profiles join — 002 already grants full-row profiles SELECT to all
--      authenticated users, so nothing to widen there.)
--
--   2. TARGETED ANNOUNCEMENT READS (P1-6): the fan-out (announce_to_show)
--      targets correctly, but "announcements_member_read" (010) let EVERY
--      production member read EVERY announcement — so a principals-only
--      post displayed on an ensemble member's hub. The read policy now
--      mirrors the fan-out: managers (team + org admin) see all (they need
--      the audience labels + read receipts); everyone else sees only the
--      announcements addressed to them, via the new
--      is_announcement_recipient() helper (same audience resolution as
--      announce_to_show, including the rehearsal-call fallbacks).
--
--   3. PAST VOLUNTEER SHIFTS (P1-7): claim_volunteer_slot accepted claims on
--      shifts dated in the past. Replaced with the migration-011 body plus a
--      shift-has-passed guard (the UI also stops rendering past shifts as
--      claimable; this closes the direct-RPC path).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. cast_assignments — production members read accepted castmates on shows
--    whose cast list is published. ADDITIVE policy: the actor-own-rows and
--    manager policies from 002/015 are untouched, as are all write policies.
--    (is_production_member is SECURITY DEFINER, so its own look at
--    cast_assignments bypasses RLS — no policy recursion.)
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Production members can see accepted castmates on cast shows" ON cast_assignments;
CREATE POLICY "Production members can see accepted castmates on cast shows"
  ON cast_assignments FOR SELECT
  TO authenticated
  USING (
    status = 'accepted'
    AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = cast_assignments.show_id
        AND s.status IN ('cast', 'archived')
    )
    AND is_production_member(show_id)
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 2a. Helper: is the current user in an announcement's targeted audience?
--     Mirrors announce_to_show's recipient resolution exactly (015 body):
--       company    → any production member (accepted cast + team + org admin)
--       cast       → accepted cast
--       principals → accepted cast in lead/supporting roles
--       crew       → show team
--       rehearsal  → resolved through the rehearsal's call row; a deleted
--                    rehearsal (rehearsal_id SET NULL) falls back to company,
--                    scope 'everyone' → company, 'group' → that group,
--                    'custom' → the picked people.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_announcement_recipient(p_announcement_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_show_id uuid;
  v_audience text;
  v_rehearsal_id uuid;
  v_scope text;
  v_group text;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  SELECT show_id, audience, rehearsal_id
    INTO v_show_id, v_audience, v_rehearsal_id
    FROM announcements WHERE id = p_announcement_id;
  IF v_show_id IS NULL THEN
    RETURN false;
  END IF;

  -- "everyone called to [rehearsal]" resolves through the rehearsal's call
  -- (same fallbacks as announce_to_show).
  IF v_audience = 'rehearsal' AND v_rehearsal_id IS NOT NULL THEN
    SELECT called_scope, group_key INTO v_scope, v_group
      FROM rehearsal_calls WHERE rehearsal_id = v_rehearsal_id;
    v_scope := COALESCE(v_scope, 'everyone');
    IF v_scope = 'everyone' THEN
      v_audience := 'company';
    ELSIF v_scope = 'group' THEN
      v_audience := COALESCE(v_group, 'company');
    ELSE
      RETURN EXISTS (
        SELECT 1 FROM rehearsal_call_people
        WHERE rehearsal_id = v_rehearsal_id AND user_id = v_user
      );
    END IF;
  ELSIF v_audience = 'rehearsal' THEN
    v_audience := 'company';
  END IF;

  IF v_audience = 'company' THEN
    RETURN is_production_member(v_show_id);
  ELSIF v_audience = 'cast' THEN
    RETURN EXISTS (
      SELECT 1 FROM cast_assignments
      WHERE show_id = v_show_id AND actor_id = v_user AND status = 'accepted'
    );
  ELSIF v_audience = 'principals' THEN
    RETURN EXISTS (
      SELECT 1 FROM cast_assignments ca
      JOIN show_roles sr ON sr.id = ca.role_id
      WHERE ca.show_id = v_show_id AND ca.actor_id = v_user
        AND ca.status = 'accepted'
        AND sr.role_type IN ('lead', 'supporting')
    );
  ELSIF v_audience = 'ensemble' THEN
    -- Only reachable via a rehearsal call scoped group:ensemble.
    RETURN EXISTS (
      SELECT 1 FROM cast_assignments ca
      JOIN show_roles sr ON sr.id = ca.role_id
      WHERE ca.show_id = v_show_id AND ca.actor_id = v_user
        AND ca.status = 'accepted'
        AND sr.role_type NOT IN ('lead', 'supporting')
    );
  ELSIF v_audience = 'crew' THEN
    RETURN is_show_team(v_show_id);
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION is_announcement_recipient(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2b. announcements read — replaces "announcements_member_read" (010; 015
--     left it in place). Managers keep seeing everything (audience labels,
--     pin/delete, read receipts); everyone else only what's addressed to
--     them. Write policies (015's manager insert/update/delete) untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "announcements_member_read" ON announcements;
DROP POLICY IF EXISTS "announcements_targeted_read" ON announcements;
CREATE POLICY "announcements_targeted_read" ON announcements
  FOR SELECT TO authenticated
  USING (is_show_manager(show_id) OR is_announcement_recipient(id));


-- ────────────────────────────────────────────────────────────────────────────
-- 3. claim_volunteer_slot — migration-011 body (team notification + guest
--    confirmation email queue, both best-effort) PLUS a past-shift guard:
--    a shift is over once its end time (or start time, when no end) has
--    passed, or — for date-only needs — once the event date is behind us
--    (compared in America/New_York, same zone 011 uses for display copy).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_volunteer_slot(
  p_need_id uuid,
  p_guest_name text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_slots integer;
  v_taken integer;
  v_token uuid;
  v_signup_id uuid;
  v_need record;
  v_when text;
BEGIN
  -- Lock the need row so two simultaneous claims can't oversubscribe.
  SELECT n.slots, n.label, n.event_date, n.start_time, n.end_time,
         n.show_id, s.title AS show_title
    INTO v_need
    FROM volunteer_needs n JOIN shows s ON s.id = n.show_id
   WHERE n.id = p_need_id
   FOR UPDATE OF n;
  IF v_need IS NULL THEN
    RAISE EXCEPTION 'This volunteer need no longer exists.';
  END IF;
  v_slots := v_need.slots;

  -- No claiming a shift that has already happened (P1-7).
  IF (v_need.end_time IS NOT NULL AND v_need.end_time < now())
     OR (v_need.end_time IS NULL AND v_need.start_time IS NOT NULL
         AND v_need.start_time < now())
     OR (v_need.start_time IS NULL AND v_need.event_date IS NOT NULL
         AND v_need.event_date < (now() AT TIME ZONE 'America/New_York')::date) THEN
    RAISE EXCEPTION 'This shift has already happened — thank you anyway!';
  END IF;

  SELECT count(*) INTO v_taken
    FROM volunteer_signups
    WHERE need_id = p_need_id AND status = 'confirmed';
  IF v_taken >= v_slots THEN
    RAISE EXCEPTION 'All slots for this shift are filled — thank you anyway!';
  END IF;

  -- Human-readable shift moment for notification/email copy.
  v_when := CASE
    WHEN v_need.start_time IS NOT NULL
      THEN to_char(v_need.start_time AT TIME ZONE 'America/New_York', 'Dy Mon FMDD, FMHH12:MI AM')
    WHEN v_need.event_date IS NOT NULL
      THEN to_char(v_need.event_date, 'Dy Mon FMDD')
    ELSE NULL
  END;

  IF v_user IS NULL THEN
    IF p_guest_name IS NULL OR btrim(p_guest_name) = ''
       OR p_guest_email IS NULL OR btrim(p_guest_email) = '' THEN
      RAISE EXCEPTION 'Name and email are required to sign up.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM volunteer_signups
      WHERE need_id = p_need_id AND status = 'confirmed'
        AND lower(guest_email) = lower(btrim(p_guest_email))
    ) THEN
      RAISE EXCEPTION 'You already have a spot on this shift.';
    END IF;
    INSERT INTO volunteer_signups (need_id, guest_name, guest_email, guest_phone)
    VALUES (p_need_id, btrim(p_guest_name), lower(btrim(p_guest_email)), p_guest_phone)
    RETURNING cancel_token, id INTO v_token, v_signup_id;

    -- (a) Tell the team — best-effort, never fails the claim.
    BEGIN
      INSERT INTO notifications (user_id, type, title, body, show_title, link_url)
      SELECT tm.user_id, 'system',
             'New volunteer signup',
             btrim(p_guest_name) || ' signed up for ' || v_need.label
               || coalesce(' — ' || v_when, '') || '.',
             v_need.show_title,
             '/shows/' || v_need.show_id || '/hub'
        FROM show_team_members tm
       WHERE tm.show_id = v_need.show_id AND tm.user_id IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- (b) Queue the confirmation email — sent by the send-reminders cron the
    -- moment RESEND_API_KEY exists. Best-effort.
    BEGIN
      INSERT INTO guest_emails
        (to_email, to_name, subject, body, show_title, cancel_token, dedupe_key)
      VALUES (
        lower(btrim(p_guest_email)),
        btrim(p_guest_name),
        'You''re signed up to volunteer — ' || v_need.show_title,
        'Thanks for helping out! You have a spot as ' || v_need.label
          || ' for ' || v_need.show_title
          || coalesce(' on ' || v_when, '') || '.'
          || ' We''ll email you a reminder the day before.',
        v_need.show_title,
        v_token,
        'volunteer_confirmation:' || v_signup_id
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSE
    IF EXISTS (
      SELECT 1 FROM volunteer_signups
      WHERE need_id = p_need_id AND user_id = v_user AND status = 'confirmed'
    ) THEN
      RAISE EXCEPTION 'You already have a spot on this shift.';
    END IF;
    INSERT INTO volunteer_signups (need_id, user_id)
    VALUES (p_need_id, v_user)
    RETURNING cancel_token INTO v_token;
  END IF;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_volunteer_slot(uuid, text, text, text) TO anon, authenticated;
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
