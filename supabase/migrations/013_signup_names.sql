-- ============================================================================
-- Overture 2.0 — Migration 013: public audition page signup names
-- ============================================================================
-- Backs the owner-requested slot visibility on the public audition page
-- (/auditions/[id]):
--   · EVERYONE (including anonymous visitors) sees per-block fill counts —
--     that already works via get_slot_availability (migration 005, granted
--     to anon).
--   · SIGNED-IN users additionally see WHO is auditioning in each block, as
--     "First L." only. This is the privacy line the owner set: first name +
--     last initial, never full names to strangers, never anything to anon,
--     and deliberately NO profile links.
--
-- get_signup_names(p_show_id) — SECURITY DEFINER because RLS hides other
-- actors' signup rows. It REQUIRES an authenticated caller (auth.uid() check
-- inside + granted to authenticated only, never anon) and returns
-- (group_id, display_name) for non-withdrawn signups, where display_name is
-- built from profiles.display_name: first word + last-word initial ("Maria
-- S."); single-word names are returned as-is.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_signup_names(p_show_id uuid)
RETURNS TABLE (group_id uuid, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    s.group_id,
    CASE
      WHEN array_length(n.parts, 1) > 1
        THEN n.parts[1] || ' ' || left(n.parts[array_length(n.parts, 1)], 1) || '.'
      ELSE COALESCE(n.parts[1], '')
    END AS display_name
  FROM audition_signups s
  JOIN profiles p ON p.id = s.actor_id
  CROSS JOIN LATERAL (
    SELECT regexp_split_to_array(trim(p.display_name), '\s+') AS parts
  ) n
  WHERE s.show_id = p_show_id
    AND s.status <> 'withdrawn'
    AND s.group_id IS NOT NULL
    -- Hard privacy gate: anonymous callers get nothing, ever.
    AND auth.uid() IS NOT NULL
  ORDER BY 2;
$$;

-- authenticated ONLY — anon must never see names (counts come from
-- get_slot_availability instead).
REVOKE ALL ON FUNCTION public.get_signup_names(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_signup_names(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_signup_names(uuid) TO authenticated;
