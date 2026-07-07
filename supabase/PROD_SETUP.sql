-- ============================================================================
-- Overture — COMPLETE PRODUCTION SETUP (migrations 001–015 + storage)
-- Regenerated 2026-07-07. Paste into a FRESH Supabase project. Idempotent.
-- Prereq: create Storage buckets in the UI first: photos (public),
--         resumes (private), org-media (public). show-files is created by 010.
-- ============================================================================

-- ░░░░░░░░░░ 001_initial_schema.sql ░░░░░░░░░░

-- ============================================================================
-- Overture 2.0 — Initial Schema Migration
-- ============================================================================
--
-- This is the foundational schema for the Overture community theatre
-- casting and talent management application.
--
-- NOTES:
-- - RLS (Row Level Security) policies are defined in a separate migration file.
-- - Seed data is defined in a separate migration file.
-- - Address fields were intentionally omitted from profiles for privacy.
--   City/state is sufficient for discovery radius; full addresses are not stored.
-- - The "Chris Rule": application logic enforces that a user cannot be both a
--   show_team_member AND have an audition_signup for the same show. This is
--   enforced at the application layer, not via database constraint, because
--   cross-table constraints require triggers and the rule may evolve.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Org roles
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');

-- Department categories (stable enum, specific role titles are freetext)
CREATE TYPE department AS ENUM (
  'creative', 'music', 'stage_management', 'design',
  'technical', 'production', 'crew', 'front_of_house',
  'marketing', 'administration'
);

-- Talent role types for discoverability
CREATE TYPE talent_role_type AS ENUM (
  'actor', 'director', 'music_director', 'choreographer',
  'scenic_designer', 'costume_designer', 'lighting_designer',
  'sound_designer', 'stage_manager', 'accompanist',
  'producer', 'technical_director', 'general'
);

-- Show status lifecycle
CREATE TYPE show_status AS ENUM (
  'setup', 'auditions_open', 'auditions_closed',
  'callbacks', 'casting', 'cast', 'archived'
);

-- Show type
CREATE TYPE show_type AS ENUM ('musical', 'play', 'revue');

-- Role types for characters
CREATE TYPE role_type AS ENUM ('lead', 'supporting', 'featured_ensemble', 'ensemble');

-- Gender requirement for casting
CREATE TYPE gender_req AS ENUM ('any', 'male', 'female', 'non_binary');

-- Audition signup status
CREATE TYPE signup_status AS ENUM (
  'signed_up', 'checked_in', 'auditioned', 'shortlisted',
  'callback', 'offered', 'cast', 'released', 'withdrawn'
);

-- Callback status
CREATE TYPE callback_status AS ENUM (
  'pending', 'notified', 'accepted', 'declined', 'no_response'
);

-- Cast offer status
CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'accepted', 'declined', 'withdrawn');

-- Assignment type
CREATE TYPE assignment_type AS ENUM ('primary', 'alternate', 'understudy');

-- Union status
CREATE TYPE union_status AS ENUM ('non_union', 'aea', 'sag_aftra', 'aea_sag');

-- Notification type
CREATE TYPE notification_type AS ENUM ('callback', 'endorsement', 'kudos', 'cast', 'system');

-- Org invite status
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');


-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. profiles
-- Synced from auth.users via trigger. Universal fields for ALL users.
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  pronouns text,
  bio text,
  phone text,
  location_city text,
  location_state text,
  travel_radius integer,
  is_available boolean NOT NULL DEFAULT false,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. talent_roles
-- What roles a person can fill (for discoverability). One person can have many.
CREATE TABLE talent_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_type talent_role_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_type)
);

-- 3. actor_details
-- Acting-specific fields. Only for people who act.
CREATE TABLE actor_details (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  height_inches numeric,
  vocal_range text,
  dance_styles text[] NOT NULL DEFAULT '{}',
  special_skills text[] NOT NULL DEFAULT '{}',
  age_range_low integer,
  age_range_high integer,
  is_minor boolean NOT NULL DEFAULT false,
  guardian_email text,
  union_status union_status NOT NULL DEFAULT 'non_union',
  resume_pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. actor_measurements
-- Costuming measurements. Separate table, not nested JSON.
CREATE TABLE actor_measurements (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  head_inches numeric,
  neck_inches numeric,
  shoulders_inches numeric,
  chest_inches numeric,
  underbust_inches numeric,
  waist_inches numeric,
  hips_inches numeric,
  inseam_inches numeric,
  outseam_inches numeric,
  sleeve_inches numeric,
  rise_inches numeric,
  shoe_size text,
  hat_size text,
  jacket_dress_size text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. training
-- Training/education records. For all talent, not just actors.
CREATE TABLE training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution text NOT NULL,
  description text NOT NULL,
  years text,
  sort_order integer NOT NULL DEFAULT 0
);

-- 6. awards
-- Awards/recognition. For all talent.
CREATE TABLE awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  organization text NOT NULL,
  year integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- 7. orgs
-- Theatre organizations.
CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  description text,
  city text,
  state text,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. org_members
-- Who belongs to which theatre and with what role.
CREATE TABLE org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- 9. org_invites
-- Pending invitations to join a theatre.
CREATE TABLE org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  role org_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

-- 10. org_agreements
-- Theatre-configurable terms/commitments for cast offers.
CREATE TABLE org_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  label text NOT NULL,
  body text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

-- 11. shows
-- Productions.
CREATE TABLE shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  title text NOT NULL,
  author_info text,
  show_type show_type NOT NULL DEFAULT 'musical',
  season text,
  status show_status NOT NULL DEFAULT 'setup',
  poster_url text,
  audition_start date,
  audition_end date,
  callback_date date,
  callback_start_time timestamptz,
  callback_end_time timestamptz,
  rehearsal_start date,
  show_open date,
  show_close date,
  audition_location text,
  audition_notes text,
  callback_location text,
  callback_notes text,
  performance_location text,
  callback_contact_name text,
  callback_contact_phone text,
  city text NOT NULL,
  state text NOT NULL,
  is_promoted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. show_roles
-- Characters/roles within a show.
CREATE TABLE show_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_type role_type NOT NULL DEFAULT 'ensemble',
  gender gender_req,
  age_range text,
  vocal_range text,
  description text,
  sort_order integer NOT NULL DEFAULT 0
);

-- 13. show_team_members
-- One row per person per show (permissions live here).
CREATE TABLE show_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  guest_name text,
  guest_email text,
  can_evaluate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(show_id, user_id),
  CONSTRAINT team_member_identity CHECK (
    (user_id IS NOT NULL) OR (guest_name IS NOT NULL)
  )
);

-- 14. show_team_roles
-- Role assignments for team members (one person can have multiple roles).
CREATE TABLE show_team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES show_team_members(id) ON DELETE CASCADE,
  department department NOT NULL,
  role_title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- 15. audition_groups
-- Scheduled timeslots.
CREATE TABLE audition_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  slot_count integer NOT NULL DEFAULT 10,
  sort_order integer NOT NULL DEFAULT 0
);

-- 16. audition_signups
-- Actor signs up for an audition.
CREATE TABLE audition_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES audition_groups(id) ON DELETE SET NULL,
  slot_position integer,
  roles_interested uuid[] NOT NULL DEFAULT '{}',
  open_to_other boolean NOT NULL DEFAULT true,
  will_crew boolean NOT NULL DEFAULT false,
  conflicts text,
  status signup_status NOT NULL DEFAULT 'signed_up',
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(show_id, actor_id)
);

