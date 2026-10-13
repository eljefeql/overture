-- ============================================================================
-- Overture 2.0 — Migration 023: Supplemental casting calls
-- ============================================================================
-- SUPPLEMENTAL_AND_PRECAST_SPEC.md, Feature 1 (QC item 12) — wave 1.
--
-- A supplemental casting call is a role-scoped mini-audition for a show past
-- auditions_closed (callbacks/casting/cast/archived). It rides the EXISTING
-- audition_groups + audition_signups machinery — a call is simply one or more
-- audition_groups rows flagged `supplemental`, targeting specific roles:
--
--   supplemental            — marks the block as part of a casting call
--   target_role_ids         — the role(s) the call is seeking (uuid[] into
--                             show_roles; roles are removed as they fill)
--   supplemental_note       — optional public note ("seeking a strong tenor")
--   supplemental_closed_at  — null = the call is OPEN (public page reframes,
--                             show reappears on Browse/Discover); set = closed
--
-- Because these are plain audition_groups columns, everything downstream is
-- automatic: signups land in audition_signups and show on the auditions board,
-- the send-reminders cron's T-24h/T-2h audition scan picks the blocks up with
-- no changes, and the existing RLS carries over (anon can read groups of
-- non-setup shows per 003; only the show team can insert/update).
--
-- AUTO-CLOSE: when a targeted (non-ensemble) role gains an ACCEPTED primary
-- assignment, the trigger below removes that role from every open call's
-- target list, and closes the call when no sought roles remain. SECURITY
-- DEFINER because the acceptance is written by the ACTOR, whose RLS cannot
-- update audition_groups. Ensemble/featured_ensemble roles never auto-close —
-- an ensemble pot can always take more members (manual close only).
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run (staging AND prod).

ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS supplemental boolean NOT NULL DEFAULT false;
ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS target_role_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS supplemental_note text;
ALTER TABLE audition_groups
  ADD COLUMN IF NOT EXISTS supplemental_closed_at timestamptz;

-- Fast lookup of shows with an open call (Browse/Discover reappearance).
CREATE INDEX IF NOT EXISTS idx_audition_groups_open_supplemental
  ON audition_groups (show_id)
  WHERE supplemental AND supplemental_closed_at IS NULL;

-- ── Auto-close on offer acceptance ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_supplemental_calls_on_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only an accepted PRIMARY assignment fills a role; understudies/alternates
  -- don't. Ensemble-type roles are pots — they never auto-close a call.
  IF NEW.status = 'accepted'
     AND NEW.assignment_type = 'primary'
     AND NOT EXISTS (
       SELECT 1 FROM show_roles r
       WHERE r.id = NEW.role_id
         AND r.role_type IN ('ensemble', 'featured_ensemble')
     )
  THEN
    UPDATE audition_groups g
    SET target_role_ids = array_remove(g.target_role_ids, NEW.role_id),
        supplemental_closed_at = CASE
          WHEN array_remove(g.target_role_ids, NEW.role_id) = '{}'::uuid[]
            THEN now()
          ELSE g.supplemental_closed_at
        END
    WHERE g.show_id = NEW.show_id
      AND g.supplemental
      AND g.supplemental_closed_at IS NULL
      AND NEW.role_id = ANY (g.target_role_ids);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_supplemental_calls ON cast_assignments;
CREATE TRIGGER trg_close_supplemental_calls
  AFTER INSERT OR UPDATE OF status ON cast_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.close_supplemental_calls_on_acceptance();
