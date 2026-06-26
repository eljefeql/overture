-- ============================================================================
-- Overture 2.0 — Migration 007: theatre profile depth (Sprint D, Phase 2)
-- ============================================================================
-- Reputation surface for the public theatre page: founding/mission/socials on
-- orgs, plus venues, leadership, and a photo gallery. All reads are public;
-- writes are restricted to the org's owner/admins via is_org_admin() (002).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- Until pasted, the app degrades gracefully (mock mode locally; cloud reads of
-- the new tables are wrapped so a missing-table error returns [] not a crash).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. orgs — new identity columns (code_of_conduct already added in 003)
-- ----------------------------------------------------------------------------
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS founded_year   integer,
  ADD COLUMN IF NOT EXISTS mission        text,
  ADD COLUMN IF NOT EXISTS facebook_url   text,
  ADD COLUMN IF NOT EXISTS instagram_url  text,
  ADD COLUMN IF NOT EXISTS ticketing_url  text;

-- ----------------------------------------------------------------------------
-- 2. venues — spaces (performance / rehearsal / other)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venues (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name                text NOT NULL,
  address             text,
  capacity            integer,
  accessibility_notes text,
  parking_notes       text,
  is_primary          boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venues_org_id_idx ON venues(org_id);

-- Build A: a space type so the public page can group/label spaces.
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS space_type text NOT NULL DEFAULT 'performance';
-- Idempotent check constraint (add once).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_space_type_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_space_type_check
      CHECK (space_type IN ('performance', 'rehearsal', 'other'));
  END IF;
END $$;

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_public_read" ON venues;
CREATE POLICY "venues_public_read" ON venues
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "venues_admin_insert" ON venues;
CREATE POLICY "venues_admin_insert" ON venues
  FOR INSERT TO authenticated WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "venues_admin_update" ON venues;
CREATE POLICY "venues_admin_update" ON venues
  FOR UPDATE TO authenticated USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "venues_admin_delete" ON venues;
CREATE POLICY "venues_admin_delete" ON venues
  FOR DELETE TO authenticated USING (is_org_admin(org_id));

-- ----------------------------------------------------------------------------
-- 3. org_leadership — public "key people" (display entries; may have no account)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_leadership (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  title       text,
  photo_url   text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_leadership_org_id_idx ON org_leadership(org_id);

ALTER TABLE org_leadership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_leadership_public_read" ON org_leadership;
CREATE POLICY "org_leadership_public_read" ON org_leadership
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "org_leadership_admin_insert" ON org_leadership;
CREATE POLICY "org_leadership_admin_insert" ON org_leadership
  FOR INSERT TO authenticated WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "org_leadership_admin_update" ON org_leadership;
CREATE POLICY "org_leadership_admin_update" ON org_leadership
  FOR UPDATE TO authenticated USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "org_leadership_admin_delete" ON org_leadership;
CREATE POLICY "org_leadership_admin_delete" ON org_leadership
  FOR DELETE TO authenticated USING (is_org_admin(org_id));

-- ----------------------------------------------------------------------------
-- 4. org_photos — venue + production gallery (metadata; files in org-media)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  caption       text,
  kind          text NOT NULL DEFAULT 'production' CHECK (kind IN ('venue', 'production')),
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_photos_org_id_idx ON org_photos(org_id);

ALTER TABLE org_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_photos_public_read" ON org_photos;
CREATE POLICY "org_photos_public_read" ON org_photos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "org_photos_admin_insert" ON org_photos;
CREATE POLICY "org_photos_admin_insert" ON org_photos
  FOR INSERT TO authenticated WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "org_photos_admin_update" ON org_photos;
CREATE POLICY "org_photos_admin_update" ON org_photos
  FOR UPDATE TO authenticated USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "org_photos_admin_delete" ON org_photos;
CREATE POLICY "org_photos_admin_delete" ON org_photos
  FOR DELETE TO authenticated USING (is_org_admin(org_id));

-- ----------------------------------------------------------------------------
-- 5. org-media storage bucket (public read; org-admin write)
--    Path convention: `${orgId}/...`  → first folder segment is the org id.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-media', 'org-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public bucket → reads are public by bucket config; no SELECT policy needed.

DROP POLICY IF EXISTS "org_media_admin_write" ON storage.objects;
CREATE POLICY "org_media_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-media'
    AND is_org_admin(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "org_media_admin_update" ON storage.objects;
CREATE POLICY "org_media_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-media'
    AND is_org_admin(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "org_media_admin_delete" ON storage.objects;
CREATE POLICY "org_media_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-media'
    AND is_org_admin(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- 6. org_past_productions — manually-entered history that predates Overture
--    (Build A). Merged with auto-derived past shows on the public page.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_past_productions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  title       text NOT NULL,
  year        integer,
  notes       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_past_productions_org_id_idx ON org_past_productions(org_id);

ALTER TABLE org_past_productions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_past_productions_public_read" ON org_past_productions;
CREATE POLICY "org_past_productions_public_read" ON org_past_productions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "org_past_productions_admin_insert" ON org_past_productions;
CREATE POLICY "org_past_productions_admin_insert" ON org_past_productions
  FOR INSERT TO authenticated WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "org_past_productions_admin_update" ON org_past_productions;
CREATE POLICY "org_past_productions_admin_update" ON org_past_productions
  FOR UPDATE TO authenticated USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "org_past_productions_admin_delete" ON org_past_productions;
CREATE POLICY "org_past_productions_admin_delete" ON org_past_productions
  FOR DELETE TO authenticated USING (is_org_admin(org_id));

-- ============================================================================
-- Done. New tables read empty until you add venues/leadership/photos/past
-- productions from the theatre hub (/org). The public theatre page omits
-- empty sections.
-- ============================================================================