-- 17. team_notes
-- Production team notes about an actor.
CREATE TABLE team_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 18. callbacks
-- Callback invitations.
CREATE TABLE callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES show_roles(id) ON DELETE CASCADE,
  status callback_status NOT NULL DEFAULT 'pending',
  notified_at timestamptz,
  responded_at timestamptz,
  prep_notes text
);

-- 19. cast_assignments
-- Casting decisions and offers.
CREATE TABLE cast_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES show_roles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_type assignment_type NOT NULL DEFAULT 'primary',
  status offer_status NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 20. offer_agreement_responses
-- Records which agreements an actor accepted when accepting a cast offer.
CREATE TABLE offer_agreement_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cast_assignment_id uuid NOT NULL REFERENCES cast_assignments(id) ON DELETE CASCADE,
  agreement_id uuid NOT NULL REFERENCES org_agreements(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cast_assignment_id, agreement_id)
);

-- 21. production_credits
-- Past production history for any talent.
CREATE TABLE production_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  show_title text NOT NULL,
  role_name text NOT NULL,
  theatre_name text NOT NULL,
  year integer NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  org_id uuid REFERENCES orgs(id) ON DELETE SET NULL,
  credit_type text NOT NULL DEFAULT 'performer',
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 22. kudos
-- Testimonials/quotes linked to production credits.
CREATE TABLE kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES production_credits(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quote text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 23. endorsements
-- Peer endorsements/badges.
CREATE TABLE endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endorser_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  show_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 24. notifications
-- Real notification storage.
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  show_title text,
  link_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

-- Org members
CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);

-- Shows
CREATE INDEX idx_shows_org ON shows(org_id);
CREATE INDEX idx_shows_status ON shows(status);

-- Show team
CREATE INDEX idx_show_team_members_show ON show_team_members(show_id);
CREATE INDEX idx_show_team_members_user ON show_team_members(user_id);
CREATE INDEX idx_show_team_roles_member ON show_team_roles(team_member_id);

-- Auditions
CREATE INDEX idx_audition_groups_show ON audition_groups(show_id);
CREATE INDEX idx_audition_signups_show ON audition_signups(show_id);
CREATE INDEX idx_audition_signups_actor ON audition_signups(actor_id);

-- Callbacks
CREATE INDEX idx_callbacks_show ON callbacks(show_id);
CREATE INDEX idx_callbacks_actor ON callbacks(actor_id);

-- Cast assignments
CREATE INDEX idx_cast_assignments_show ON cast_assignments(show_id);
CREATE INDEX idx_cast_assignments_actor ON cast_assignments(actor_id);

-- Team notes
CREATE INDEX idx_team_notes_show_actor ON team_notes(show_id, actor_id);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;

-- Talent discovery
CREATE INDEX idx_talent_roles_type ON talent_roles(role_type);
CREATE INDEX idx_profiles_available ON profiles(is_available) WHERE is_available = true;
CREATE INDEX idx_profiles_location ON profiles(location_state, location_city);

-- Production credits
CREATE INDEX idx_production_credits_user ON production_credits(user_id);
CREATE INDEX idx_endorsements_actor ON endorsements(actor_id);
CREATE INDEX idx_kudos_credit ON kudos(credit_id);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON actor_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON actor_measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cast_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ░░░░░░░░░░ 002_rls_policies.sql ░░░░░░░░░░

-- ============================================================================
-- Overture 2.0 — Row Level Security Policies
-- ============================================================================
--
-- This migration enables RLS on every table and defines granular access
-- policies based on user role (actor vs. production team) and relationship
-- to data (own profile, own org, own show, etc.).
--
-- IMPORTANT — Column-level privacy note:
-- RLS operates at the ROW level, not the column level. For tables where
-- certain columns are private (profiles.phone, profiles.email,
-- actor_measurements.*), RLS alone cannot hide individual columns.
-- The API layer (PostgREST / Supabase client) must select only the
-- appropriate columns based on context. The RLS policies here control
-- WHO can see rows; the API layer controls WHICH columns are returned.
-- For profiles, we grant full row SELECT to all authenticated users and
-- rely on the API to exclude phone/email except when the viewer is the
-- user themselves or a production team member for a show the actor
-- signed up for. The helper function actor_signed_up_for_show() is
-- available for the API layer to make this determination.
-- ============================================================================


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- 1. Is the current user an admin or owner of the given org?
CREATE OR REPLACE FUNCTION is_org_admin(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
  );
$$;

-- 2. Is the current user any member of the given org?
CREATE OR REPLACE FUNCTION is_org_member(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid
      AND user_id = auth.uid()
  );
$$;

-- 3. Is the current user a show_team_member for the given show?
CREATE OR REPLACE FUNCTION is_show_team(show_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM show_team_members
    WHERE show_id = show_uuid
      AND user_id = auth.uid()
  );
$$;

-- 4. Has the given actor signed up for the given show?
CREATE OR REPLACE FUNCTION actor_signed_up_for_show(actor_uuid uuid, show_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM audition_signups
    WHERE show_id = show_uuid
      AND actor_id = actor_uuid
  );
$$;

-- Helper: get the org_id for a given show
CREATE OR REPLACE FUNCTION show_org_id(show_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM shows WHERE id = show_uuid;
$$;


-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_details           ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_measurements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE training                ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_agreements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_team_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audition_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audition_signups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE callbacks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cast_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_agreement_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_credits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE endorsements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- PROFILES
-- ============================================================================
-- Column-level privacy (phone, email) is enforced at the API layer.
-- RLS grants row-level access; the API must omit private columns for
-- non-authorized viewers. See note at top of file.

CREATE POLICY "Anyone authenticated can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No INSERT policy: profiles are created by the handle_new_user() trigger
-- (SECURITY DEFINER), not by users directly.

-- No DELETE policy: profiles are cascade-deleted when auth.users row is removed.


-- ============================================================================
-- TALENT ROLES
-- ============================================================================

CREATE POLICY "Anyone authenticated can read talent roles"
  ON talent_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own talent roles"
  ON talent_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own talent roles"
  ON talent_roles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own talent roles"
  ON talent_roles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- ACTOR DETAILS
-- ============================================================================
-- All fields are publicly readable except measurements (separate table).
-- guardian_email is in this table — the API layer should treat it as private.

CREATE POLICY "Anyone authenticated can read actor details"
  ON actor_details FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own actor details"
  ON actor_details FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own actor details"
  ON actor_details FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================================
-- ACTOR MEASUREMENTS
-- ============================================================================
-- Measurements are PRIVATE. Only visible to:
--   (a) the user themselves
--   (b) show team members for shows the actor signed up for

CREATE POLICY "Users can read own measurements"
  ON actor_measurements FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Show team can read measurements for their actors"
  ON actor_measurements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      JOIN show_team_members stm ON stm.show_id = s.show_id
      WHERE s.actor_id = actor_measurements.user_id
        AND stm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own measurements"
  ON actor_measurements FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own measurements"
  ON actor_measurements FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================================
-- TRAINING
-- ============================================================================

CREATE POLICY "Anyone authenticated can read training"
  ON training FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own training"
  ON training FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own training"
  ON training FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own training"
  ON training FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- AWARDS
-- ============================================================================

CREATE POLICY "Anyone authenticated can read awards"
  ON awards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own awards"
  ON awards FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own awards"
  ON awards FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own awards"
  ON awards FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- ORGS
-- ============================================================================

CREATE POLICY "Anyone authenticated can read orgs"
  ON orgs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Any authenticated user can create an org"
  ON orgs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only org owners can update org details"
  ON orgs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = orgs.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = orgs.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );


