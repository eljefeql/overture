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
