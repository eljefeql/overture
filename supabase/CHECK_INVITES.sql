-- Who was invited recently, and did the person's account email actually match?
-- Run in the PROD SQL editor. "has_account" false with a recent invite = they
-- signed up with a DIFFERENT email than the one invited (nothing can link them).
SELECT
  i.created_at::date          AS invited_on,
  o.name                      AS theatre,
  i.email                     AS invited_email,
  i.invited_name,
  i.status,
  p.email IS NOT NULL         AS has_account,
  p.display_name              AS account_name,
  p.onboarding_step,
  m.role                      AS member_role
FROM org_invites i
JOIN orgs o ON o.id = i.org_id
LEFT JOIN profiles p ON lower(p.email) = lower(i.email)
LEFT JOIN org_members m ON m.org_id = i.org_id AND m.user_id = p.id
ORDER BY i.created_at DESC
LIMIT 20;

-- Theatres created in the last 3 days (a stray "second theatre" an invitee
-- made by mistake shows up here — tell me which and I'll give you the delete).
SELECT o.created_at, o.name, o.city, o.state, p.email AS created_by
FROM orgs o
LEFT JOIN org_members m ON m.org_id = o.id AND m.role = 'owner'
LEFT JOIN profiles p ON p.id = m.user_id
WHERE o.created_at > now() - interval '3 days'
ORDER BY o.created_at DESC;
