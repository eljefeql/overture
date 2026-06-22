-- ============================================================================
-- Overture 2.0 — Migration 003: V1.1 delta
-- ============================================================================
-- Brings the schema up to date with everything built since 001/002:
--   profile redesign (appearance, accessibility, dealbreakers, bucket list,
--   guardian name/phone), union status removal, onboarding step enum,
--   audition signup acknowledgment fields, org code of conduct,
--   and anonymous (logged-out) read access for the public pages
--   (/browse, /auditions/[id], /theatres/[orgId]) per the access-gating model.
-- ============================================================================

-- ───────────────────────────────────────────────────────────
-- 1. Actor details: guardian + private profile fields
-- ───────────────────────────────────────────────────────────
ALTER TABLE actor_details
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS appearance_description text,  -- private tier: actor + show teams
  ADD COLUMN IF NOT EXISTS accessibility_needs text,     -- hidden tier: actor only
  ADD COLUMN IF NOT EXISTS dealbreakers text[] NOT NULL DEFAULT '{}'; -- hidden tier

-- Union status was cut from the product (community theatre is ~all non-union)
ALTER TABLE actor_details DROP COLUMN IF EXISTS union_status;

-- ───────────────────────────────────────────────────────────
-- 2. Bucket list shows (up to 5 dream roles, public tier)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bucket_list_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  role text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bucket_list_user ON bucket_list_shows(user_id);

ALTER TABLE bucket_list_shows ENABLE ROW LEVEL SECURITY;

-- Public tier: readable by any signed-in user; writable by owner only
CREATE POLICY "bucket_list_read_authenticated" ON bucket_list_shows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bucket_list_owner_write" ON bucket_list_shows
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────
-- 3. Onboarding step: boolean → enum
-- ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE onboarding_step AS ENUM ('role_select', 'profile', 'complete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_step onboarding_step NOT NULL DEFAULT 'role_select';

-- Backfill from the old boolean, then drop it
UPDATE profiles SET onboarding_step = 'complete' WHERE onboarding_complete = true;
ALTER TABLE profiles DROP COLUMN IF EXISTS onboarding_complete;

-- ───────────────────────────────────────────────────────────
-- 4. Audition signups: acknowledgment fields the modal collects
--    (fixes the known data-loss issue)
-- ───────────────────────────────────────────────────────────
ALTER TABLE audition_signups
  ADD COLUMN IF NOT EXISTS is_member boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mailing_list boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS media_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commitment_acknowledged boolean NOT NULL DEFAULT false;

-- ───────────────────────────────────────────────────────────
-- 5. Org: code of conduct (shown on public theatre page)
-- ───────────────────────────────────────────────────────────
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS code_of_conduct text;

-- ───────────────────────────────────────────────────────────
-- 6. Anonymous read access for public pages
--    Per the access-gating model: shows, theatres, roles, and
--    schedule structure are public broadcasts. People are NEVER
--    anon-readable (no anon policies on profiles/signups/etc).
-- ───────────────────────────────────────────────────────────
CREATE POLICY "orgs_read_anon" ON orgs
  FOR SELECT TO anon USING (true);

CREATE POLICY "shows_read_anon" ON shows
  FOR SELECT TO anon
  USING (status <> 'setup'); -- shows become visible once auditions open

CREATE POLICY "show_roles_read_anon" ON show_roles
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM shows s WHERE s.id = show_roles.show_id AND s.status <> 'setup'
  ));

CREATE POLICY "audition_groups_read_anon" ON audition_groups
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM shows s WHERE s.id = audition_groups.show_id AND s.status <> 'setup'
  ));

-- Public signup COUNT (social proof teaser) without exposing signup rows.
-- SECURITY DEFINER so anon can get the number but never the people.
CREATE OR REPLACE FUNCTION public.get_show_signup_count(p_show_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::integer
  FROM audition_signups
  WHERE show_id = p_show_id AND status <> 'withdrawn';
$$;

GRANT EXECUTE ON FUNCTION public.get_show_signup_count(uuid) TO anon, authenticated;

-- ============================================================================
-- NOTES (no DDL):
-- - Crew credits use the existing production_credits.credit_type column:
--   'performer' = acting credit; anything else (e.g. 'Stage Manager',
--   'Choreographer') is production work. TS CrewCredit.position maps to
--   production_credits.role_name with credit_type = 'crew'.
-- - Column-level privacy (appearance/accessibility/dealbreakers/guardian)
--   continues to be enforced by the API layer per 002's design note;
--   those columns live in actor_details which has owner+show-team row RLS.
-- ============================================================================
