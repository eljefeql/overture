-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PASTE_ME_NEXT — Migrations 008 + 009 + 010 + 011 (paste whole file once)║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 008 — reminder engine log                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- Overture 2.0 — Migration 008: reminder engine log
-- ============================================================================
-- Backs the `send-reminders` scheduled Edge Function (supabase/functions/
-- send-reminders). The function scans upcoming audition slots + stale cast
-- offers and inserts notification rows; `reminder_log` is its idempotency
-- ledger — one row per (kind, subject, recipient, window) means each
-- reminder can only ever be sent once, no matter how often the cron runs.
--
-- Written/read ONLY by the Edge Function's service-role client. RLS is on
-- with no policies, so app users can't see or touch it.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What kind of reminder: 'audition_slot' | 'offer_nudge'
  -- (Week 3 adds 'rehearsal' — see the extension point in the function.)
  kind text NOT NULL,
  -- The row the reminder is about (audition_signups.id, cast_assignments.id, …)
  subject_id uuid NOT NULL,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Which reminder window fired: '24h' | '2h' | '48h' …
  "window" text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, subject_id, recipient_id, "window")
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_recipient
  ON reminder_log(recipient_id);

-- RLS on, no policies: service role (Edge Function) only.
ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 009 — structured signup conflicts (Conflict Calendar)      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- Overture 2.0 — Migration 009: structured signup conflicts
-- ============================================================================
-- Backs the Conflict Calendar (/shows/[showId]/conflicts). Actors already
-- enter scheduling conflicts as date RANGES in the audition signup modal;
-- until now those ranges were flattened into the freetext
-- `audition_signups.conflicts` string and the structure was lost. This table
-- keeps each range as real dates so the director's conflict calendar can
-- count unavailable people per day, bucket auditionees by conflict load,
-- and surface problem dates.
--
-- The freetext `conflicts` column is left untouched (display back-compat).
-- Rows are written by the actor at signup; on withdraw + re-signup the old
-- rows are replaced. RLS mirrors audition_signups: the actor owns their own
-- rows (via their signup), the show team can read them for their show.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

CREATE TABLE IF NOT EXISTS signup_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id uuid NOT NULL REFERENCES audition_signups(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_signup_conflicts_signup
  ON signup_conflicts(signup_id);

ALTER TABLE signup_conflicts ENABLE ROW LEVEL SECURITY;

-- Actors own the conflict rows hanging off their own signup.
DROP POLICY IF EXISTS "Actors can read own signup conflicts" ON signup_conflicts;
CREATE POLICY "Actors can read own signup conflicts"
  ON signup_conflicts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND s.actor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Actors can add conflicts to own signup" ON signup_conflicts;
CREATE POLICY "Actors can add conflicts to own signup"
  ON signup_conflicts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND s.actor_id = auth.uid()
    )
  );

-- Delete is needed for the withdraw → re-signup revive path (old ranges are
-- replaced with the fresh ones from the new signup form).
DROP POLICY IF EXISTS "Actors can delete own signup conflicts" ON signup_conflicts;
CREATE POLICY "Actors can delete own signup conflicts"
  ON signup_conflicts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND s.actor_id = auth.uid()
    )
  );