-- ============================================================================
-- ORG MEMBERS
-- ============================================================================

CREATE POLICY "Org members can see members of their org"
  ON org_members FOR SELECT
  TO authenticated
  USING (is_org_member(org_id));

CREATE POLICY "Org admins can invite new members"
  ON org_members FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Org owners can update member roles"
  ON org_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

CREATE POLICY "Members can leave their org"
  ON org_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- ORG INVITES
-- ============================================================================

CREATE POLICY "Org admins can see invites for their org"
  ON org_invites FOR SELECT
  TO authenticated
  USING (is_org_admin(org_id));

CREATE POLICY "Invited user can see their own invites"
  ON org_invites FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Org admins can create invites"
  ON org_invites FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Org admins can update invites for their org"
  ON org_invites FOR UPDATE
  TO authenticated
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));


-- ============================================================================
-- ORG AGREEMENTS
-- ============================================================================

CREATE POLICY "Anyone authenticated can read org agreements"
  ON org_agreements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Org admins can create agreements"
  ON org_agreements FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Org admins can update agreements"
  ON org_agreements FOR UPDATE
  TO authenticated
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Org admins can delete agreements"
  ON org_agreements FOR DELETE
  TO authenticated
  USING (is_org_admin(org_id));


-- ============================================================================
-- SHOWS
-- ============================================================================

CREATE POLICY "Anyone can read public shows"
  ON shows FOR SELECT
  TO authenticated
  USING (status != 'setup');

CREATE POLICY "Show team can read shows in setup"
  ON shows FOR SELECT
  TO authenticated
  USING (
    status = 'setup'
    AND is_show_team(id)
  );

CREATE POLICY "Org admins can read their shows in setup"
  ON shows FOR SELECT
  TO authenticated
  USING (
    status = 'setup'
    AND is_org_admin(org_id)
  );

CREATE POLICY "Org admins can create shows"
  ON shows FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Show team and org admins can update shows"
  ON shows FOR UPDATE
  TO authenticated
  USING (
    is_show_team(id) OR is_org_admin(org_id)
  )
  WITH CHECK (
    is_show_team(id) OR is_org_admin(org_id)
  );


-- ============================================================================
-- SHOW ROLES (characters)
-- ============================================================================

CREATE POLICY "Anyone authenticated can read show roles"
  ON show_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Show team can create show roles"
  ON show_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_show_team(show_id));

CREATE POLICY "Show team can update show roles"
  ON show_roles FOR UPDATE
  TO authenticated
  USING (is_show_team(show_id))
  WITH CHECK (is_show_team(show_id));

CREATE POLICY "Show team can delete show roles"
  ON show_roles FOR DELETE
  TO authenticated
  USING (is_show_team(show_id));


-- ============================================================================
-- SHOW TEAM MEMBERS
-- ============================================================================
-- Public can see team members (actors see "directed by..." on show pages).
-- Only org admins can add/remove team members.

CREATE POLICY "Anyone authenticated can read show team members"
  ON show_team_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Org admins can add show team members"
  ON show_team_members FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(show_org_id(show_id)));

CREATE POLICY "Org admins can update show team members"
  ON show_team_members FOR UPDATE
  TO authenticated
  USING (is_org_admin(show_org_id(show_id)))
  WITH CHECK (is_org_admin(show_org_id(show_id)));

CREATE POLICY "Org admins can remove show team members"
  ON show_team_members FOR DELETE
  TO authenticated
  USING (is_org_admin(show_org_id(show_id)));


-- ============================================================================
-- SHOW TEAM ROLES
-- ============================================================================
-- Public read (actors see role titles on show pages).

CREATE POLICY "Anyone authenticated can read show team roles"
  ON show_team_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Org admins can manage show team roles"
  ON show_team_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_org_admin(show_org_id(stm.show_id))
    )
  );

CREATE POLICY "Org admins can update show team roles"
  ON show_team_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_org_admin(show_org_id(stm.show_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_org_admin(show_org_id(stm.show_id))
    )
  );

CREATE POLICY "Org admins can delete show team roles"
  ON show_team_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_org_admin(show_org_id(stm.show_id))
    )
  );


-- ============================================================================
-- AUDITION GROUPS
-- ============================================================================

CREATE POLICY "Anyone authenticated can read audition groups"
  ON audition_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Show team can create audition groups"
  ON audition_groups FOR INSERT
  TO authenticated
  WITH CHECK (is_show_team(show_id));

CREATE POLICY "Show team can update audition groups"
  ON audition_groups FOR UPDATE
  TO authenticated
  USING (is_show_team(show_id))
  WITH CHECK (is_show_team(show_id));

CREATE POLICY "Show team can delete audition groups"
  ON audition_groups FOR DELETE
  TO authenticated
  USING (is_show_team(show_id));


-- ============================================================================
-- AUDITION SIGNUPS
-- ============================================================================

CREATE POLICY "Actors can see their own signups"
  ON audition_signups FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "Show team can see signups for their show"
  ON audition_signups FOR SELECT
  TO authenticated
  USING (is_show_team(show_id));

CREATE POLICY "Actors can sign up for auditions"
  ON audition_signups FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Actors can update own signup"
  ON audition_signups FOR UPDATE
  TO authenticated
  USING (actor_id = auth.uid())
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Show team can update signup status"
  ON audition_signups FOR UPDATE
  TO authenticated
  USING (is_show_team(show_id))
  WITH CHECK (is_show_team(show_id));


-- ============================================================================
-- TEAM NOTES
-- ============================================================================
-- Only show team members can read/write notes for their show.

CREATE POLICY "Show team can read notes for their show"
  ON team_notes FOR SELECT
  TO authenticated
  USING (is_show_team(show_id));

CREATE POLICY "Show team can create notes for their show"
  ON team_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    is_show_team(show_id)
    AND author_id = auth.uid()
  );

CREATE POLICY "Note author can update their own notes"
  ON team_notes FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() AND is_show_team(show_id))
  WITH CHECK (author_id = auth.uid() AND is_show_team(show_id));

CREATE POLICY "Note author can delete their own notes"
  ON team_notes FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() AND is_show_team(show_id));


-- ============================================================================
-- CALLBACKS
-- ============================================================================

CREATE POLICY "Actors can see their own callbacks"
  ON callbacks FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "Show team can see callbacks for their show"
  ON callbacks FOR SELECT
  TO authenticated
  USING (is_show_team(show_id));

CREATE POLICY "Show team can create callbacks"
  ON callbacks FOR INSERT
  TO authenticated
  WITH CHECK (is_show_team(show_id));

CREATE POLICY "Show team can update callbacks"
  ON callbacks FOR UPDATE
  TO authenticated
  USING (is_show_team(show_id))
  WITH CHECK (is_show_team(show_id));


-- ============================================================================
-- CAST ASSIGNMENTS
-- ============================================================================

CREATE POLICY "Actors can see their own cast assignments"
  ON cast_assignments FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "Show team can see assignments for their show"
  ON cast_assignments FOR SELECT
  TO authenticated
  USING (is_show_team(show_id));

CREATE POLICY "Show team can create cast assignments"
  ON cast_assignments FOR INSERT
  TO authenticated
  WITH CHECK (is_show_team(show_id));

CREATE POLICY "Show team can update cast assignments"
  ON cast_assignments FOR UPDATE
  TO authenticated
  USING (is_show_team(show_id))
  WITH CHECK (is_show_team(show_id));


-- ============================================================================
-- OFFER AGREEMENT RESPONSES
-- ============================================================================

