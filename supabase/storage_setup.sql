-- ============================================================
-- Storage buckets for profile media (run AFTER real auth lands)
-- photos: headshots + production photos (public-read, owner-write)
-- resumes: PDF resumes (private — actor + show teams via signed URLs)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-write: uploads must live under a folder named by the user's id
CREATE POLICY "photos_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "photos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public bucket → reads are public by bucket config; no SELECT policy needed.

CREATE POLICY "resumes_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Photo metadata (captions, show tags, ordering, headshot flag)
CREATE TABLE IF NOT EXISTS profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'production' CHECK (kind IN ('headshot', 'production')),
  caption text,
  show_title text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos_meta_read" ON profile_photos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "photos_meta_owner_write" ON profile_photos
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
