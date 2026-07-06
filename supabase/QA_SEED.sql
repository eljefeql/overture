-- ============================================================================
-- Overture 2.0 — QA_SEED.sql: staging load-test population
-- ============================================================================
-- Creates 60 dummy ACTORS + 3 dummy THEATRE-MAKERS directly in auth.users so
-- staging has a realistic crowd for QA (signup flows, Discover, audition
-- schedules, casting boards, join/claim flows).
--
--   Actors:  qa.actor.01@overturestage.com … qa.actor.60@overturestage.com
--   Makers:  qa.maker.1@overturestage.com  … qa.maker.3@overturestage.com
--   Shared password for ALL accounts:  OvertureQA2026!
--
-- What each actor gets:
--   · confirmed auth.users row (+ auth.identities row so email/password
--     login works on current GoTrue — manually-inserted users without an
--     identity row can fail to sign in)
--   · profile auto-created by the handle_new_user trigger (reads
--     raw_user_meta_data->>'full_name'), then enriched: pronouns, bio,
--     phone, city/state (Needham/Newton/Natick/Wellesley/Dedham MA),
--     onboarding_step 'complete'
--   · actor_details with varied vocal ranges (Soprano→Bass w/ note ranges),
--     heights 58–76in, age ranges from teens to 70s, dance styles, skills;
--     ~10 with appearance descriptions, a few with accessibility needs or
--     dealbreakers; actors 53–60 are MINORS with guardian name/email/phone
--   · talent_roles 'actor' row
-- Makers get a completed profile but NO org — they exist to test the
-- theatre join / claim / duplicate-prevention flows.
--
-- Idempotent: each account is guarded by WHERE-NOT-EXISTS on its email, so
-- pasting twice adds nothing. Remove everything with QA_TEARDOWN.sql.
--
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- STAGING ONLY — never run against production.
-- ============================================================================

-- crypt()/gen_salt() live in pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  -- 60 actor names — mixed genders and ethnicities. Index = actor number.
  v_names text[] := ARRAY[
    'Abigail Chen',        'Marcus Washington',   'Sofia Ramirez',
    'James O''Brien',      'Priya Patel',         'Daniel Kim',
    'Emily Rosenberg',     'Terrence Jackson',    'Isabella Russo',
    'Liam Murphy',         'Grace Nakamura',      'Andre Thibodeaux',
    'Hannah Goldberg',     'Miguel Santos',       'Charlotte Beaumont',
    'Kwame Osei',          'Natalie Wong',        'Sean Gallagher',
    'Amara Okafor',        'Peter Kowalski',      'Leila Haddad',
    'Tomas Herrera',       'Ruth Abernathy',      'Jin Park',
    'Fiona MacLeod',       'Darnell Brooks',      'Valentina Moretti',
    'Oliver Hutchins',     'Mei-Ling Zhao',       'Samuel Whitfield',
    'Rosa Delgado',        'Ezra Feldman',        'Chloe Bergeron',
    'Malik Johnson',       'Ingrid Larsen',       'Rafael Ortiz',
    'Beatrice Callahan',   'Hiroshi Tanaka',      'Simone Laurent',
    'Gregory Petrov',      'Aisha Rahman',        'Connor Sullivan',
    'Yolanda Vasquez',     'Theo Lindqvist',      'Deborah Ashworth',
    'Ravi Krishnan',       'Margaret Donnelly',   'Elias Vance',
    'Nia Thompson',        'Frank Castellano',    'Wendy Chu',
    'Harold Pemberton',
    -- 53–60: minors (ages 13–17, guardian info attached below)
    'Zoe Martinez',        'Ethan Nguyen',        'Lily Abrams',
    'Jayden Carter',       'Maya Krishnamurthy',  'Owen Fitzgerald',
    'Ava Silverstein',     'Noah Delacroix'
  ];

  v_maker_names text[] := ARRAY['Jordan Ellery', 'Sandra Whitcombe', 'Victor Okonkwo'];

  v_vocal text[] := ARRAY[
    'Soprano (C4–C6)', 'Mezzo-Soprano (A3–A5)', 'Alto (F3–F5)',
    'Tenor (C3–C5)',   'Baritone (G2–G4)',      'Bass (E2–E4)'
  ];

  v_cities text[] := ARRAY['Needham', 'Newton', 'Natick', 'Wellesley', 'Dedham'];

  -- Stored as array LITERALS (cast to text[] at use) because Postgres
  -- multidimensional arrays can't hold ragged rows.
  v_dance text[] := ARRAY[
    '{Ballet,Jazz}', '{Tap}', '{}', '{Hip-Hop}', '{Jazz,Tap,Ballet}', '{Ballroom}'
  ];

  v_skills text[] := ARRAY[
    '{Piano,"Sight-reading"}', '{"Stage combat"}', '{Juggling,Improv}', '{}',
    '{Guitar}', '{Dialects,Improv}', '{Puppetry}', '{Ukulele,Whistling}'
  ];

  -- Adult age-range pairs, cycled. Minors (53–60) are overridden to 13–17.
  v_age_low  integer[] := ARRAY[18, 20, 25, 30, 35, 40, 50, 55, 60, 16];
  v_age_high integer[] := ARRAY[25, 30, 35, 45, 50, 55, 65, 70, 75, 22];

  v_bios text[] := ARRAY[
    'Community theatre regular — happiest in an ensemble number.',
    'Day job in tech, second life on stage. Big Sondheim fan.',
    'Returned to theatre after a long break and never looking back.',
    'Loves character roles, quick changes, and closing-night potlucks.',
    'Trained in college, kept it alive in community productions ever since.',
    'Will audition for anything with a good villain.'
  ];

  v_appearance text[] := ARRAY[
    'Tall with dark curly hair and glasses.',
    'Short salt-and-pepper hair, athletic build.',
    'Long red hair, freckles, reads younger than I am.',
    'Shaved head, full beard, broad-shouldered.',
    'Waist-length braids, warm brown complexion.'
  ];

  v_name  text;
  v_email text;
  v_uid   uuid;
  i       integer;
  v_is_minor boolean;
  v_last  text;