-- Show team reads conflicts for their show (mirrors
-- "Show team can see signups for their show" on audition_signups).
DROP POLICY IF EXISTS "Show team can read conflicts for their show" ON signup_conflicts;
CREATE POLICY "Show team can read conflicts for their show"
  ON signup_conflicts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND is_show_team(s.show_id)
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 010 — Show Hub (rehearsals, announcements, files,          ║
-- ║  comm norms, volunteers)                                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- Overture 2.0 — Migration 010: Show Hub (rehearsals, announcements, files,
-- comm norms, volunteers)
-- ============================================================================
-- Backs the Show Hub (/shows/[showId]/hub) — the post-casting command center.
-- Week 3 of the 30-day plan; spec: SHOW_HUB_SPEC.md (approved 2026-06-12).
--
-- New concept: a "production member" = anyone inside the production —
--   accepted cast (cast_assignments status 'accepted') + show team members
--   + owner/admins of the show's org. Hub content is readable by production
--   members; announcements/schedule/needs are writable by the show team;
--   absences/reads are writable by the member themself.
--
-- Volunteers: TABLES + guest-claim RPC ship now (part 1); the volunteer UI
-- and the public /volunteer/[showId] guest page are part 2. Guest claims go
-- through the SECURITY DEFINER claim_volunteer_slot RPC (anon-safe,
-- capacity-checked); cancellation is via a secure cancel_token (no login).
--
-- Announcement notifications: announce_to_show() fans an announcement out to
-- its targeted production members as `notifications` rows (type 'system') —
-- email delivery then rides the existing send-notification-email pipeline.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper: is the current user a production member of the given show?
--    (accepted cast + show team + org owner/admin) — reuses the existing
--    is_show_team / is_org_admin / show_org_id helpers from migration 002.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_production_member(show_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_show_team(show_uuid)
    OR is_org_admin(show_org_id(show_uuid))
    OR EXISTS (
      SELECT 1 FROM cast_assignments
      WHERE show_id = show_uuid
        AND actor_id = auth.uid()
        AND status = 'accepted'
    );
$$;

-- ----------------------------------------------------------------------------
-- 1. rehearsals — the schedule the SM types once; everything else falls out
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rehearsals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  rehearsal_date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  -- What's being worked, e.g. "Act 1, sc. 3–5" or "Full run — off book"
  focus text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rehearsals_show ON rehearsals(show_id, rehearsal_date);

ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rehearsals_member_read" ON rehearsals;
CREATE POLICY "rehearsals_member_read" ON rehearsals
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "rehearsals_team_insert" ON rehearsals;
CREATE POLICY "rehearsals_team_insert" ON rehearsals
  FOR INSERT TO authenticated WITH CHECK (is_show_team(show_id));

DROP POLICY IF EXISTS "rehearsals_team_update" ON rehearsals;
CREATE POLICY "rehearsals_team_update" ON rehearsals
  FOR UPDATE TO authenticated USING (is_show_team(show_id)) WITH CHECK (is_show_team(show_id));

DROP POLICY IF EXISTS "rehearsals_team_delete" ON rehearsals;
CREATE POLICY "rehearsals_team_delete" ON rehearsals
  FOR DELETE TO authenticated USING (is_show_team(show_id));

-- ----------------------------------------------------------------------------
-- 2. rehearsal_calls — who's called (one row per rehearsal)
--    scope 'everyone' = full company · 'group' = principals/ensemble/crew
--    · 'custom' = picked people (rehearsal_call_people)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rehearsal_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id uuid NOT NULL UNIQUE REFERENCES rehearsals(id) ON DELETE CASCADE,
  called_scope text NOT NULL DEFAULT 'everyone'
    CHECK (called_scope IN ('everyone', 'group', 'custom')),
  -- Only meaningful when called_scope = 'group'
  group_key text CHECK (group_key IN ('principals', 'ensemble', 'crew')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Picked people for called_scope = 'custom'. Keyed to the rehearsal directly
-- (a rehearsal has exactly one call row, so this is equivalent and simpler).
CREATE TABLE IF NOT EXISTS rehearsal_call_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id uuid NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (rehearsal_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rehearsal_call_people_rehearsal
  ON rehearsal_call_people(rehearsal_id);

ALTER TABLE rehearsal_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_call_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rehearsal_calls_member_read" ON rehearsal_calls;
CREATE POLICY "rehearsal_calls_member_read" ON rehearsal_calls
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsals r
    WHERE r.id = rehearsal_id AND is_production_member(r.show_id)
  ));

DROP POLICY IF EXISTS "rehearsal_calls_team_write" ON rehearsal_calls;
CREATE POLICY "rehearsal_calls_team_write" ON rehearsal_calls
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_team(r.show_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_team(r.show_id)
  ));

DROP POLICY IF EXISTS "rehearsal_call_people_member_read" ON rehearsal_call_people;
CREATE POLICY "rehearsal_call_people_member_read" ON rehearsal_call_people
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsals r
    WHERE r.id = rehearsal_id AND is_production_member(r.show_id)
  ));

