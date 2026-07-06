-- ============================================================================
-- Overture 2.0 — QA_TEARDOWN.sql: remove the QA seed population
-- ============================================================================
-- Deletes every account created by QA_SEED.sql (all qa.*@overturestage.com
-- emails). Deleting the auth.users row cascades through profiles and from
-- there through EVERYTHING that references them (actor_details, talent_roles,
-- signups, callbacks, cast assignments, notifications, …) per the ON DELETE
-- CASCADE chains in migrations 001+. auth.identities cascades from auth.users
-- too.
--
-- Safe to run repeatedly. STAGING ONLY — never run against production.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- ============================================================================

DELETE FROM auth.users
WHERE email LIKE 'qa.%@overturestage.com';

-- ── Verification — both counts should be 0 ──
SELECT
  (SELECT count(*) FROM auth.users    WHERE email LIKE 'qa.%@overturestage.com') AS remaining_auth_users,
  (SELECT count(*) FROM public.profiles WHERE email LIKE 'qa.%@overturestage.com') AS remaining_profiles;