-- ============================================================================
-- Overture 2.0 — Migration 024: Already-cast shows (modular adoption)
-- ============================================================================
-- SUPPLEMENTAL_AND_PRECAST_SPEC.md, Feature 2 (QC item 27) — wave 2.
-- Prerequisites: migrations through 023 (needs 011's guest_emails + 020's
-- kind/link_url columns, 015's is_show_manager).
--
-- A theatre that has ALREADY cast a show offline answers one question at
-- create time and gets straight to the Show Hub: bulk-add the cast (role +
-- name + email), batch-send warm invitation emails, publish → status 'cast'.
--
--   1. shows.precast — the create-screen answer ("We've already cast it").
--      Drives the reordered checklist + module-aware subnav. Never changes
--      the status machine: a precast show still travels setup → cast via the
--      existing publish semantics.
--
--   2. cast_assignments grows the GUEST pattern (mirrors show_team_members'
--      guest_name/guest_email — the established "person without an account"
--      shape):
--        actor_id         — now NULLABLE: null = invited by email, no
--                           account yet. Every existing policy keys on
--                           actor_id = auth.uid(), which a NULL never
--                           matches, so guests are visible only to the
--                           people who can already see the show's
--                           assignments (managers + castmates per 019).
--        guest_name       — display name typed by the director
--        guest_email      — the email the invitation goes to; signing up
--                           with it auto-links (claim_cast_assignments)
--        added_directly   — honesty flag: this assignment was entered by
--                           the director (status 'accepted', no offer
--                           dance), not accepted through an Overture offer
--        invited_at       — set when "Review & send invitations" fires;
--                           null = not invited yet (typo protection: rows
--                           NEVER email on save)
--      A CHECK keeps every row attached to someone: actor_id or guest_email.
--
--   3. send_cast_invites(show_id) — the batch "Review & send invitations"
--      confirm. For each un-invited direct-add row:
--        · linked account  → in-app notification (untagged → always emails
--          via the notifications webhook, correct for a transactional
--          invite — same choice as notify_org_invite)
--        · guest           → warm invite email via the guest_emails queue
--          (kind 'cast_invite', delivered by the send-reminders cron ≤15
--          min, idempotent via dedupe_key 'cast_invite:<assignment id>')
--      Marks invited_at either way. Manager-gated; SECURITY DEFINER because
--      guest_emails is service-role-only by design.
--
--   4. claim_cast_assignments() — auto-link at sign-in/sign-up (mirrors
--      claim_volunteer_signups; wired into claimPendingInvites in client.ts
--      alongside claim_org_invites + claim_volunteer_signups). Sets actor_id
--      on guest rows matching the new account's email and tells the show
--      team someone joined. guest_* fields are kept for history (same as
--      volunteer claims).
--
-- Cast visibility note (019): the castmate read policy keys on shows.status
-- IN ('cast','archived'). Precast shows reach 'cast' through the same
-- publishCastList path as everyone else, so published precast casts are
-- visible to production members with no policy change.
--
-- Idempotent — safe to paste more than once.
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run (staging AND prod).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. shows.precast
-- ----------------------------------------------------------------------------
ALTER TABLE shows ADD COLUMN IF NOT EXISTS precast boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. cast_assignments — guest pattern + direct-add honesty flag
-- ----------------------------------------------------------------------------
ALTER TABLE cast_assignments ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE cast_assignments ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE cast_assignments ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE cast_assignments ADD COLUMN IF NOT EXISTS added_directly boolean NOT NULL DEFAULT false;
ALTER TABLE cast_assignments ADD COLUMN IF NOT EXISTS invited_at timestamptz;

-- Every assignment belongs to SOMEONE — a linked account or an invited email.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cast_assignments_actor_or_guest'
      AND conrelid = 'cast_assignments'::regclass
  ) THEN
    ALTER TABLE cast_assignments
      ADD CONSTRAINT cast_assignments_actor_or_guest
      CHECK (actor_id IS NOT NULL OR guest_email IS NOT NULL);
  END IF;
END;
$$;

-- Fast email lookup for the claim function.
CREATE INDEX IF NOT EXISTS idx_cast_assignments_guest_email
  ON cast_assignments (lower(guest_email))
  WHERE actor_id IS NULL AND guest_email IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. send_cast_invites — the batch "Review & send invitations" confirm.
