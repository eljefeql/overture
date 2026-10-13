-- ============================================================================
-- Overture 2.0 — Migration 021: platform admin ("god mode" v1)
-- ============================================================================
-- QC Master List #28 (expanded scope, owner-approved 2026-10-13). Gives the
-- platform owner a /admin directory of every theatre / person / show, plus a
-- small set of guarded repair actions (edit org basics, archive, hard delete,
-- remove a stray membership, delete a user).
--
--   1. platform_admins — SQL-ONLY membership. RLS is on with NO insert /
--      update / delete policies at all: the ONLY way in or out of the admin
--      list is this file or the SQL editor. The single SELECT policy lets a
--      signed-in user see exactly their own row, so the app can ask "am I an
--      admin?" and learn nothing else.
--   2. is_platform_admin() — SECURITY DEFINER exists-check, used by the app
--      (one cheap RPC) and by every policy/function below.
--   3. Admin READ policies (additive) on org_members + shows. profiles and
--      orgs are already readable by every authenticated user (002), so the
--      directory needs nothing new there — deliberately NO new reach into
--      measurements / private-tier data.
--   4. orgs.is_archived — soft-hide for duplicate/abandoned theatres. The
--      app excludes archived orgs from the public surfaces (browse /
--      discover, landing strip, sitemap, public theatre page); nothing is
--      deleted and members still see their own org.
--   5. Admin ACTION functions, each SECURITY DEFINER + is_platform_admin()
--      guard, EXECUTE revoked from anon/public and granted to authenticated:
--        admin_update_org(org_id, name, city, state)  — basic fixes
--        admin_archive_org(org_id, archived)          — soft hide / restore
--        admin_delete_org(org_id)                     — HARD delete, cascades
--        admin_delete_user(user_id)                   — deletes the auth.users
--                                                       row (like
--                                                       delete_my_account, but
--                                                       admin-targeted); a
--                                                       platform admin can
--                                                       NEVER be deleted
--        admin_remove_org_member(member_row_id)       — remove one membership
--
-- GRANTING / REVOKING ADMIN (SQL editor only — there is deliberately no UI):
--
--   Grant:   INSERT INTO public.platform_admins (user_id)
--            VALUES ('<uuid>') ON CONFLICT DO NOTHING;
--   By email: INSERT INTO public.platform_admins (user_id)
--             SELECT id FROM auth.users WHERE lower(email) = lower('<email>')
--             ON CONFLICT (user_id) DO NOTHING;
--   Revoke:  DELETE FROM public.platform_admins WHERE user_id = '<uuid>';
--
-- Pasting this file makes Christopher (the platform owner) the first admin —
-- see the guarded INSERT at the bottom (it no-ops on a project where that
-- uuid doesn't exist; use the by-email grant above instead).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run (staging AND prod).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. platform_admins — SQL-only membership
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- The ONLY policy: see your own row ("am I an admin?"). No INSERT / UPDATE /
-- DELETE policies exist on purpose — membership changes happen in SQL only.
DROP POLICY IF EXISTS "Users can see their own admin row" ON platform_admins;
CREATE POLICY "Users can see their own admin row"
  ON platform_admins FOR SELECT
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. is_platform_admin() — the one check everything else keys off
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
-- anon MUST keep EXECUTE: this function is referenced inside read policies on
-- public tables (shows, org_members), so revoking it from anon breaks every
-- anonymous read with 42501. For anon auth.uid() is null -> always false.
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Admin READ policies (additive — never replace existing ones)
--    profiles + orgs are already authenticated-readable (002); the directory
--    additionally needs every membership row and setup-draft shows.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Platform admins can read all org members" ON org_members;
CREATE POLICY "Platform admins can read all org members"
  ON org_members FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can read all shows" ON shows;
CREATE POLICY "Platform admins can read all shows"
  ON shows FOR SELECT
  USING (is_platform_admin());

-- ----------------------------------------------------------------------------
-- 4. orgs.is_archived — soft-hide a theatre from the public surfaces
-- ----------------------------------------------------------------------------
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 5. Admin ACTION functions
-- ----------------------------------------------------------------------------

-- 5a. Basic fixes: rename / correct city & state. Name only updates when a
--     non-blank value is passed; city/state may be cleared with ''.
CREATE OR REPLACE FUNCTION public.admin_update_org(
  p_org_id uuid,
  p_name text,
  p_city text,
  p_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admins only';
  END IF;

  UPDATE orgs
     SET name = coalesce(nullif(btrim(p_name), ''), name),
         city = nullif(btrim(coalesce(p_city, '')), ''),
         state = nullif(btrim(coalesce(p_state, '')), ''),
         updated_at = now()
   WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_org(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_org(uuid, text, text, text) TO authenticated;

-- 5b. Archive / restore (soft hide from public surfaces; nothing is deleted).
CREATE OR REPLACE FUNCTION public.admin_archive_org(
  p_org_id uuid,
  p_archived boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admins only';
  END IF;

  UPDATE orgs
     SET is_archived = coalesce(p_archived, false),
         updated_at = now()
   WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_org(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_org(uuid, boolean) TO authenticated;

-- 5c. HARD delete a theatre. Cascades per 001: shows, members, invites,
--     venues, photos rows, past productions, signups on its shows, etc.
--     Storage objects (logo / org-media) orphan — same accepted trade-off as
--     delete_my_account. Member ACCOUNTS are untouched.
CREATE OR REPLACE FUNCTION public.admin_delete_org(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admins only';
  END IF;

  DELETE FROM orgs WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_org(uuid) TO authenticated;

-- 5d. Delete a user account — the admin-targeted twin of delete_my_account
--     (012): removes the auth.users row, which cascades to profiles and from
--     there through everything that references profiles. Storage objects
--     orphan. A platform admin can NEVER be deleted this way (revoke their
--     admin row in SQL first if that's really intended).
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admins only';
  END IF;
  IF EXISTS (SELECT 1 FROM platform_admins WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Platform admins can never be deleted';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 5e. Remove one org membership row (e.g. someone stuck in a duplicate org).
CREATE OR REPLACE FUNCTION public.admin_remove_org_member(p_member_row_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admins only';
  END IF;

  DELETE FROM org_members WHERE id = p_member_row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_org_member(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. First admin: Christopher (platform owner). Guarded SELECT so the paste
--    still succeeds on a project where this uuid doesn't exist — grant by
--    email there instead (see the header comment).
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE id = 'd03b6500-86cb-4d47-aac5-cc649f8cac93'
ON CONFLICT (user_id) DO NOTHING;