DROP POLICY IF EXISTS "rehearsal_call_people_team_write" ON rehearsal_call_people;
CREATE POLICY "rehearsal_call_people_team_write" ON rehearsal_call_people
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_team(r.show_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_team(r.show_id)
  ));

-- ----------------------------------------------------------------------------
-- 3. rehearsal_absences — "Can't make it" from the next-call card
--    show_id is denormalized so RLS checks don't need a join.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rehearsal_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id uuid NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rehearsal_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rehearsal_absences_show ON rehearsal_absences(show_id);

ALTER TABLE rehearsal_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rehearsal_absences_member_read" ON rehearsal_absences;
CREATE POLICY "rehearsal_absences_member_read" ON rehearsal_absences
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "rehearsal_absences_own_insert" ON rehearsal_absences;
CREATE POLICY "rehearsal_absences_own_insert" ON rehearsal_absences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_production_member(show_id));

-- Members can withdraw their own absence; the team can clear any.
DROP POLICY IF EXISTS "rehearsal_absences_own_delete" ON rehearsal_absences;
CREATE POLICY "rehearsal_absences_own_delete" ON rehearsal_absences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_show_team(show_id));

-- ----------------------------------------------------------------------------
-- 4. announcements + announcement_reads — the group-text killer
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body_md text NOT NULL,
  -- company = cast + team · cast = accepted cast · principals = accepted cast
  -- in lead/supporting roles · crew = show team · rehearsal = everyone called
  -- to rehearsal_id
  audience text NOT NULL DEFAULT 'company'
    CHECK (audience IN ('company', 'cast', 'principals', 'crew', 'rehearsal')),
  rehearsal_id uuid REFERENCES rehearsals(id) ON DELETE SET NULL,
  pinned boolean NOT NULL DEFAULT false,
  -- "Also email" flag — recorded here; delivery rides the notifications →
  -- send-notification-email pipeline.
  emailed boolean NOT NULL DEFAULT false,
  attachment_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_show ON announcements(show_id, created_at DESC);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement
  ON announcement_reads(announcement_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_member_read" ON announcements;
CREATE POLICY "announcements_member_read" ON announcements
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "announcements_team_insert" ON announcements;
CREATE POLICY "announcements_team_insert" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND is_show_team(show_id));

DROP POLICY IF EXISTS "announcements_team_update" ON announcements;
CREATE POLICY "announcements_team_update" ON announcements
  FOR UPDATE TO authenticated USING (is_show_team(show_id)) WITH CHECK (is_show_team(show_id));

DROP POLICY IF EXISTS "announcements_team_delete" ON announcements;
CREATE POLICY "announcements_team_delete" ON announcements
  FOR DELETE TO authenticated USING (is_show_team(show_id));

-- Reads are visible to the reader themself and to the show team (for the
-- "read by 14 of 18 / who hasn't" receipt view).
DROP POLICY IF EXISTS "announcement_reads_visible" ON announcement_reads;
CREATE POLICY "announcement_reads_visible" ON announcement_reads
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_id AND is_show_team(a.show_id)
    )
  );

