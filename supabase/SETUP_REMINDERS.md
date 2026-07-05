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

It is idempotent: every send is logged in `reminder_log`, so the same
reminder can never fire twice even if the cron runs constantly. Week 3
rehearsal reminders will plug into the same function (there's a marked
extension point in the code).

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
