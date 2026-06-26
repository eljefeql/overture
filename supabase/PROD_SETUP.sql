-- ============================================================================
-- Overture — COMPLETE PRODUCTION SETUP (migrations 001–007 + storage)
-- Paste into a FRESH Supabase project's SQL Editor and Run. Idempotent.
-- Creates all tables, RLS, functions, and storage policies. NO seed/demo data.
-- Prereq: create 3 Storage buckets in the UI first (photos=public,
--         resumes=private, org-media=public) — the bucket INSERTs below
--         then no-op via ON CONFLICT.
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