--    Never called on row save; the app calls it ONLY from the explicit
--    confirm button (owner decision: typo protection).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_cast_invites(p_show_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_show_title text;
  v_org_name text;
  v_recipient uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_show_manager(p_show_id) THEN
    RAISE EXCEPTION 'Only the show team or theatre admins can send cast invitations';
  END IF;

  SELECT s.title, o.name INTO v_show_title, v_org_name
    FROM shows s JOIN orgs o ON o.id = s.org_id
   WHERE s.id = p_show_id;
  IF v_show_title IS NULL THEN
    RAISE EXCEPTION 'Show not found';
  END IF;

  FOR v_row IN
    SELECT ca.id, ca.actor_id, ca.guest_name, ca.guest_email, r.name AS role_name
      FROM cast_assignments ca
      JOIN show_roles r ON r.id = ca.role_id
     WHERE ca.show_id = p_show_id
       AND ca.added_directly
       AND ca.invited_at IS NULL
       AND ca.status = 'accepted'
  LOOP
    -- An account may have appeared since the row was added (same re-check
    -- notify_org_invite does) — link it now so the invite lands in-app.
    v_recipient := v_row.actor_id;
    IF v_recipient IS NULL AND v_row.guest_email IS NOT NULL THEN
      SELECT id INTO v_recipient
        FROM profiles WHERE lower(email) = lower(v_row.guest_email);
      IF v_recipient IS NOT NULL THEN
        UPDATE cast_assignments SET actor_id = v_recipient WHERE id = v_row.id;
      END IF;
    END IF;

    IF v_recipient IS NOT NULL THEN
      -- Existing Overture user → in-app notification; email rides the
      -- notifications → send-notification-email webhook (untagged = sent).
      INSERT INTO notifications (user_id, type, title, body, show_title, link_url)
      VALUES (
        v_recipient,
        'cast',
        'You''re in the cast!',
        'You''ve been added to the cast of ' || v_show_title ||
          ' at ' || coalesce(v_org_name, 'the theatre') ||
          coalesce(' as ' || v_row.role_name, '') ||
          '. Find your schedule and announcements in My Shows.',
        v_show_title,
        '/my-shows'
      );
    ELSIF v_row.guest_email IS NOT NULL THEN
      -- No account yet → queue a warm invite email. Sent by the
      -- send-reminders cron via Resend (≤15 min); dedupe_key makes repeat
      -- sends harmless.
      INSERT INTO guest_emails
        (to_email, to_name, subject, body, show_title, kind, link_url, dedupe_key)
      VALUES (
        lower(btrim(v_row.guest_email)),
        nullif(btrim(coalesce(v_row.guest_name, '')), ''),
        'You''ve been added to the cast of ' || v_show_title,
        'Congratulations! You''ve been added to the cast of ' || v_show_title ||
          ' at ' || coalesce(v_org_name, 'the theatre') ||
          coalesce(' as ' || v_row.role_name, '') ||
          '. Create your free Overture account with this email address and' ||
          ' you''ll be connected to the show automatically — your schedule,' ||
          ' announcements, and castmates all in one place.',
        v_show_title,
        'cast_invite',
        '/signup?next=/my-shows',
        'cast_invite:' || v_row.id
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    ELSE
      CONTINUE; -- nothing to send to (shouldn't happen under the CHECK)
    END IF;

    UPDATE cast_assignments SET invited_at = now() WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_cast_invites(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. claim_cast_assignments — auto-link at sign-in/sign-up (email match).
--    Mirrors claim_volunteer_signups; guest_* kept for history.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_cast_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_name text;
  v_row record;
  v_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;
  SELECT email, display_name INTO v_email, v_name
    FROM profiles WHERE id = v_user;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT ca.id, ca.show_id, s.title AS show_title
      FROM cast_assignments ca
      JOIN shows s ON s.id = ca.show_id
     WHERE ca.actor_id IS NULL
       AND lower(ca.guest_email) = lower(v_email)
  LOOP
    UPDATE cast_assignments SET actor_id = v_user WHERE id = v_row.id;
    v_count := v_count + 1;

    -- Tell the show team their cast member joined — best-effort.
    BEGIN
      INSERT INTO notifications (user_id, type, title, body, show_title, link_url)
      SELECT tm.user_id, 'system',
             'Cast member joined',
             coalesce(nullif(v_name, ''), v_email) ||
               ' created their account and is now connected to ' ||
               v_row.show_title || '.',
             v_row.show_title,
             '/shows/' || v_row.show_id || '/hub'
        FROM show_team_members tm
       WHERE tm.show_id = v_row.show_id
         AND tm.user_id IS NOT NULL
         AND tm.user_id <> v_user;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_cast_assignments() TO authenticated;