CREATE POLICY "Actor can see own agreement responses"
  ON offer_agreement_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cast_assignments ca
      WHERE ca.id = offer_agreement_responses.cast_assignment_id
        AND ca.actor_id = auth.uid()
    )
  );

CREATE POLICY "Show team can see agreement responses for their show"
  ON offer_agreement_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cast_assignments ca
      WHERE ca.id = offer_agreement_responses.cast_assignment_id
        AND is_show_team(ca.show_id)
    )
  );

CREATE POLICY "Actor can insert agreement response on accept"
  ON offer_agreement_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cast_assignments ca
      WHERE ca.id = offer_agreement_responses.cast_assignment_id
        AND ca.actor_id = auth.uid()
    )
  );


-- ============================================================================
-- PRODUCTION CREDITS
-- ============================================================================

CREATE POLICY "Anyone authenticated can read production credits"
  ON production_credits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own production credits"
  ON production_credits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own production credits"
  ON production_credits FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own production credits"
  ON production_credits FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- KUDOS
-- ============================================================================

CREATE POLICY "Anyone authenticated can read kudos"
  ON kudos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Any authenticated user can create kudos"
  ON kudos FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Author can delete own kudos"
  ON kudos FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());


-- ============================================================================
-- ENDORSEMENTS
-- ============================================================================

CREATE POLICY "Anyone authenticated can read endorsements"
  ON endorsements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Any authenticated user can create endorsements"
  ON endorsements FOR INSERT
  TO authenticated
  WITH CHECK (endorser_id = auth.uid());

CREATE POLICY "Endorser can delete own endorsements"
  ON endorsements FOR DELETE
  TO authenticated
  USING (endorser_id = auth.uid());


-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
-- Only the user can see and manage their own notifications.
-- INSERT is restricted to service role (server-side only) — no user INSERT policy.

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT policy for authenticated users. Notifications are created
-- server-side using the service_role key, which bypasses RLS.
-- No DELETE policy. Notifications are retained for audit purposes.
-- If soft-delete is needed, use the is_read flag or add an is_archived column.

-- ░░░░░░░░░░ 003_v11_delta.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 004_org_founder_policy.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 005_signups_notifications.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 006_org_membership_cloud.sql ░░░░░░░░░░

-- ============================================================================
-- Overture 2.0 — Migration 006: org membership & team cloud plumbing
-- ============================================================================
-- Ships with the theatre-side cloud migration (org identity, invites, teams):
--   1. claim_org_invites()  — invited users can't INSERT org_members or
--      UPDATE org_invites under 002's policies, so acceptance happens in a
--      SECURITY DEFINER RPC called on sign-in / onboarding completion.
--   2. notify_org_invite()  — lets an org admin notify an EXISTING user that
--      they've been invited (create_notification requires a shared show,
--      which doesn't exist yet at invite time).
--   3. Org admins can remove non-owner members (002 only allowed self-leave).
--   4. Org admins can manage show roles + audition slots even when they're
--      not on that show's team (002 was show-team-only).
--   5. create_notification: also allow team→team within the same show
--      (used when someone is added to a production team).
-- ============================================================================

-- ───────────────────────────────────────────────────────────
-- 0. Migration 004 was never applied to the hosted project
--    (verified 2026-06-12: org_has_members() missing, founder
--    org_members INSERT 403s). Included here so one paste fixes
--    theatre-maker onboarding too. Safe to re-run.
-- ───────────────────────────────────────────────────────────
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

DROP POLICY IF EXISTS "Founder can claim empty org as owner" ON org_members;
CREATE POLICY "Founder can claim empty org as owner"
  ON org_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND NOT org_has_members(org_id)
  );

-- ───────────────────────────────────────────────────────────
-- 1. claim_org_invites — accept pending invites for my email
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_org_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_name text;
  v_invite record;
  v_claimed integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, display_name INTO v_email, v_name
  FROM profiles WHERE id = v_user;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_invite IN
    SELECT * FROM org_invites
    WHERE lower(email) = lower(v_email)
      AND status = 'pending'
      AND expires_at > now()
  LOOP
    -- Join the theatre with the invited role (idempotent).
    INSERT INTO org_members (org_id, user_id, role, invited_by)
    VALUES (v_invite.org_id, v_user, v_invite.role, v_invite.invited_by)
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE org_invites SET status = 'accepted' WHERE id = v_invite.id;
    v_claimed := v_claimed + 1;

    -- Tell the inviter their invite was accepted.
    IF v_invite.invited_by IS NOT NULL AND v_invite.invited_by <> v_user THEN
      INSERT INTO notifications (user_id, type, title, body, link_url)
      VALUES (
        v_invite.invited_by,
        'system',
        'Invite Accepted',
        coalesce(nullif(v_name, ''), v_email) || ' joined your theatre.',
        '/org'
      );
    END IF;
  END LOOP;

  -- Tidy up anything past its expiry while we're here.
  UPDATE org_invites
  SET status = 'expired'
  WHERE lower(email) = lower(v_email)
    AND status = 'pending'
    AND expires_at <= now();

  RETURN v_claimed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_org_invites() TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 2. notify_org_invite — in-app ping for invitees who already
