// Supabase Edge Function: send-reminders
//
// Scheduled (cron, every 15 minutes — see supabase/SETUP_REMINDERS.md).
// Scans upcoming events and inserts `notifications` rows for the people
// involved. Email delivery then rides the existing send-notification-email
// webhook (fires on every notifications INSERT), so this function never
// talks to Resend itself.
//
// What it reminds about today:
//   1. Audition slots — signups whose audition group starts in ~24h or ~2h.
//   2. Offer nudges  — cast offers sitting in 'sent' for more than 48h.
//
// ── EXTENSION POINT (Week 3 — rehearsal reminders) ──
// Add a new scan here following the same shape: query the upcoming rows
// (rehearsals T-24h + morning-of, called people only), then call
// sendOnce({ kind: "rehearsal", subjectId, recipientId, window }, notification).
// The reminder_log unique constraint makes any new kind idempotent for free.
//
// Idempotency: every send is recorded in `reminder_log` (migration 008) with
// a UNIQUE (kind, subject_id, recipient_id, "window") constraint. We insert
// the log row FIRST with ignoreDuplicates — if it was already there, the
// notification is skipped. Safe to run the cron as often as you like.
//
// Env (SUPABASE_* are auto-injected into Edge Functions — the service role
// key is fine HERE and only here, never in app code):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto
//   REMINDER_TZ — IANA timezone for formatting times in reminder copy
//                 (optional; defaults to America/New_York)

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const TZ = Deno.env.get("REMINDER_TZ") ?? "America/New_York";

type ReminderKey = {
  kind: "audition_slot" | "offer_nudge";
  subjectId: string;
  recipientId: string;
  window: "24h" | "2h" | "48h";
};

type NotificationInsert = {
  user_id: string;
  type: "system" | "cast";
  title: string;
  body: string;
  show_title: string | null;
  link_url: string | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${day} at ${time}`;
}

/**
 * Record the reminder in reminder_log, and ONLY if that row is new,
 * insert the notification. Returns true when a notification was sent.
 */
async function sendOnce(
  supabase: SupabaseClient,
  key: ReminderKey,
  notification: NotificationInsert
): Promise<boolean> {
  const { data: logged, error: logError } = await supabase
    .from("reminder_log")
    .upsert(
      {
        kind: key.kind,
        subject_id: key.subjectId,
        recipient_id: key.recipientId,
        window: key.window,
      },
      { onConflict: "kind,subject_id,recipient_id,window", ignoreDuplicates: true }
    )
    .select();

  if (logError) {
    console.error(`reminder_log write failed (${key.kind}/${key.subjectId}): ${logError.message}`);
    return false;
  }
  // Empty result → the log row already existed → reminder already sent.
  if (!logged || logged.length === 0) return false;

  const { error: notifError } = await supabase.from("notifications").insert(notification);
  if (notifError) {
    console.error(`notification insert failed (${key.kind}/${key.subjectId}): ${notifError.message}`);
    return false;
  }
  return true;
}

// ── 1. Audition-slot reminders (T-24h and T-2h) ──
async function sendAuditionSlotReminders(supabase: SupabaseClient): Promise<number> {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  // Bands are wider than the 15-min cron cadence so no slot is missed;
  // reminder_log guarantees each (signup, window) fires only once.
  const windows: { window: "24h" | "2h"; from: Date; to: Date; title: string }[] = [
    {
      window: "24h",
      from: new Date(now + 23 * HOUR),
      to: new Date(now + 25 * HOUR),
      title: "Audition tomorrow",
    },
    {
      window: "2h",
      from: new Date(now + 1.5 * HOUR),
      to: new Date(now + 2.5 * HOUR),
      title: "Audition in 2 hours",
    },
  ];

  let sent = 0;
  for (const w of windows) {
    const { data: groups, error: groupError } = await supabase
      .from("audition_groups")
      .select("id, show_id, start_time, shows(title, audition_location)")
      .gte("start_time", w.from.toISOString())
      .lte("start_time", w.to.toISOString());

    if (groupError) {
      console.error(`audition_groups query failed (${w.window}): ${groupError.message}`);
      continue;
    }
    if (!groups || groups.length === 0) continue;

    const { data: signups, error: signupError } = await supabase
      .from("audition_signups")
      .select("id, actor_id, group_id, show_id")
      .in("group_id", groups.map((g) => g.id))
      .neq("status", "withdrawn");

    if (signupError) {
      console.error(`audition_signups query failed (${w.window}): ${signupError.message}`);
      continue;
    }

    for (const signup of signups ?? []) {
      const group = groups.find((g) => g.id === signup.group_id);
      if (!group) continue;
      // Supabase nests the joined show; may be object or single-element array.
      const show = Array.isArray(group.shows) ? group.shows[0] : group.shows;
      const when = formatWhen(group.start_time);
      const location = show?.audition_location ? ` at ${show.audition_location}` : "";

      const ok = await sendOnce(
        supabase,
        {
          kind: "audition_slot",
          subjectId: signup.id,
          recipientId: signup.actor_id,
          window: w.window,
        },
        {
          user_id: signup.actor_id,
          type: "system",
          title: w.title,
          body: `Your audition for ${show?.title ?? "an upcoming show"} is ${when}${location}. Break a leg!`,
          show_title: show?.title ?? null,
          link_url: `/auditions/${signup.show_id}`,
        }
      );
      if (ok) sent++;
    }
  }
  return sent;
}

// ── 2. Offer nudges (cast offers 'sent' and untouched for 48h+) ──
async function sendOfferNudges(supabase: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: offers, error } = await supabase
    .from("cast_assignments")
    .select("id, actor_id, show_id, updated_at, shows(title), show_roles(name)")
    .eq("status", "sent")
    .lt("updated_at", cutoff);

  if (error) {
    console.error(`cast_assignments query failed: ${error.message}`);
    return 0;
  }

  let sent = 0;
  for (const offer of offers ?? []) {
    const show = Array.isArray(offer.shows) ? offer.shows[0] : offer.shows;
    const role = Array.isArray(offer.show_roles) ? offer.show_roles[0] : offer.show_roles;
    const roleBit = role?.name ? ` as ${role.name}` : "";

    const ok = await sendOnce(
      supabase,
      {
        kind: "offer_nudge",
        subjectId: offer.id,
        recipientId: offer.actor_id,
        window: "48h",
      },
      {
        user_id: offer.actor_id,
        type: "cast",
        title: "Your offer is waiting",
        body: `You have a cast offer${roleBit} for ${show?.title ?? "a show"} waiting for your response. The production team is holding the role for you.`,
        show_title: show?.title ?? null,
        link_url: `/offers/${offer.id}`,
      }
    );
    if (ok) sent++;
  }
  return sent;
}

Deno.serve(async (_req) => {
  // Service role: reads across all shows/signups and inserts notifications
  // directly (bypasses RLS). This key exists ONLY inside Edge Functions.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const auditionReminders = await sendAuditionSlotReminders(supabase);
    const offerNudges = await sendOfferNudges(supabase);
    // Week 3: rehearsal reminders slot in here (see extension point above).

    console.log(`send-reminders: ${auditionReminders} audition reminders, ${offerNudges} offer nudges`);
    return new Response(
      JSON.stringify({ auditionReminders, offerNudges }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`send-reminders failed: ${message}`);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
