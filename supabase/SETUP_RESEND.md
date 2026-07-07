# Email Notifications Setup (Resend)

The app already writes every callback invite, cast offer, and offer response
to the `notifications` table (the in-app feed). This guide turns on the
**email** channel: a Supabase Edge Function fires on every new notification
row and sends the email via Resend, logging each attempt to
`notification_deliveries`.

Until you finish these steps, nothing breaks — the function records each
email as "skipped" and the in-app feed keeps working.

## Prerequisite

Make sure migration `005_signups_notifications.sql` has been applied (it
creates the `notification_deliveries` table). It's included in
`supabase/PASTE_ME_NEXT.sql` — paste that into the SQL Editor if you haven't.

## 1. Create a Resend account and get an API key

1. Go to https://resend.com and sign up (free tier: 100 emails/day).
2. In the Resend dashboard, go to **API Keys** → **Create API Key**.
   - Name: `overture`
   - Permission: "Sending access"
3. Copy the key (starts with `re_`). You only see it once.

> Without a verified domain, Resend only delivers to **your own** email
> address (from `onboarding@resend.dev`). That's fine for testing. To email
> real actors later: Resend dashboard → **Domains** → add your domain and
> the DNS records it shows you.

## 2. Install the Supabase CLI (one time)

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref haptjelzekjdjerrditm
```
(Run these from the `overture2.0` folder. `supabase login` opens a browser.)

## 3. Set the secrets

```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set APP_URL=https://your-deployed-app-url.com
```
Optional (after you verify a domain in Resend):
```bash
supabase secrets set RESEND_FROM="Overture <notifications@yourdomain.com>"
```

**Staging QA note:** while you're testing against the staging project with
the app running locally, email links (invites, cancel links, etc.) are built
from `APP_URL` — so point it at your local dev server or the links will 404:
```bash
npx supabase secrets set APP_URL=http://localhost:3001
```
Switch it back to the real deployed URL before anyone outside QA gets email.

## 4. Deploy the function

```bash
supabase functions deploy send-notification-email --no-verify-jwt
```
(`--no-verify-jwt` is needed because the caller is a database webhook,
not a logged-in user.)

## 5. Create the database webhook

In the Supabase Dashboard (https://supabase.com/dashboard/project/haptjelzekjdjerrditm):

1. **Integrations** → **Database Webhooks** → **Enable webhooks** (if asked) → **Create a new hook**
2. Fill in:
   - Name: `notification-email`
   - Table: `notifications`
   - Events: check **Insert** only
   - Type: **Supabase Edge Functions**
   - Edge Function: `send-notification-email`
3. Save.

## 6. Test it

1. In the app, have a director send callback notifications or cast offers
   (or insert a test row into `notifications` via the SQL Editor).
2. Check **Edge Functions → send-notification-email → Logs** in the dashboard.
3. Check the `notification_deliveries` table — every notification should get
   a row with status `sent`, `failed`, or `skipped` (skipped = key not set).

## Guest volunteer emails (no extra setup)

Community guests who volunteer through the public `/volunteer/[showId]` page
have **no account**, so their emails can't ride the `notifications` webhook
above. Instead, their confirmation (queued by `claim_volunteer_slot`,
migration 011) and their T-24h shift reminder sit in the `guest_emails`
table, and the **`send-reminders` cron** (see `SETUP_REMINDERS.md`) sends
them via Resend using the SAME secrets you set here (`RESEND_API_KEY`,
`RESEND_FROM`, `APP_URL` — `APP_URL` matters: it builds the tokened cancel
link in each email). Nothing extra to configure — once the key exists and
`send-reminders` is deployed + scheduled, any waiting guest emails go out on
the next run.
