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