--    have an Overture account
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_org_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_recipient uuid;
  v_org_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite FROM org_invites WHERE id = p_invite_id;
  IF v_invite IS NULL OR v_invite.status <> 'pending' THEN
    RETURN;
  END IF;
  IF NOT is_org_admin(v_invite.org_id) THEN
    RAISE EXCEPTION 'Only org admins can send invite notifications';
  END IF;

  SELECT id INTO v_recipient FROM profiles WHERE lower(email) = lower(v_invite.email);
  IF v_recipient IS NULL THEN
    RETURN; -- no account yet; they'll claim the invite at sign-up
  END IF;

  SELECT name INTO v_org_name FROM orgs WHERE id = v_invite.org_id;

  INSERT INTO notifications (user_id, type, title, body, link_url)
  VALUES (
    v_recipient,
    'system',
    'Theatre Invitation',
    'You''ve been invited to join ' || coalesce(v_org_name, 'a theatre') ||
      '. Sign out and back in (or just keep using Overture) — you''ll be added automatically.',
    '/org'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_org_invite(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 3. Org admins can remove non-owner members
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org admins can remove members" ON org_members;
CREATE POLICY "Org admins can remove members"
  ON org_members FOR DELETE
  TO authenticated
  USING (is_org_admin(org_id) AND role <> 'owner');

-- ───────────────────────────────────────────────────────────
-- 4. Org admins can manage show roles + audition slots
--    (002 limited writes to the show team; admins/owners of the
--    producing theatre should always be able to edit setup)
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org admins can manage show roles" ON show_roles;
CREATE POLICY "Org admins can manage show roles"
  ON show_roles FOR ALL
  TO authenticated
  USING (is_org_admin(show_org_id(show_id)))
  WITH CHECK (is_org_admin(show_org_id(show_id)));

DROP POLICY IF EXISTS "Org admins can manage audition groups" ON audition_groups;
CREATE POLICY "Org admins can manage audition groups"
  ON audition_groups FOR ALL
  TO authenticated
  USING (is_org_admin(show_org_id(show_id)))
  WITH CHECK (is_org_admin(show_org_id(show_id)));

-- ───────────────────────────────────────────────────────────
-- 5. create_notification: allow team→team within the same show
--    (e.g. "You've been added to a production team")
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
  -- an actor notifying a team member of a show they're involved in,
  -- a team member notifying a teammate on the same show,
  -- or an org admin of the show's org notifying a team member.
  IF NOT (
    (v_sender_is_team AND v_recipient_involved)
    OR (v_recipient_is_team AND v_sender_involved)
    OR (v_sender_is_team AND v_recipient_is_team)
    OR (v_recipient_is_team AND is_org_admin(show_org_id(p_show_id)))
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

-- ░░░░░░░░░░ 007_theatre_depth.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 008_reminders.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 009_signup_conflicts.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 010_show_hub.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 011_volunteer_guests.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 012_settings_resources.sql ░░░░░░░░░░

-- ============================================================================
-- Overture 2.0 — Migration 012: account settings + resources lead capture
-- ============================================================================
-- Backs the Week 4 batch:
--   1. profiles.notification_prefs — per-category EMAIL toggles (jsonb).
--      Categories: reminders | announcements | offers. In-app notifications
--      are ALWAYS created; prefs only gate email delivery.
--   2. notifications.category — lets the send-notification-email Edge
--      Function know which pref gates a given email. Writers:
--        · send-reminders tags its rows 'reminders'
--        · announce_to_show (replaced below) tags 'announcements'
--        · create_notification (replaced below) tags callback/cast → 'offers'
--      NULL category = uncategorized → always emailed (safe default).
--   3. delete_my_account() — SECURITY DEFINER self-deletion. Removes the
--      auth.users row; profiles (and everything referencing it) cascades
--      per migrations 001+.
--   4. resource_leads — the /resources email-capture list. Anonymous
--      INSERT-only via the submit_resource_lead() RPC (honeypot-checked),
--      same pattern as the volunteer guest RPCs. Nobody can read it from
--      the app (service role / dashboard only).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.notification_prefs — per-category email toggles
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL
  DEFAULT '{"reminders": true, "announcements": true, "offers": true}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. notifications.category — email-gating hint for the pipeline
-- ----------------------------------------------------------------------------
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category text;

-- ----------------------------------------------------------------------------
-- 2a. create_notification — same behavior as migration 006, plus: tag
--     callback/cast notifications with category 'offers' so the email
--     pipeline can honor the "Offers & callbacks" pref.
-- ----------------------------------------------------------------------------
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
  -- an actor notifying a team member of a show they're involved in,
  -- a team member notifying a teammate on the same show,
  -- or an org admin of the show's org notifying a team member.
  IF NOT (
    (v_sender_is_team AND v_recipient_involved)
    OR (v_recipient_is_team AND v_sender_involved)
    OR (v_sender_is_team AND v_recipient_is_team)
    OR (v_recipient_is_team AND is_org_admin(show_org_id(p_show_id)))
  ) THEN
    RAISE EXCEPTION 'Not allowed to notify this user';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, show_title, link_url, category)
  VALUES (
    p_recipient_id, p_type, p_title, p_body, p_show_title, p_link_url,
    CASE WHEN p_type IN ('callback', 'cast') THEN 'offers' ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, notification_type, text, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2b. announce_to_show — same fan-out as migration 010, plus: tag the
--     notifications with category 'announcements' so the email pipeline
--     can honor the "Announcements" pref.
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
    INSERT INTO notifications (user_id, type, title, body, show_title, link_url, category)
    SELECT user_id, 'system', p_title, p_body, p_show_title,
           '/shows/' || v_show_id || '/hub', 'announcements'
    FROM recipients
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.announce_to_show(uuid, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. delete_my_account — self-service account deletion
--    Deleting the auth.users row cascades to profiles (001: profiles.id
--    REFERENCES auth.users ON DELETE CASCADE) and from there through every
--    table that references profiles. Storage objects (photos/resumes) are
--    orphaned, not deleted — acceptable for now, noted in the UI copy.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. resource_leads — /resources email capture (lead magnet list)
--    RLS on with NO policies: the app can never read this table. Writes go
--    through the honeypot-checked RPC below (same low-risk anonymous-write
--    pattern as the approved volunteer guest signup).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  -- Where they signed up from, e.g. 'resources' (future-proofing)
  source text NOT NULL DEFAULT 'resources',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per address — repeat signups are a friendly no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_leads_email
  ON resource_leads (lower(email));

ALTER TABLE resource_leads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.submit_resource_lead(
  p_name text,
  p_email text,
  -- Honeypot: real people never fill this hidden field. Bots do. When it
  -- has content we return quietly WITHOUT storing anything.
  p_website text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(p_website, '') <> '' THEN
    RETURN; -- bot: silent no-op
  END IF;
  IF COALESCE(trim(p_name), '') = '' OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A name and a valid email are required';
  END IF;

  INSERT INTO resource_leads (name, email)
  VALUES (trim(p_name), lower(trim(p_email)))
  ON CONFLICT (lower(email)) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_resource_lead(text, text, text) TO anon, authenticated;

-- ░░░░░░░░░░ 013_signup_names.sql ░░░░░░░░░░

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

-- ░░░░░░░░░░ 014_invite_name.sql ░░░░░░░░░░

-- ============================================================================
-- Overture 2.0 — Migration 014: keep the invitee's name on org invites
-- ============================================================================
-- The invite modal on /org already asks for a name, but org_invites had no
-- column for it — pending rows fell back to the email prefix ("chris" for
-- chris@example.com). This stores what the inviter typed so the members list
-- shows a real name while the invite is pending. Display-only; acceptance
-- still keys off the email, and the invitee's own profile name wins once
-- they join.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include this
-- migration before the production project is set up.
-- ============================================================================

ALTER TABLE public.org_invites
  ADD COLUMN IF NOT EXISTS invited_name text;

-- ░░░░░░░░░░ 015_org_admin_parity.sql ░░░░░░░░░░

-- ============================================================================
-- Overture 2.0 — Migration 015: org owner/admin parity on show-scoped RLS
-- ============================================================================
-- BUG (owner-hit): the APP's access model (`getShowAccess` in
-- src/lib/api/client.ts, documented in CLAUDE.md) lets a user work on a
-- show's production pages when they're on the show team OR an owner/admin
-- of the show's org. But most show-scoped RLS policies from migrations
-- 002/005/009/010 grant only `is_show_team(...)` — so an org owner/admin
-- who isn't on a show's team gets INTO the pages and every list renders
-- empty (the owner saw 0 of 48 audition signups). The app-layer model is
-- the intended one; this migration makes the database agree.
--
-- What this does:
--   1. New helper `is_show_manager(show)` = show team OR org owner/admin
--      of the show's org (reuses is_show_team / is_org_admin / show_org_id
--      from 002 — nothing redundant is created).
--   2. Every policy that granted only `is_show_team` for team-side reads/
--      writes is replaced by an identical policy using `is_show_manager`,
--      covering the SAME verbs. Old policy names are dropped; each block
--      quotes the original policy it replaces.
--   3. show_team_members / show_team_roles management (002 granted it to
--      org admins ONLY) is widened the other direction to is_show_manager,
--      matching the app: the setup page's team section is open to anyone
--      who passes getShowAccess.
--   4. The two SECURITY DEFINER notification RPCs that hard-checked
--      is_show_team internally (create_notification, announce_to_show —
--      latest bodies from migration 012) now treat a show manager as team,
--      so an org admin running callbacks/offers/announcements doesn't hit
--      a second wall behind the RLS one. 012's category tagging is kept.
--
-- What this deliberately does NOT touch (no weakening, no scope creep):
--   · Actor self-access policies (own signups/callbacks/offers/conflicts/
--     absences/reads) — unchanged.
--   · Anonymous read policies (003) and the anon volunteer/lead RPCs.
--   · `is_production_member` reads from 010 — that helper ALREADY includes
--     org owner/admins (verified: 010 §0), so member-read policies need
--     no change and are not duplicated here.
--   · actor_measurements "Show team can read measurements for their
--     actors" (002) — LEFT team-only on purpose: measurements are
--     privacy-tier "actor + production teams", and widening that grant is
--     an owner decision, not a parity fix. (Consequence: an org admin who
--     opens an actor panel sees no measurements.)
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- NOTE: after applying, PROD_SETUP.sql should be regenerated to include
-- this migration before the production project is set up.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Helper: show team member OR owner/admin of the show's org.
--    Mirrors getShowAccess() exactly. Same style as the 002 helpers.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_show_manager(p_show_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_show_team(p_show_id) OR is_org_admin(show_org_id(p_show_id));
$$;

GRANT EXECUTE ON FUNCTION is_show_manager(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. audition_signups (002) — THE owner-hit bug: signups list was empty.
--    Replaces "Show team can see signups for their show" (SELECT) and
--    "Show team can update signup status" (UPDATE). Actor policies
--    ("Actors can see their own signups", "Actors can sign up for
--    auditions", "Actors can update own signup") are untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Show team can see signups for their show" ON audition_signups;
DROP POLICY IF EXISTS "Show managers can see signups for their show" ON audition_signups;
CREATE POLICY "Show managers can see signups for their show"
  ON audition_signups FOR SELECT
  TO authenticated
  USING (is_show_manager(show_id));

DROP POLICY IF EXISTS "Show team can update signup status" ON audition_signups;
DROP POLICY IF EXISTS "Show managers can update signup status" ON audition_signups;
CREATE POLICY "Show managers can update signup status"
  ON audition_signups FOR UPDATE
  TO authenticated
  USING (is_show_manager(show_id))
  WITH CHECK (is_show_manager(show_id));


-- ────────────────────────────────────────────────────────────────────────────
-- 3. signup_conflicts (009) — Conflict Calendar read.
--    Replaces "Show team can read conflicts for their show". The three
--    actor-owned policies from 009 (read/insert/delete own) are untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Show team can read conflicts for their show" ON signup_conflicts;
DROP POLICY IF EXISTS "Show managers can read conflicts for their show" ON signup_conflicts;
CREATE POLICY "Show managers can read conflicts for their show"
  ON signup_conflicts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audition_signups s
      WHERE s.id = signup_id AND is_show_manager(s.show_id)
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 4. callbacks (002 + 005) — full team CRUD becomes manager CRUD.
--    Replaces 002's "Show team can see callbacks for their show" (SELECT),
--    "Show team can create callbacks" (INSERT), "Show team can update
--    callbacks" (UPDATE) and 005's "Show team can delete callbacks"
--    (DELETE). 002's "Actors can see their own callbacks" and 005's
--    "Actors can respond to own callbacks" are untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Show team can see callbacks for their show" ON callbacks;
DROP POLICY IF EXISTS "Show managers can see callbacks for their show" ON callbacks;
CREATE POLICY "Show managers can see callbacks for their show"
  ON callbacks FOR SELECT
  TO authenticated
  USING (is_show_manager(show_id));

DROP POLICY IF EXISTS "Show team can create callbacks" ON callbacks;
DROP POLICY IF EXISTS "Show managers can create callbacks" ON callbacks;
CREATE POLICY "Show managers can create callbacks"
  ON callbacks FOR INSERT
  TO authenticated
  WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "Show team can update callbacks" ON callbacks;
DROP POLICY IF EXISTS "Show managers can update callbacks" ON callbacks;
CREATE POLICY "Show managers can update callbacks"
  ON callbacks FOR UPDATE
  TO authenticated
  USING (is_show_manager(show_id))
  WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "Show team can delete callbacks" ON callbacks;
DROP POLICY IF EXISTS "Show managers can delete callbacks" ON callbacks;
CREATE POLICY "Show managers can delete callbacks"
  ON callbacks FOR DELETE
  TO authenticated
  USING (is_show_manager(show_id));


-- ────────────────────────────────────────────────────────────────────────────
-- 5. cast_assignments (002) — casting board CRUD.
--    Replaces "Show team can see assignments for their show" (SELECT),
--    "Show team can create cast assignments" (INSERT), "Show team can
--    update cast assignments" (UPDATE). 002 defines NO DELETE policy on
--    cast_assignments (the team never had it either) — same verbs only,
--    so none is added. "Actors can see their own cast assignments" (002)
--    and "Actors can respond to own cast offers" (005) are untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Show team can see assignments for their show" ON cast_assignments;
DROP POLICY IF EXISTS "Show managers can see assignments for their show" ON cast_assignments;
CREATE POLICY "Show managers can see assignments for their show"
  ON cast_assignments FOR SELECT
  TO authenticated
  USING (is_show_manager(show_id));

DROP POLICY IF EXISTS "Show team can create cast assignments" ON cast_assignments;
DROP POLICY IF EXISTS "Show managers can create cast assignments" ON cast_assignments;
CREATE POLICY "Show managers can create cast assignments"
  ON cast_assignments FOR INSERT
  TO authenticated
  WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "Show team can update cast assignments" ON cast_assignments;
DROP POLICY IF EXISTS "Show managers can update cast assignments" ON cast_assignments;
CREATE POLICY "Show managers can update cast assignments"
  ON cast_assignments FOR UPDATE
  TO authenticated
  USING (is_show_manager(show_id))
  WITH CHECK (is_show_manager(show_id));


-- ────────────────────────────────────────────────────────────────────────────
-- 6. offer_agreement_responses (002) — offer-tracker read.
--    Replaces "Show team can see agreement responses for their show".
--    "Actor can see own agreement responses" and "Actor can insert
--    agreement response on accept" are untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Show team can see agreement responses for their show" ON offer_agreement_responses;
DROP POLICY IF EXISTS "Show managers can see agreement responses for their show" ON offer_agreement_responses;
CREATE POLICY "Show managers can see agreement responses for their show"
  ON offer_agreement_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cast_assignments ca
      WHERE ca.id = offer_agreement_responses.cast_assignment_id
        AND is_show_manager(ca.show_id)
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 7. team_notes (002) — read AND authoring extended.
--    team_notes.author_id references profiles (001 §17), NOT
--    show_team_members — no team-member row is required for an author, so
--    authoring by org admins is schema-safe. (Display nuance, app side:
--    getShowRoleTitleMap falls back to labeling unknown authors "director";
--    noted in the migration report, cosmetic only.)
--    Replaces "Show team can read notes for their show" (SELECT), "Show
--    team can create notes for their show" (INSERT, keeps the
--    author_id = auth.uid() requirement), "Note author can update their
--    own notes" (UPDATE) and "Note author can delete their own notes"
--    (DELETE) — the author-only constraint on update/delete is preserved.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Show team can read notes for their show" ON team_notes;
DROP POLICY IF EXISTS "Show managers can read notes for their show" ON team_notes;
CREATE POLICY "Show managers can read notes for their show"
  ON team_notes FOR SELECT
  TO authenticated
  USING (is_show_manager(show_id));

DROP POLICY IF EXISTS "Show team can create notes for their show" ON team_notes;
DROP POLICY IF EXISTS "Show managers can create notes for their show" ON team_notes;
CREATE POLICY "Show managers can create notes for their show"
  ON team_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    is_show_manager(show_id)
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Note author can update their own notes" ON team_notes;
CREATE POLICY "Note author can update their own notes"
  ON team_notes FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() AND is_show_manager(show_id))
  WITH CHECK (author_id = auth.uid() AND is_show_manager(show_id));

DROP POLICY IF EXISTS "Note author can delete their own notes" ON team_notes;
CREATE POLICY "Note author can delete their own notes"
  ON team_notes FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() AND is_show_manager(show_id));


-- ────────────────────────────────────────────────────────────────────────────
-- 8. show_roles + audition_groups — LEAVE (already at parity).
--    002's team-only write policies still exist, but migration 006 §4
--    added "Org admins can manage show roles" and "Org admins can manage
--    audition groups" (FOR ALL, is_org_admin(show_org_id(show_id))) —
--    together they equal is_show_manager. Reads are public-authenticated
--    (002) + anon (003). Nothing to extend; nothing duplicated here.
--
--    shows — LEAVE. "Show team and org admins can update shows" (002)
--    already grants is_show_team(id) OR is_org_admin(org_id) — exact
--    parity. Setup-status reads are likewise already paired ("Show team
--    can read shows in setup" + "Org admins can read their shows in
--    setup"). Left untouched rather than rewritten to the new helper.
-- ────────────────────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────────────────────
-- 9. show_team_members + show_team_roles (002) — management widened the
--    OTHER direction: 002 granted INSERT/UPDATE/DELETE to org admins only,
--    but the app's setup-page team section is open to everyone who passes
--    getShowAccess (team OR org admin), so a plain team member adding a
--    stage manager currently fails at the DB. Replaces "Org admins can
--    add show team members", "Org admins can update show team members",
--    "Org admins can remove show team members" and the three
--    "Org admins can manage/update/delete show team roles" policies.
--    The public-authenticated SELECTs from 002 are untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org admins can add show team members" ON show_team_members;
DROP POLICY IF EXISTS "Show managers can add show team members" ON show_team_members;
CREATE POLICY "Show managers can add show team members"
  ON show_team_members FOR INSERT
  TO authenticated
  WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "Org admins can update show team members" ON show_team_members;
DROP POLICY IF EXISTS "Show managers can update show team members" ON show_team_members;
CREATE POLICY "Show managers can update show team members"
  ON show_team_members FOR UPDATE
  TO authenticated
  USING (is_show_manager(show_id))
  WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "Org admins can remove show team members" ON show_team_members;
DROP POLICY IF EXISTS "Show managers can remove show team members" ON show_team_members;
CREATE POLICY "Show managers can remove show team members"
  ON show_team_members FOR DELETE
  TO authenticated
  USING (is_show_manager(show_id));

DROP POLICY IF EXISTS "Org admins can manage show team roles" ON show_team_roles;
DROP POLICY IF EXISTS "Show managers can manage show team roles" ON show_team_roles;
CREATE POLICY "Show managers can manage show team roles"
  ON show_team_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_show_manager(stm.show_id)
    )
  );

DROP POLICY IF EXISTS "Org admins can update show team roles" ON show_team_roles;
DROP POLICY IF EXISTS "Show managers can update show team roles" ON show_team_roles;
CREATE POLICY "Show managers can update show team roles"
  ON show_team_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_show_manager(stm.show_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_show_manager(stm.show_id)
    )
  );

DROP POLICY IF EXISTS "Org admins can delete show team roles" ON show_team_roles;
DROP POLICY IF EXISTS "Show managers can delete show team roles" ON show_team_roles;
CREATE POLICY "Show managers can delete show team roles"
  ON show_team_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM show_team_members stm
      WHERE stm.id = show_team_roles.team_member_id
        AND is_show_manager(stm.show_id)
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Show Hub tables (010) — team WRITES become manager writes.
--     All `*_member_read` policies use is_production_member, which ALREADY
--     includes org owner/admins (010 §0) — those are LEFT untouched, not
--     duplicated. Member self-writes (rehearsal_absences_own_insert,
--     announcement_reads_own_insert) are LEFT untouched.
-- ────────────────────────────────────────────────────────────────────────────

-- rehearsals: replaces "rehearsals_team_insert" / "rehearsals_team_update"
-- / "rehearsals_team_delete". ("rehearsals_member_read" — LEAVE, see above.)
DROP POLICY IF EXISTS "rehearsals_team_insert" ON rehearsals;
DROP POLICY IF EXISTS "rehearsals_manager_insert" ON rehearsals;
CREATE POLICY "rehearsals_manager_insert" ON rehearsals
  FOR INSERT TO authenticated WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "rehearsals_team_update" ON rehearsals;
DROP POLICY IF EXISTS "rehearsals_manager_update" ON rehearsals;
CREATE POLICY "rehearsals_manager_update" ON rehearsals
  FOR UPDATE TO authenticated
  USING (is_show_manager(show_id)) WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "rehearsals_team_delete" ON rehearsals;
DROP POLICY IF EXISTS "rehearsals_manager_delete" ON rehearsals;
CREATE POLICY "rehearsals_manager_delete" ON rehearsals
  FOR DELETE TO authenticated USING (is_show_manager(show_id));

-- rehearsal_calls: replaces "rehearsal_calls_team_write" (FOR ALL).
-- ("rehearsal_calls_member_read" — LEAVE.)
DROP POLICY IF EXISTS "rehearsal_calls_team_write" ON rehearsal_calls;
DROP POLICY IF EXISTS "rehearsal_calls_manager_write" ON rehearsal_calls;
CREATE POLICY "rehearsal_calls_manager_write" ON rehearsal_calls
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_manager(r.show_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_manager(r.show_id)
  ));

