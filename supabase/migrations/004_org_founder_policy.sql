-- ============================================================================
-- Overture 2.0 — Migration 004: org founder bootstrap policy
-- ============================================================================
-- 002's org_members INSERT policy requires is_org_admin(org_id), which makes
-- it impossible for the creator of a brand-new org to add themselves as the
-- first member (chicken-and-egg). This lets a user claim an org with no
-- members yet as its owner — exactly what theatre-maker onboarding does.
-- ============================================================================

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

CREATE POLICY "Founder can claim empty org as owner"
  ON org_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND NOT org_has_members(org_id)
  );
