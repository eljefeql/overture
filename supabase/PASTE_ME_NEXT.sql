-- ============================================================================
-- Overture 2.0 — Migration 027: Volunteer events → shifts → roles
-- ============================================================================
-- QC Master List #14 (owner request 2026-10-13): "If someone posts a
-- volunteer opportunity it should have the option to add time slots and
-- roles. For example, set shop might run 9am–3pm, but have two shifts and
-- each shift has carpentry or painting."
--
-- Model: EVENT (Set build Saturday · date · location · notes)
--          → SHIFTS (9:00–12:00 "Morning", 12:00–3:00 "Afternoon")
--            → ROLES (Carpentry ×3, Painting ×2, Misc ×2)
--
--   A ROLE IS A `volunteer_needs` ROW. The existing needs table gains three
--   nullable columns (event_id, shift_id, role_label); legacy standalone
--   needs keep event_id NULL and behave exactly as before. Because roles are
--   needs, EVERYTHING downstream is untouched: volunteer_signups, the
--   capacity-checked claim_volunteer_slot RPC (incl. the anonymous guest
--   path, team notification + guest confirmation email from 011, and the
--   past-shift guard from 019), cancel tokens, cancel_volunteer_signup,
--   get_volunteer_signup_info, claim_volunteer_signups auto-link, and the
--   send-reminders T-24h volunteer scan.
--
--   DENORMALIZED AT WRITE TIME (by the app): a role need carries its shift's
--   start_time / end_time and the event's event_date, and its `label` is
--   composed as "<role> — <event title>" (e.g. "Carpentry — Set build
--   Saturday"). That is why the reminder scan, the RPC copy ("Robert signed
--   up for Carpentry — Set build Saturday — Sat Mar 6, 9:00 AM"), and the
--   cancel page all keep working with NO edge-function redeploy.
--
--   1. volunteer_events  — new table (RLS mirrors volunteer_needs:
--      production members read, show team writes; anon reads ONLY via RPC).
--   2. volunteer_shifts  — new table (show_id denormalized so RLS needs no
--      join; same policies).
--   3. volunteer_needs   — + event_id, shift_id (both ON DELETE CASCADE, so
--      deleting a shift/event removes its roles and their signups — the UI
--      warns and requires confirmation when signups exist), + role_label.
--   4. get_volunteer_page — REPLACED (same signature). Adds an `events`
--      array (id/title/date/location/notes + nested shifts) and
--      eventId/shiftId/roleLabel on each need so the anonymous public page
--      can render the grouped card. Still exposes NO personal information —
--      counts only, never who signed up.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. volunteer_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date date,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_volunteer_events_show ON volunteer_events(show_id, event_date);

ALTER TABLE volunteer_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "volunteer_events_member_read" ON volunteer_events;
CREATE POLICY "volunteer_events_member_read" ON volunteer_events
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "volunteer_events_team_write" ON volunteer_events;
CREATE POLICY "volunteer_events_team_write" ON volunteer_events
  FOR ALL TO authenticated
  USING (is_show_team(show_id)) WITH CHECK (is_show_team(show_id));


-- ----------------------------------------------------------------------------
-- 2. volunteer_shifts — time windows inside an event
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteer_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES volunteer_events(id) ON DELETE CASCADE,
  -- Denormalized from the event so RLS checks need no join.
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  start_time timestamptz,
  end_time timestamptz,
  -- Optional friendly name: "Morning", "Afternoon", "Strike"
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_volunteer_shifts_event ON volunteer_shifts(event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_volunteer_shifts_show ON volunteer_shifts(show_id);

ALTER TABLE volunteer_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "volunteer_shifts_member_read" ON volunteer_shifts;
CREATE POLICY "volunteer_shifts_member_read" ON volunteer_shifts
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "volunteer_shifts_team_write" ON volunteer_shifts;
CREATE POLICY "volunteer_shifts_team_write" ON volunteer_shifts
  FOR ALL TO authenticated
  USING (is_show_team(show_id)) WITH CHECK (is_show_team(show_id));


-- ----------------------------------------------------------------------------
-- 3. volunteer_needs — a role inside a shift is a need with these set.
--    Legacy standalone needs: all three NULL, nothing changes for them.
-- ----------------------------------------------------------------------------
ALTER TABLE volunteer_needs
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES volunteer_events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES volunteer_shifts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role_label text;

CREATE INDEX IF NOT EXISTS idx_volunteer_needs_event ON volunteer_needs(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_needs_shift ON volunteer_needs(shift_id);


-- ----------------------------------------------------------------------------
-- 4. get_volunteer_page — REPLACED (011 body + grouping). Anon-safe: show
--    header, events (title/date/location/notes/shifts), and needs with
--    filled COUNTS. Never names, never emails.
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
  v_events jsonb;
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
      'eventId', n.event_id,
      'shiftId', n.shift_id,
      'roleLabel', n.role_label,
      'filled', (
        SELECT count(*) FROM volunteer_signups vs
        WHERE vs.need_id = n.id AND vs.status = 'confirmed'
      )
    ) AS need
    FROM volunteer_needs n
    WHERE n.show_id = p_show_id
  ) sub;

  SELECT coalesce(jsonb_agg(ev ORDER BY (ev->>'eventDate') NULLS LAST, ev->>'title'), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'eventDate', e.event_date,
      'location', e.location,
      'notes', e.notes,
      'shifts', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', sh.id,
          'eventId', sh.event_id,
          'startTime', sh.start_time,
          'endTime', sh.end_time,
          'label', sh.label
        ) ORDER BY sh.sort_order, sh.start_time NULLS LAST), '[]'::jsonb)
        FROM volunteer_shifts sh WHERE sh.event_id = e.id
      )
    ) AS ev
    FROM volunteer_events e
    WHERE e.show_id = p_show_id
  ) sub;

  RETURN jsonb_build_object('show', v_show, 'needs', v_needs, 'events', v_events);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_volunteer_page(uuid) TO anon, authenticated;