-- rehearsal_call_people: replaces "rehearsal_call_people_team_write" (FOR ALL).
-- ("rehearsal_call_people_member_read" — LEAVE.)
DROP POLICY IF EXISTS "rehearsal_call_people_team_write" ON rehearsal_call_people;
DROP POLICY IF EXISTS "rehearsal_call_people_manager_write" ON rehearsal_call_people;
CREATE POLICY "rehearsal_call_people_manager_write" ON rehearsal_call_people
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_manager(r.show_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rehearsals r WHERE r.id = rehearsal_id AND is_show_manager(r.show_id)
  ));

-- rehearsal_absences: replaces "rehearsal_absences_own_delete" — the
-- member keeps deleting their own absence; the TEAM half of the OR widens
-- to manager (an org admin can clear a stale absence too).
-- ("rehearsal_absences_member_read" + "rehearsal_absences_own_insert" — LEAVE.)
DROP POLICY IF EXISTS "rehearsal_absences_own_delete" ON rehearsal_absences;
CREATE POLICY "rehearsal_absences_own_delete" ON rehearsal_absences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_show_manager(show_id));

-- announcements: replaces "announcements_team_insert" (keeps
-- author_id = auth.uid()), "announcements_team_update",
-- "announcements_team_delete". ("announcements_member_read" — LEAVE.)
DROP POLICY IF EXISTS "announcements_team_insert" ON announcements;
DROP POLICY IF EXISTS "announcements_manager_insert" ON announcements;
CREATE POLICY "announcements_manager_insert" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND is_show_manager(show_id));