DROP POLICY IF EXISTS "announcement_reads_own_insert" ON announcement_reads;
CREATE POLICY "announcement_reads_own_insert" ON announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_id AND is_production_member(a.show_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 5. announce_to_show — fan an announcement out to its audience as
--    notifications rows (SECURITY DEFINER: team→cast AND team→team, which the
--    per-recipient create_notification RPC doesn't allow). Email delivery
--    rides the existing notifications INSERT → send-notification-email hook.
--    Returns the number of people notified (the poster is excluded).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announce_to_show(
  p_announcement_id uuid,
  p_title text,
  p_body text,
  p_show_title text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_show_id uuid;
  v_audience text;
  v_rehearsal_id uuid;
  v_scope text;
  v_group text;
  v_count integer := 0;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT show_id, audience, rehearsal_id
    INTO v_show_id, v_audience, v_rehearsal_id
    FROM announcements WHERE id = p_announcement_id;
  IF v_show_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;
  IF NOT is_show_team(v_show_id) THEN
    RAISE EXCEPTION 'Only the show team can post announcements';
  END IF;

  -- "everyone called to [rehearsal]" resolves through the rehearsal's call.
  IF v_audience = 'rehearsal' AND v_rehearsal_id IS NOT NULL THEN
    SELECT called_scope, group_key INTO v_scope, v_group
      FROM rehearsal_calls WHERE rehearsal_id = v_rehearsal_id;
    v_scope := COALESCE(v_scope, 'everyone');
    IF v_scope = 'everyone' THEN v_audience := 'company';
    ELSIF v_scope = 'group' THEN v_audience := COALESCE(v_group, 'company');
    ELSE v_audience := 'rehearsal_custom';
    END IF;
  ELSIF v_audience = 'rehearsal' THEN
    v_audience := 'company';
  END IF;

  WITH accepted_cast AS (
    SELECT ca.actor_id AS user_id, sr.role_type
    FROM cast_assignments ca
    JOIN show_roles sr ON sr.id = ca.role_id
    WHERE ca.show_id = v_show_id AND ca.status = 'accepted'
  ),
  team AS (
    SELECT user_id FROM show_team_members
    WHERE show_id = v_show_id AND user_id IS NOT NULL
  ),
  recipients AS (
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM accepted_cast
        WHERE v_audience IN ('company', 'cast')
      UNION ALL
      SELECT user_id FROM accepted_cast
        WHERE v_audience = 'principals' AND role_type IN ('lead', 'supporting')
      UNION ALL
      SELECT user_id FROM accepted_cast
        WHERE v_audience = 'ensemble' AND role_type NOT IN ('lead', 'supporting')
      UNION ALL
      SELECT user_id FROM team
        WHERE v_audience IN ('company', 'crew')
      UNION ALL
      SELECT user_id FROM rehearsal_call_people
        WHERE v_audience = 'rehearsal_custom' AND rehearsal_id = v_rehearsal_id
    ) u
    WHERE user_id IS NOT NULL AND user_id <> v_sender
  ),
  inserted AS (
    INSERT INTO notifications (user_id, type, title, body, show_title, link_url)
    SELECT user_id, 'system', p_title, p_body, p_show_title,
           '/shows/' || v_show_id || '/hub'
    FROM recipients
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.announce_to_show(uuid, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. show_files — resources on the show (sides, tracks, run sheets, forms)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS show_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  label text NOT NULL,
  -- Free-text bucket: 'sides' | 'music' | 'schedule' | 'form' | 'other'
  category text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_show_files_show ON show_files(show_id);

ALTER TABLE show_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "show_files_member_read" ON show_files;
CREATE POLICY "show_files_member_read" ON show_files
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "show_files_team_insert" ON show_files;
CREATE POLICY "show_files_team_insert" ON show_files
  FOR INSERT TO authenticated WITH CHECK (is_show_team(show_id));

DROP POLICY IF EXISTS "show_files_team_update" ON show_files;
CREATE POLICY "show_files_team_update" ON show_files
  FOR UPDATE TO authenticated USING (is_show_team(show_id)) WITH CHECK (is_show_team(show_id));

DROP POLICY IF EXISTS "show_files_team_delete" ON show_files;
CREATE POLICY "show_files_team_delete" ON show_files
  FOR DELETE TO authenticated USING (is_show_team(show_id));

-- show-files storage bucket (PRIVATE — reads via signed URLs).
-- Path convention: `${showId}/...` → first folder segment is the show id.
INSERT INTO storage.buckets (id, name, public)
VALUES ('show-files', 'show-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "show_files_member_read" ON storage.objects;
CREATE POLICY "show_files_member_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'show-files'
    AND is_production_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "show_files_team_write" ON storage.objects;
CREATE POLICY "show_files_team_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'show-files'
    AND is_show_team(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "show_files_team_delete" ON storage.objects;
CREATE POLICY "show_files_team_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'show-files'
    AND is_show_team(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- 7. show_comm_norms — "who to contact for what" routing card
--    One row per show; items is a jsonb array of
--    { topic: string, contact: string, method: string } entries.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS show_comm_norms (
  show_id uuid PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE show_comm_norms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "show_comm_norms_member_read" ON show_comm_norms;
CREATE POLICY "show_comm_norms_member_read" ON show_comm_norms
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "show_comm_norms_team_write" ON show_comm_norms;
CREATE POLICY "show_comm_norms_team_write" ON show_comm_norms
  FOR ALL TO authenticated
  USING (is_show_team(show_id)) WITH CHECK (is_show_team(show_id));

-- ----------------------------------------------------------------------------
-- 8. volunteer_needs + volunteer_signups — tables only in part 1
--    (UI + the public /volunteer/[showId] guest page are part 2; the guest
--    page will read needs through a SECURITY DEFINER RPC, so there is no
--    anon read policy here.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteer_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  label text NOT NULL,
  event_date date,
  start_time timestamptz,
  end_time timestamptz,
  slots integer NOT NULL DEFAULT 1 CHECK (slots > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_volunteer_needs_show ON volunteer_needs(show_id);

CREATE TABLE IF NOT EXISTS volunteer_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES volunteer_needs(id) ON DELETE CASCADE,
  -- NULL for community guests (no account required — approved gating exception)
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  guest_name text,
  guest_email text,
  guest_phone text,
  -- Secure token for the no-login cancel link in confirmation emails.
  cancel_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_need ON volunteer_signups(need_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_email ON volunteer_signups(guest_email);

ALTER TABLE volunteer_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "volunteer_needs_member_read" ON volunteer_needs;
CREATE POLICY "volunteer_needs_member_read" ON volunteer_needs
  FOR SELECT TO authenticated USING (is_production_member(show_id));

DROP POLICY IF EXISTS "volunteer_needs_team_write" ON volunteer_needs;
CREATE POLICY "volunteer_needs_team_write" ON volunteer_needs
  FOR ALL TO authenticated
  USING (is_show_team(show_id)) WITH CHECK (is_show_team(show_id));

-- Signups readable by production members and by the signer-upper themself.
DROP POLICY IF EXISTS "volunteer_signups_read" ON volunteer_signups;
CREATE POLICY "volunteer_signups_read" ON volunteer_signups
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM volunteer_needs n
      WHERE n.id = need_id AND is_production_member(n.show_id)
    )
  );

-- The team can manage signups (e.g. remove a no-show). All claims — member
-- and guest — go through the capacity-checked claim_volunteer_slot RPC.
DROP POLICY IF EXISTS "volunteer_signups_team_write" ON volunteer_signups;
CREATE POLICY "volunteer_signups_team_write" ON volunteer_signups
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM volunteer_needs n WHERE n.id = need_id AND is_show_team(n.show_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM volunteer_needs n WHERE n.id = need_id AND is_show_team(n.show_id)
  ));

-- ----------------------------------------------------------------------------
-- 9. claim_volunteer_slot — SECURITY DEFINER claim, anon-safe + capacity-
--    checked (mirrors the get_show_signup_count pattern). Signed-in users
--    claim as themselves; anonymous guests pass name + email (phone optional).
--    Returns the signup's cancel_token — the caller emails it in the
--    confirmation's cancel link.
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
BEGIN
  -- Lock the need row so two simultaneous claims can't oversubscribe.
  SELECT slots INTO v_slots FROM volunteer_needs WHERE id = p_need_id FOR UPDATE;
  IF v_slots IS NULL THEN
    RAISE EXCEPTION 'This volunteer need no longer exists.';
  END IF;

  SELECT count(*) INTO v_taken
    FROM volunteer_signups
    WHERE need_id = p_need_id AND status = 'confirmed';
  IF v_taken >= v_slots THEN
    RAISE EXCEPTION 'All slots for this shift are filled — thank you anyway!';
  END IF;

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
    RETURNING cancel_token INTO v_token;
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

-- Tokened cancel — no login required (the cancel link in the email).
CREATE OR REPLACE FUNCTION public.cancel_volunteer_signup(p_cancel_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE volunteer_signups
     SET status = 'cancelled'
   WHERE cancel_token = p_cancel_token AND status = 'confirmed'
   RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_volunteer_signup(uuid) TO anon, authenticated;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 011 — dual-path volunteers: guest email queue + auto-link  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

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