BEGIN
  -- ── 60 actors ──
  FOR i IN 1..60 LOOP
    v_name  := v_names[i];
    v_email := 'qa.actor.' || lpad(i::text, 2, '0') || '@overturestage.com';
    v_is_minor := i >= 53;
    v_last  := split_part(v_name, ' ', 2);

    -- Idempotency guard: skip accounts that already exist.
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      CONTINUE;
    END IF;

    v_uid := gen_random_uuid();

    -- The handle_new_user trigger (migration 001) fires on this insert and
    -- creates the profiles row from raw_user_meta_data->>'full_name'.
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      crypt('OvertureQA2026!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      now(), now(),
      '', '', '', ''
    );

    -- Email identity row — required for password login on current GoTrue.
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid, v_uid::text, 'email',
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );

    -- Enrich the trigger-created profile.
    UPDATE public.profiles SET
      pronouns        = CASE
                          WHEN i IN (9, 33, 44) THEN 'they/them'
                          WHEN i % 2 = 1 THEN 'she/her'
                          ELSE 'he/him'
                        END,
      bio             = v_bios[(i % 6) + 1],
      phone           = '(781) 555-' || lpad(i::text, 4, '0'),
      location_city   = v_cities[(i % 5) + 1],
      location_state  = 'MA',
      travel_radius   = (ARRAY[10, 15, 25])[(i % 3) + 1],
      is_available    = (i % 3 = 0),
      onboarding_step = 'complete'
    WHERE id = v_uid;

    INSERT INTO public.actor_details (
      user_id, height_inches, vocal_range, dance_styles, special_skills,
      age_range_low, age_range_high,
      is_minor, guardian_name, guardian_email, guardian_phone,
      appearance_description, accessibility_needs, dealbreakers
    ) VALUES (
      v_uid,
      58 + ((i * 5) % 19),                                      -- 58–76 in
      v_vocal[(i % 6) + 1],
      v_dance[(i % 6) + 1]::text[],
      v_skills[(i % 8) + 1]::text[],
      CASE WHEN v_is_minor THEN 13 ELSE v_age_low[(i % 10) + 1] END,
      CASE WHEN v_is_minor THEN 17 ELSE v_age_high[(i % 10) + 1] END,
      v_is_minor,
      CASE WHEN v_is_minor THEN 'Pat ' || v_last ELSE NULL END,
      CASE WHEN v_is_minor THEN 'qa.guardian.' || lpad(i::text, 2, '0') || '@overturestage.com' ELSE NULL END,
      CASE WHEN v_is_minor THEN '(617) 555-' || lpad(i::text, 4, '0') ELSE NULL END,
      CASE WHEN i % 6 = 2 THEN v_appearance[((i / 6) % 5) + 1] ELSE NULL END,  -- ~10 actors
      CASE WHEN i % 20 = 5 THEN 'Uses a hearing aid — please face me when giving notes.' ELSE NULL END,
      CASE WHEN i % 20 = 10 THEN ARRAY['No smoking onstage', 'No kissing scenes'] ELSE '{}'::text[] END
    )
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.talent_roles (user_id, role_type)
    VALUES (v_uid, 'actor')
    ON CONFLICT (user_id, role_type) DO NOTHING;
  END LOOP;

  -- ── 3 theatre-makers (completed onboarding, NO org — for join/claim QA) ──
  FOR i IN 1..3 LOOP
    v_name  := v_maker_names[i];
    v_email := 'qa.maker.' || i::text || '@overturestage.com';

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      CONTINUE;
    END IF;

    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      crypt('OvertureQA2026!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid, v_uid::text, 'email',
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );

    UPDATE public.profiles SET
      pronouns        = (ARRAY['they/them', 'she/her', 'he/him'])[i],
      bio             = 'Produces and directs community theatre on the side.',
      location_city   = v_cities[(i % 5) + 1],
      location_state  = 'MA',
      onboarding_step = 'complete'
    WHERE id = v_uid;
    -- Deliberately NO orgs / org_members rows — mirrors the maker onboarding
    -- data shape minus the org, so these accounts can exercise the theatre
    -- join / claim flows from scratch.
  END LOOP;
END $$;

-- ── Verification ──
SELECT
  count(*) FILTER (WHERE email LIKE 'qa.actor.%') AS qa_actors,
  count(*) FILTER (WHERE email LIKE 'qa.maker.%') AS qa_makers
FROM auth.users
WHERE email LIKE 'qa.%@overturestage.com';
