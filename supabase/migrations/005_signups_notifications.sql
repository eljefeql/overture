-- ============================================================================
-- Overture 2.0 — Migration 005: Signups + notifications on cloud
-- ============================================================================
-- Supports the Sprint B/C migration of audition signups, callbacks, casting,
-- and notifications to Supabase:
--   1. get_slot_availability() — public slot counts (RLS hides other actors'
--      signup rows, so the modal needs a SECURITY DEFINER counter; mirrors
--      get_show_signup_count from 003).
--   2. Actor response policies — 002 only let the show team UPDATE callbacks
--      and cast_assignments, so an actor could never accept/decline their own
--      callback or offer. Scoped UPDATE policies fix that.
--   3. Show team DELETE policy on callbacks (callbacks page removes them).
--   4. create_notification() — notifications has no INSERT policy for
--      authenticated users (by design). This SECURITY DEFINER function lets a
--      user create a notification for someone ONLY when they share a show:
--      team member → actor involved in the show, or actor → team member.
--   5. notification_deliveries — email delivery log written by the
--      send-notification-email Edge Function (service role only; no policies).
-- ============================================================================

-- ───────────────────────────────────────────────────────────
-- 1. Slot availability (groupId → taken count, withdrawn excluded)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_slot_availability(p_show_id uuid)
RETURNS TABLE (group_id uuid, taken integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT g.id AS group_id, count(s.id)::integer AS taken
  FROM audition_groups g
  LEFT JOIN audition_signups s
    ON s.group_id = g.id
   AND s.status <> 'withdrawn'
  WHERE g.show_id = p_show_id
  GROUP BY g.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_slot_availability(uuid) TO anon, authenticated;

-- ───────────────────────────────────────────────────────────
-- 2. Actors can respond to their own callbacks and cast offers
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Actors can respond to own callbacks" ON callbacks;
CREATE POLICY "Actors can respond to own callbacks"
  ON callbacks FOR UPDATE
  TO authenticated
  USING (actor_id = auth.uid())
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "Actors can respond to own cast offers" ON cast_assignments;
CREATE POLICY "Actors can respond to own cast offers"
  ON cast_assignments FOR UPDATE
  TO authenticated
  USING (actor_id = auth.uid())
  WITH CHECK (actor_id = auth.uid());

-- ───────────────────────────────────────────────────────────
-- 3. Show team can delete callbacks (remove from callback list)
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Show team can delete callbacks" ON callbacks;
CREATE POLICY "Show team can delete callbacks"
  ON callbacks FOR DELETE
  TO authenticated
  USING (is_show_team(show_id));

-- ───────────────────────────────────────────────────────────
-- 4. create_notification — relationship-checked notification insert
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
  -- or an actor notifying a team member of a show they're involved in.
  IF NOT (
    (v_sender_is_team AND v_recipient_involved)
    OR (v_recipient_is_team AND v_sender_involved)
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

-- ───────────────────────────────────────────────────────────
-- 5. notification_deliveries — email send log (Edge Function only)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON notification_deliveries(notification_id);

-- RLS on, no policies: only the service role (Edge Function) reads/writes.
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
