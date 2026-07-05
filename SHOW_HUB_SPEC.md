# Show Hub — Week 3 Build Spec (approved 2026-06-12)

*The post-casting command center at `/shows/[id]/hub`. Private to the production (cast with accepted offers + show team + org owner/admins). This is the anti-churn centerpiece: it must beat a group text and a Facebook group. One page, role-aware — cast members get "what do I need to know today" (mobile-first); SM/director get the same page plus compose/manage controls (no separate admin page).*

## Sections (priority order)

1. **Your next call** (personalized anchor) — computed per person: next event they're called to. Date/time, what's being worked, location, **Add to calendar** (.ics — exists), and **"Can't make it"** → files an absence the SM sees. Replaces the 10pm text chain.
2. **Announcements** — the group-text killer. Posts by team members: RichTextEditor/Markdown (exists), optional file attachment, pin. **Targeting**: full company / cast / principals / crew / "everyone called to [rehearsal]". **Read receipts**: "read by 14 of 18", team sees who hasn't. **Email fan-out**: per-post "also email" toggle via Resend. NO replies/threads in V1.
3. **Schedule / This week** — rehearsals: date, time, place, focus ("Act 1, sc. 3–5"), **who's called** (everyone / group / picked people). Per-row conflict count (same data as the Week-2 Conflict Calendar — one engine, two views). Cast report per-rehearsal conflicts here; "conflicts used: 2 of 4" accountability meter. Full-schedule view + subscribable calendar.
4. **People** — cast + team directory (privacy-scoped contact) + **"who to contact for what"** routing card (late → text SM; costumes → email designer).
5. **Resources** — files on the show (sides, tracks, run sheets, forms). Storage bucket per show, existing upload patterns.
6. **Volunteers** — see dual-path model below.

## Volunteers — dual-path model (Chris, 2026-06-12)
- **Company members (signed in):** one-tap slot claim from the hub; feeds their reminders.
- **Community guests (NO account required):** public link → `/volunteer/[showId]` (public route group). Shows the production + needs + open slots. Claim = name + email (phone optional). Confirmation email with shift details + .ics + **secure tokened cancel link** (no login to cancel). Same 24h shift reminder emails.
- **Optional account upsell** — after signup + a quiet link in reminder emails ("track your signups / hear when [theatre] needs help"). Never a wall. If they later create an account with the same email, guest signups **auto-link** (same email-matching pattern as team invites).
- **This is a deliberate, approved exception** to the access-gating "actions require accounts" rule — volunteering is low-risk and the guest path is the growth loop (community members become warm contacts receiving Overture emails).
- Implementation note: guest claims via SECURITY DEFINER RPC (anon-safe, capacity-checked), mirroring get_show_signup_count's pattern; guest rows use user_id-nullable + guest_name/guest_email like show_team_members.

## Reminder engine
One scheduled Supabase Edge Function (cron) scans upcoming events → inserts notification rows → existing pipeline delivers in-app + email (Resend). Rules: rehearsals T-24h + morning-of **to called people only**; audition slots T-24h + T-2h; offer-response deadline nudges; announcement email fan-out; volunteer shift T-24h (works for guests via email). User preferences: per-channel toggle, digest vs instant (settings page ties in). Nobody enters extra data — reminders fall out of the schedule the SM already typed.

## New schema (≈6 tables + 1 cron fn — everything else reuses existing primitives)
- `rehearsals` (show_id, date, start/end, location, focus, notes)
- `rehearsal_calls` (rehearsal_id, called_scope enum everyone|group|custom, + `rehearsal_call_people` for custom)
- `rehearsal_absences` (rehearsal_id, user_id, reason, reported_at)
- `announcements` (show_id, author_id, body_md, audience, pinned, emailed, attachment_path) + `announcement_reads` (announcement_id, user_id, read_at)
- `show_files` (show_id, storage_path, label, category)
- `volunteer_needs` (show_id, label, event_date, slots) + `volunteer_signups` (need_id, user_id NULLABLE, guest_name, guest_email, guest_phone, cancel_token, status)
- Cron: `send-reminders` Edge Function. RLS: hub tables readable by production members; announcements/schedule writable by team; absences/reads writable by the member themself; volunteer guest-claim via SECURITY DEFINER RPC.

## Reuse ledger (why this is fast)
notifications + create_notification RPC ✓ · Resend function (staged) ✓ · day-grouped schedule UI ✓ · cast/team directory data ✓ · conflict collection ✓ · storage/upload patterns ✓ · RichTextEditor/Markdown/Lightbox ✓ · role-aware page pattern ✓ · .ics generation ✓ · email-match auto-linking ✓.

## V1 cut line
**Ships:** next-call card, announcements (targeting/receipts/email), schedule + calls + absences, people, resources, reminders, dual-path volunteers.
**Deferred:** replies/threads, SMS, promote/QR block, volunteer recurring-need templates.
