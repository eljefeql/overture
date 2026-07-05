# Reminder Engine Setup (send-reminders cron)

The `send-reminders` Edge Function scans upcoming events every 15 minutes
and drops reminder rows into `notifications` — the same table the in-app
feed reads and the `send-notification-email` webhook watches. So once this
is scheduled, reminders show up in-app immediately, and **email delivery
rides the existing Resend pipeline** (see `SETUP_RESEND.md`) with no extra
wiring.

What it sends today:

- **Audition slot reminders** — "Audition tomorrow" (~24h before the slot)
  and "Audition in 2 hours" (~2h before), with show, time, and location.
- **Offer nudges** — "Your offer is waiting" when a cast offer has sat
  unanswered for 48+ hours.
- **Rehearsal reminders** — T-24h + morning-of, to called people only
  (needs migration 010).
- **Volunteer shift reminders** — T-24h to everyone signed up. Members get
  a notification (email rides the pipeline); community **guests** (no
  account) get a `guest_emails` queue row instead (needs migration 011).
- **Guest email delivery** — sends pending `guest_emails` rows (volunteer
  confirmations queued by `claim_volunteer_slot` + the guest reminders
  above) directly via Resend. Uses the same `RESEND_API_KEY` /
  `RESEND_FROM` / `APP_URL` secrets as `SETUP_RESEND.md` — until the key
  is set, rows wait as `pending` and go out on the first run after it is.

It is idempotent: every member send is logged in `reminder_log`, and every
guest email carries a unique `dedupe_key`, so the same reminder can never
fire twice even if the cron runs constantly.

## 1. Apply migration 008

Paste `supabase/PASTE_ME_NEXT.sql` (= `migrations/008_reminders.sql`) into
**Supabase Dashboard → SQL Editor → Run**. It creates the `reminder_log`
table. Idempotent — safe to run twice.

> Note: `PROD_SETUP.sql` was generated before migration 008 and should be
> regenerated before setting up the production project.

## 2. Deploy the function

From the `overture2.0` folder (CLI setup is in `SETUP_RESEND.md` if you
haven't linked the project yet):

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

`--no-verify-jwt` lets the scheduler invoke it without a user token. The
function only uses the service-role key that Supabase injects automatically
— there are no new secrets to set.

Optional: reminder times are formatted in US Eastern by default. To change:

```bash
supabase secrets set REMINDER_TZ=America/Chicago
```

## 3. Schedule it (every 15 minutes)

In the **Supabase Dashboard**:

1. Go to **Integrations → Cron** (enable the Cron integration if prompted —
   it turns on the `pg_cron` extension).
2. **Create job**:
   - Name: `send-reminders`
   - Schedule: `*/15 * * * *` (every 15 minutes)
   - Type: **Supabase Edge Function** → pick `send-reminders`, method POST.
3. Save. The job list shows each run's status.

(If your dashboard version doesn't offer the Edge Function job type, use a
SQL job that calls the function via `net.http_post` with the function URL —
the Cron page's "HTTP Request" template does exactly this.)

## 4. Verify

- Run it once by hand: Dashboard → **Edge Functions → send-reminders →
  Invoke** (or `supabase functions invoke send-reminders`). The response
  reports counts: `{"auditionReminders":0,"offerNudges":0}`.
- Create an audition slot ~23.5h out, sign an actor up, invoke again — the
  actor gets an in-app notification (and an email once Resend is live).
- Invoke a second time: counts stay 0 — that's `reminder_log` doing its job.
