-- ============================================================================
-- Overture 2.0 — Migration 011: dual-path volunteers, guest email + auto-link
-- ============================================================================
-- Show Hub part 2. Migration 010 shipped the volunteer tables +
-- claim_volunteer_slot / cancel_volunteer_signup RPCs. This migration adds
-- everything the PUBLIC guest path needs:
--
--   1. guest_emails — a tiny outbound-email queue for people with NO account
--      (a notifications row can't target a guest with no user_id). Rows are
--      written server-side only (SECURITY DEFINER RPCs + the send-reminders
--      Edge Function) and sent by send-reminders via Resend. Until
--      RESEND_API_KEY is set, rows simply sit as 'pending' — the moment the
--      key exists, the next cron run delivers them. No webhook needed.
--   2. get_volunteer_page(show_id) — anon-safe read for /volunteer/[showId]:
--      show header + needs with filled counts. No personal info exposed.
--   3. get_volunteer_signup_info(token) — anon-safe read for the tokened
--      cancel page /volunteer/cancel/[token].
--   4. claim_volunteer_slot REPLACED (same signature): guest claims now also
--      (a) notify the show's team in-app ("Robert Kim signed up for Ushers")
--      and (b) enqueue the guest's confirmation email — both best-effort.
--   5. claim_volunteer_signups() — auto-link: when someone signs up/logs in
--      with an email matching guest volunteer signups, attach their user_id
--      (mirrors claim_org_invites; called from the same sign-in hook).
--
-- Approved gating exception (SHOW_HUB_SPEC.md): community guests volunteer
-- with NO account. Low-risk, capacity-checked, SECURITY DEFINER only.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. guest_emails — outbound queue for account-less recipients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  -- Plain-text body; the sender wraps it in the standard email template.
  body text NOT NULL,
  show_title text,
  -- When set, the sender appends the no-login cancel link
  -- (APP_URL/volunteer/cancel/<token>) and the account upsell.
  cancel_token uuid,
  -- Idempotency: e.g. 'volunteer_confirmation:<signup_id>',
  -- 'volunteer_reminder:24h:<signup_id>'. Insert with ON CONFLICT DO NOTHING.
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_guest_emails_status ON guest_emails(status);

-- RLS on, NO policies: service role (Edge Functions) + SECURITY DEFINER only.
ALTER TABLE guest_emails ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. get_volunteer_page — anon-safe board read for /volunteer/[showId]
--    (volunteer_needs has no anon read policy by design; this exposes only
--    the show header + labels/dates/slot counts, never who signed up.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_volunteer_page(p_show_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_show jsonb;
  v_needs jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'orgName', o.name,
    'posterUrl', s.poster_url,
    'city', s.city,
    'state', s.state,
    'showOpen', s.show_open,
    'showClose', s.show_close,
    'performanceLocation', s.performance_location
  )
  INTO v_show
  FROM shows s
  JOIN orgs o ON o.id = s.org_id
  WHERE s.id = p_show_id;

  IF v_show IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(need ORDER BY (need->>'eventDate') NULLS LAST, need->>'label'), '[]'::jsonb)
  INTO v_needs
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'label', n.label,
      'eventDate', n.event_date,
      'startTime', n.start_time,
      'endTime', n.end_time,
      'slots', n.slots,
      'notes', n.notes,
      'filled', (
        SELECT count(*) FROM volunteer_signups vs
        WHERE vs.need_id = n.id AND vs.status = 'confirmed'
      )
    ) AS need
    FROM volunteer_needs n
    WHERE n.show_id = p_show_id
  ) sub;

  RETURN jsonb_build_object('show', v_show, 'needs', v_needs);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_volunteer_page(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. get_volunteer_signup_info — anon-safe read for the tokened cancel page.
--    Holding the token proves ownership of the signup.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_volunteer_signup_info(p_cancel_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', vs.status,
    'name', coalesce(p.display_name, vs.guest_name),
    'label', n.label,
    'eventDate', n.event_date,
    'startTime', n.start_time,
    'endTime', n.end_time,
    'showTitle', s.title,
    'orgName', o.name
  )
  FROM volunteer_signups vs
  JOIN volunteer_needs n ON n.id = vs.need_id
  JOIN shows s ON s.id = n.show_id
  JOIN orgs o ON o.id = s.org_id
  LEFT JOIN profiles p ON p.id = vs.user_id
  WHERE vs.cancel_token = p_cancel_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_volunteer_signup_info(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. claim_volunteer_slot — REPLACED (same signature as migration 010).
--    Adds, for guest claims only and always best-effort:
--      a. in-app notifications to the show's team members with accounts
--      b. a queued confirmation email (guest_emails) with the cancel token
-- ----------------------------------------------------------------------------
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
  SELECT n.slots, n.label, n.event_date, n.start_time, n.show_id, s.title AS show_title
    INTO v_need
    FROM volunteer_needs n JOIN shows s ON s.id = n.show_id
   WHERE n.id = p_need_id
   FOR UPDATE OF n;
  IF v_need IS NULL THEN
    RAISE EXCEPTION 'This volunteer need no longer exists.';
  END IF;
  v_slots := v_need.slots;

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

-- ----------------------------------------------------------------------------
-- 5. claim_volunteer_signups — auto-link guest signups at sign-in.
--    Mirrors claim_org_invites: match on the signed-in user's profile email.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_volunteer_signups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;
  SELECT email INTO v_email FROM profiles WHERE id = v_user;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE volunteer_signups
     SET user_id = v_user
   WHERE user_id IS NULL
     AND lower(guest_email) = lower(v_email);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_volunteer_signups() TO authenticated;
