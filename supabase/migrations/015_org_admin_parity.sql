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