DROP POLICY IF EXISTS "announcements_team_update" ON announcements;
DROP POLICY IF EXISTS "announcements_manager_update" ON announcements;
CREATE POLICY "announcements_manager_update" ON announcements
  FOR UPDATE TO authenticated
  USING (is_show_manager(show_id)) WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "announcements_team_delete" ON announcements;
DROP POLICY IF EXISTS "announcements_manager_delete" ON announcements;
CREATE POLICY "announcements_manager_delete" ON announcements
  FOR DELETE TO authenticated USING (is_show_manager(show_id));

-- announcement_reads: replaces "announcement_reads_visible" — the reader
-- keeps seeing their own read row; the receipt view ("read by N of M")
-- widens from team to manager. ("announcement_reads_own_insert" — LEAVE.)
DROP POLICY IF EXISTS "announcement_reads_visible" ON announcement_reads;
CREATE POLICY "announcement_reads_visible" ON announcement_reads
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_id AND is_show_manager(a.show_id)
    )
  );

-- show_files (table): replaces "show_files_team_insert" /
-- "show_files_team_update" / "show_files_team_delete".
-- ("show_files_member_read" on the table — LEAVE.)
DROP POLICY IF EXISTS "show_files_team_insert" ON show_files;
DROP POLICY IF EXISTS "show_files_manager_insert" ON show_files;
CREATE POLICY "show_files_manager_insert" ON show_files
  FOR INSERT TO authenticated WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "show_files_team_update" ON show_files;
