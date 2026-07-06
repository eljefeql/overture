// Supabase Edge Function: send-notification-email
//
// Triggered by a Database Webhook on INSERT into `notifications`.
// Looks up the recipient's email from `profiles`, sends the notification
// via the Resend API, and logs every attempt to `notification_deliveries`.
//
// Graceful no-op: if RESEND_API_KEY is not set (no Resend account yet),
// the function logs the skip and records a "skipped" delivery row so
// nothing breaks before email is configured.
//
// Setup steps: see supabase/SETUP_RESEND.md
//
// Env (set via `supabase secrets set` — SUPABASE_* are auto-injected):
//   RESEND_API_KEY    — Resend API key (optional until email goes live)
//   RESEND_FROM       — sender, e.g. "Overture <notifications@yourdomain.com>"
//                       (optional; defaults to Resend's onboarding sender)

import { createClient } from "npm:@supabase/supabase-js@2";

type NotificationRecord = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  show_title: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
  /** Email-gating hint (migration 012): 'reminders' | 'announcements' | 'offers' | null. */
  category?: string | null;
};

// ── Notification preferences (migration 012) ──
// profiles.notification_prefs is a jsonb of per-category EMAIL toggles:
// { reminders, announcements, offers } — all default true. In-app
// notifications are always created upstream; this function is the single
// email egress for account holders, so the pref check lives here.
// Writers tag rows via notifications.category (send-reminders → 'reminders',
// announce_to_show → 'announcements', create_notification → 'offers' for
// callback/cast types). Untagged rows fall back to a type-based guess;
// truly uncategorized rows are always emailed (safe default).

function categoryOf(n: NotificationRecord): string | null {
  if (n.category) return n.category;
  if (n.type === "callback" || n.type === "cast") return "offers";
  return null;
}

/* deno-lint-ignore no-explicit-any */
function emailAllowed(prefs: any, category: string | null): boolean {
  if (!category) return true;
  if (!prefs || typeof prefs !== "object") return true; // pre-012 / missing → default on
  return prefs[category] !== false;
}

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRecord;
};

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3001";

function emailHtml(n: NotificationRecord): string {
  const link = n.link_url ? new URL(n.link_url, APP_URL).toString() : APP_URL;
  // Full document with an explicit UTF-8 charset — without it, mail clients
  // guess the encoding and mangle emoji/accented characters (🎉 → üéâ).
  return `<!DOCTYPE html>
  <html lang="en">
  <head><meta charset="utf-8"></head>
  <body style="margin: 0;">
  <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="color: #3d2645; font-size: 22px; margin-bottom: 4px;">${n.title}</h1>
    ${n.show_title ? `<p style="color: #8a7968; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">${n.show_title}</p>` : ""}
    <p style="color: #2b2b2b; font-size: 16px; line-height: 1.5;">${n.body}</p>
    <a href="${link}" style="display: inline-block; margin-top: 16px; background: #c9a227; color: #2b2030; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-family: Helvetica, Arial, sans-serif; font-weight: 600; font-size: 14px;">
      View in Overture
    </a>
    <p style="color: #8a7968; font-size: 12px; margin-top: 28px;">
      You're receiving this because of activity on your Overture account.
    </p>
  </div>
  </body>
  </html>`;
}

Deno.serve(async (req) => {
  // Service role is required to read recipient emails and write the
  // delivery log — this key only ever lives inside the Edge Function.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications" || !payload.record) {
    return new Response(JSON.stringify({ skipped: "Not a notifications INSERT" }), { status: 200 });
  }

  const notification = payload.record;

  async function logDelivery(status: "sent" | "failed" | "skipped", error: string | null) {
    const { error: logError } = await supabase.from("notification_deliveries").insert({
      notification_id: notification.id,
      channel: "email",
      status,
      error,
    });
    if (logError) console.error("Failed to log delivery:", logError.message);
  }

  // No Resend key yet → record the skip and exit cleanly.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.log(`RESEND_API_KEY not set — skipping email for notification ${notification.id}`);
    await logDelivery("skipped", "RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ status: "skipped" }), { status: 200 });
  }

  // Recipient email + notification prefs (select * so this keeps working
  // whether or not migration 012's notification_prefs column exists yet).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", notification.user_id)
    .maybeSingle();

  if (profileError || !profile?.email) {
    const reason = profileError?.message ?? "Recipient has no email";
    console.error(`Cannot email notification ${notification.id}: ${reason}`);
    await logDelivery("failed", reason);
    return new Response(JSON.stringify({ status: "failed", error: reason }), { status: 200 });
  }

  // Respect the recipient's per-category email toggles. The in-app
  // notification already exists — we're only skipping the email.
  const category = categoryOf(notification);
  if (!emailAllowed(profile.notification_prefs, category)) {
    console.log(
      `Notification ${notification.id} skipped — recipient turned off '${category}' emails`
    );
    await logDelivery("skipped", `Recipient preference: ${category} emails off`);
    return new Response(JSON.stringify({ status: "skipped", reason: "preference" }), {
      status: 200,
    });
  }

  // Send via Resend
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") ?? "Overture <onboarding@resend.dev>",
        to: [profile.email],
        subject: notification.show_title
          ? `${notification.title} — ${notification.show_title}`
          : notification.title,
        html: emailHtml(notification),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend error for notification ${notification.id}: ${res.status} ${body}`);
      await logDelivery("failed", `Resend ${res.status}: ${body.slice(0, 500)}`);
      return new Response(JSON.stringify({ status: "failed" }), { status: 200 });
    }

    await logDelivery("sent", null);
    return new Response(JSON.stringify({ status: "sent" }), { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Email send threw for notification ${notification.id}: ${message}`);
    await logDelivery("failed", message);
    return new Response(JSON.stringify({ status: "failed", error: message }), { status: 200 });
  }
});