DROP POLICY IF EXISTS "show_files_manager_update" ON show_files;
CREATE POLICY "show_files_manager_update" ON show_files
  FOR UPDATE TO authenticated
  USING (is_show_manager(show_id)) WITH CHECK (is_show_manager(show_id));

DROP POLICY IF EXISTS "show_files_team_delete" ON show_files;
DROP POLICY IF EXISTS "show_files_manager_delete" ON show_files;
CREATE POLICY "show_files_manager_delete" ON show_files
  FOR DELETE TO authenticated USING (is_show_manager(show_id));

-- show-files STORAGE bucket: replaces "show_files_team_write" (INSERT) and
-- "show_files_team_delete" (DELETE) on storage.objects.
-- ("show_files_member_read" on storage.objects uses is_production_member — LEAVE.)
DROP POLICY IF EXISTS "show_files_team_write" ON storage.objects;
DROP POLICY IF EXISTS "show_files_manager_write" ON storage.objects;
CREATE POLICY "show_files_manager_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'show-files'
    AND is_show_manager(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "show_files_team_delete" ON storage.objects;
DROP POLICY IF EXISTS "show_files_manager_delete" ON storage.objects;
CREATE POLICY "show_files_manager_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'show-files'
    AND is_show_manager(((storage.foldername(name))[1])::uuid)
  );

-- show_comm_norms: replaces "show_comm_norms_team_write" (FOR ALL).
-- ("show_comm_norms_member_read" — LEAVE.)
DROP POLICY IF EXISTS "show_comm_norms_team_write" ON show_comm_norms;
DROP POLICY IF EXISTS "show_comm_norms_manager_write" ON show_comm_norms;
CREATE POLICY "show_comm_norms_manager_write" ON show_comm_norms
  FOR ALL TO authenticated
  USING (is_show_manager(show_id)) WITH CHECK (is_show_manager(show_id));

-- volunteer_needs: replaces "volunteer_needs_team_write" (FOR ALL).
-- ("volunteer_needs_member_read" — LEAVE.)
DROP POLICY IF EXISTS "volunteer_needs_team_write" ON volunteer_needs;
DROP POLICY IF EXISTS "volunteer_needs_manager_write" ON volunteer_needs;
CREATE POLICY "volunteer_needs_manager_write" ON volunteer_needs
  FOR ALL TO authenticated
  USING (is_show_manager(show_id)) WITH CHECK (is_show_manager(show_id));

-- volunteer_signups: replaces "volunteer_signups_team_write" (FOR ALL —
-- e.g. removing a no-show). ("volunteer_signups_read" already covers the
-- signer + production members — LEAVE. Claims still go through the
-- capacity-checked claim_volunteer_slot RPC, untouched.)
DROP POLICY IF EXISTS "volunteer_signups_team_write" ON volunteer_signups;
DROP POLICY IF EXISTS "volunteer_signups_manager_write" ON volunteer_signups;
CREATE POLICY "volunteer_signups_manager_write" ON volunteer_signups
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM volunteer_needs n WHERE n.id = need_id AND is_show_manager(n.show_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM volunteer_needs n WHERE n.id = need_id AND is_show_manager(n.show_id)
  ));


-- ────────────────────────────────────────────────────────────────────────────
-- 11. create_notification — same body as migration 012 (incl. the 'offers'
--     category tagging), but the SENDER-side team checks now use
--     is_show_manager: an org admin running callback-notify / send-offers
--     was hitting "Not allowed to notify this user" even after the RLS
--     fixes above, because the RPC re-checked show_team_members directly.
--     Recipient-side checks are unchanged (the explicit
--     "recipient_is_team AND is_org_admin" clause from 006 is now
--     subsumed by the manager clause).
-- ────────────────────────────────────────────────────────────────────────────
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
  v_sender_is_manager boolean;
  v_recipient_is_team boolean;
  v_recipient_involved boolean;
  v_sender_involved boolean;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Show team OR org owner/admin of the show's org (parity with the app).
  v_sender_is_manager := is_show_manager(p_show_id);

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

  -- Show manager (team OR org admin) notifying an actor involved in the
  -- show, an actor notifying a team member of a show they're involved in,
  -- or a show manager notifying a team member.
  IF NOT (
    (v_sender_is_manager AND v_recipient_involved)
    OR (v_recipient_is_team AND v_sender_involved)
    OR (v_sender_is_manager AND v_recipient_is_team)
  ) THEN
    RAISE EXCEPTION 'Not allowed to notify this user';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, show_title, link_url, category)
  VALUES (
    p_recipient_id, p_type, p_title, p_body, p_show_title, p_link_url,
    CASE WHEN p_type IN ('callback', 'cast') THEN 'offers' ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, notification_type, text, text, text, text) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 12. announce_to_show — same body as migration 012 (incl. the
--     'announcements' category tagging), but the poster gate widens from
--     is_show_team to is_show_manager so an org admin can post + fan out
--     announcements. Recipient resolution is UNCHANGED: org admins not on
--     the team still don't RECEIVE company/crew announcements (audience
--     semantics, not access — noted in the migration report).
-- ────────────────────────────────────────────────────────────────────────────
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
  IF NOT is_show_manager(v_show_id) THEN
    RAISE EXCEPTION 'Only the show team or theatre admins can post announcements';
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
    INSERT INTO notifications (user_id, type, title, body, show_title, link_url, category)
    SELECT user_id, 'system', p_title, p_body, p_show_title,
           '/shows/' || v_show_id || '/hub', 'announcements'
    FROM recipients
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.announce_to_show(uuid, text, text, text) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- LEAVE-ALONE AUDIT — every remaining policy/function that names
-- is_show_team, and why it stays:
--   · 002 "Show team can read shows in setup" — paired with "Org admins can
--     read their shows in setup"; parity already exists.
--   · 002 "Show team and org admins can update shows" — already
--     is_show_team OR is_org_admin; parity already exists.
--   · 002 show_roles / audition_groups team write policies — 006 §4 added
--     org-admin FOR ALL policies on both; parity already exists.
--   · 002 actor_measurements "Show team can read measurements for their
--     actors" — direct show_team_members join, privacy-tier data; widening
--     is an owner decision (flagged in the report), NOT a parity fix.
--   · 010 is_production_member() — already includes org owner/admins;
--     every *_member_read policy built on it needs no change.
--   · Actor/self policies everywhere, anon read policies (003), volunteer
--     guest RPCs (010/011), get_signup_names (013) — out of scope, no
--     is_show_team-only team grants involved.
-- ============================================================================

-- ░░░░░░░░░░ storage_setup.sql ░░░░░░░░░░

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
