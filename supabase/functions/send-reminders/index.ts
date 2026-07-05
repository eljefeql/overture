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
//   3. Rehearsals    — T-24h + morning-of, to CALLED people only (Week 3;
//                      needs migration 010 — degrades quietly until pasted).
//   4. Volunteer shifts — T-24h to everyone signed up. Members get a
//      notifications row (rides the email pipeline); GUESTS (no account —
//      approved gating exception) get a `guest_emails` queue row instead
//      (migration 011; a notification can't target someone with no user_id).
//   5. Guest email queue — sends pending guest_emails rows (confirmations
//      enqueued by claim_volunteer_slot + the reminders above) via Resend.
//      Without RESEND_API_KEY the rows stay 'pending' and are delivered
//      automatically by the first run after the key is set.
//
// ── EXTENSION POINT ──
// Add new scans following the same shape: query the upcoming rows, then call
// sendOnce({ kind, subjectId, recipientId, window }, notification).
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
  kind: "audition_slot" | "offer_nudge" | "rehearsal" | "volunteer_shift";
  subjectId: string;
  recipientId: string;
  window: "24h" | "2h" | "48h" | "morning";
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
 *
 * Notification prefs (migration 012): the in-app notification is ALWAYS
 * created — that's the product contract. Every row is tagged
 * category='reminders' so send-notification-email (the single email egress
 * for account holders) can check profiles.notification_prefs and skip the
 * email when the recipient turned "Reminders" off. Guests (volunteer email
 * queue below) have no account and therefore no prefs. Pre-012 the category
 * column doesn't exist yet — we retry the insert without it.
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

  // Tag as 'reminders' so the email pipeline can honor notification_prefs.
  let { error: notifError } = await supabase
    .from("notifications")
    .insert({ ...notification, category: "reminders" });
  if (notifError && /category/i.test(notifError.message)) {
    // Migration 012 not pasted yet — insert without the tag (email pipeline
    // then treats the row as uncategorized and always sends).
    ({ error: notifError } = await supabase.from("notifications").insert(notification));
  }
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

// ── 3. Rehearsal reminders (T-24h + morning-of, CALLED people only) ──
// Week 3 extension. Resolves each rehearsal's call list the same way the
// hub does: everyone = accepted cast + team · group = principals/ensemble
// (by role_type) or crew (team) · custom = rehearsal_call_people rows.
// Degrades quietly (returns 0) until migration 010 is pasted.

/** Local YYYY-MM-DD in the reminder timezone. */
function localDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function sendRehearsalReminders(supabase: SupabaseClient): Promise<number> {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const bands: {
    window: "24h" | "morning";
    from: Date;
    to: Date;
    title: string;
  }[] = [
    {
      window: "24h",
      from: new Date(now + 23 * HOUR),
      to: new Date(now + 25 * HOUR),
      title: "Rehearsal tomorrow",
    },
    // "Morning of": fires the first cron run on the rehearsal's local day
    // within 12h of the call (so a 6:30pm call pings around 6:30am).
    {
      window: "morning",
      from: new Date(now + 1 * HOUR),
      to: new Date(now + 12 * HOUR),
      title: "Rehearsal today",
    },
  ];

  let sent = 0;
  for (const band of bands) {
    const { data: rehearsals, error } = await supabase
      .from("rehearsals")
      .select(
        "id, show_id, start_time, end_time, location, focus, " +
          "rehearsal_calls(called_scope, group_key), " +
          "rehearsal_call_people(user_id), shows(title)"
      )
      .gte("start_time", band.from.toISOString())
      .lte("start_time", band.to.toISOString());

    if (error) {
      // Table missing (migration 010 not pasted yet) or transient failure —
      // never take the other reminder kinds down with it.
      console.warn(`rehearsals query skipped (${band.window}): ${error.message}`);
      continue;
    }

    let upcoming = rehearsals ?? [];
    if (band.window === "morning") {
      const today = localDay(new Date());
      upcoming = upcoming.filter((r) => localDay(new Date(r.start_time)) === today);
    }
    if (upcoming.length === 0) continue;

    const showIds = [...new Set(upcoming.map((r) => r.show_id))];
    const [{ data: cast, error: castError }, { data: team, error: teamError }] =
      await Promise.all([
        supabase
          .from("cast_assignments")
          .select("actor_id, show_id, show_roles(role_type)")
          .in("show_id", showIds)
          .eq("status", "accepted"),
        supabase
          .from("show_team_members")
          .select("user_id, show_id")
          .in("show_id", showIds)
          .not("user_id", "is", null),
      ]);
    if (castError || teamError) {
      console.error(
        `rehearsal recipients query failed: ${castError?.message ?? teamError?.message}`
      );
      continue;
    }

    for (const rehearsal of upcoming) {
      /* deno-lint-ignore no-explicit-any */
      const call: any = Array.isArray(rehearsal.rehearsal_calls)
        ? rehearsal.rehearsal_calls[0]
        : rehearsal.rehearsal_calls;
      const scope = call?.called_scope ?? "everyone";
      const groupKey = call?.group_key ?? null;

      const showCast = (cast ?? []).filter((c) => c.show_id === rehearsal.show_id);
      const showTeam = (team ?? [])
        .filter((t) => t.show_id === rehearsal.show_id)
        .map((t) => t.user_id as string);

      let recipients: string[];
      if (scope === "custom") {
        recipients = (rehearsal.rehearsal_call_people ?? []).map(
          (p: { user_id: string }) => p.user_id
        );
      } else if (scope === "group") {
        if (groupKey === "crew") {
          recipients = showTeam;
        } else {
          const wantPrincipals = groupKey === "principals";
          recipients = showCast
            .filter((c) => {
              /* deno-lint-ignore no-explicit-any */
              const role: any = Array.isArray(c.show_roles) ? c.show_roles[0] : c.show_roles;
              const isPrincipal = ["lead", "supporting"].includes(role?.role_type ?? "");
              return wantPrincipals ? isPrincipal : !isPrincipal;
            })
            .map((c) => c.actor_id);
        }
      } else {
        recipients = [...showCast.map((c) => c.actor_id), ...showTeam];
      }

      /* deno-lint-ignore no-explicit-any */
      const show: any = Array.isArray(rehearsal.shows) ? rehearsal.shows[0] : rehearsal.shows;
      const when = formatWhen(rehearsal.start_time);
      const focusBit = rehearsal.focus ? ` — ${rehearsal.focus}` : "";
      const locationBit = rehearsal.location ? ` at ${rehearsal.location}` : "";

      for (const recipientId of [...new Set(recipients)]) {
        const ok = await sendOnce(
          supabase,
          {
            kind: "rehearsal",
            subjectId: rehearsal.id,
            recipientId,
            window: band.window,
          },
          {
            user_id: recipientId,
            type: "system",
            title: band.title,
            body: `You're called ${when}${locationBit} for ${show?.title ?? "your show"}${focusBit}.`,
            show_title: show?.title ?? null,
            link_url: `/shows/${rehearsal.show_id}/hub`,
          }
        );
        if (ok) sent++;
      }
    }
  }
  return sent;
}

// ── 4. Volunteer shift reminders (T-24h, members + guests) ──
// Members get a notifications row (email rides the pipeline). Guests get a
// guest_emails queue row — its dedupe_key mirrors reminder_log's idempotency
// (reminder_log can't hold guests: recipient_id references profiles).
// Degrades quietly (returns 0) until migrations 010/011 are pasted.

async function sendVolunteerReminders(supabase: SupabaseClient): Promise<number> {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const from = new Date(now + 23 * HOUR);
  const to = new Date(now + 25 * HOUR);
  const tomorrow = localDay(new Date(now + 24 * HOUR));

  // Timed shifts in the 24h band + date-only shifts happening tomorrow.
  const [timed, dateOnly] = await Promise.all([
    supabase
      .from("volunteer_needs")
      .select(
        "id, show_id, label, event_date, start_time, end_time, shows(title), " +
          "volunteer_signups(id, user_id, guest_name, guest_email, cancel_token, status)"
      )
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString()),
    supabase
      .from("volunteer_needs")
      .select(
        "id, show_id, label, event_date, start_time, end_time, shows(title), " +
          "volunteer_signups(id, user_id, guest_name, guest_email, cancel_token, status)"
      )
      .is("start_time", null)
      .eq("event_date", tomorrow),
  ]);

  if (timed.error || dateOnly.error) {
    // Tables missing (migrations 010/011 not pasted) or transient failure.
    console.warn(
      `volunteer_needs query skipped: ${timed.error?.message ?? dateOnly.error?.message}`
    );
    return 0;
  }

  let sent = 0;
  for (const need of [...(timed.data ?? []), ...(dateOnly.data ?? [])]) {
    /* deno-lint-ignore no-explicit-any */
    const show: any = Array.isArray(need.shows) ? need.shows[0] : need.shows;
    const when = need.start_time
      ? formatWhen(need.start_time)
      : `tomorrow, ${new Intl.DateTimeFormat("en-US", {
          timeZone: TZ,
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date(`${need.event_date}T12:00:00`))}`;
    const body = `You're volunteering as ${need.label} for ${show?.title ?? "a show"} ${when}. Thank you — it means the world!`;

    for (const signup of need.volunteer_signups ?? []) {
      if (signup.status !== "confirmed") continue;

      if (signup.user_id) {
        // Member path — in-app notification; email rides the pipeline.
        const ok = await sendOnce(
          supabase,
          {
            kind: "volunteer_shift",
            subjectId: need.id,
            recipientId: signup.user_id,
            window: "24h",
          },
          {
            user_id: signup.user_id,
            type: "system",
            title: "Volunteer shift tomorrow",
            body,
            show_title: show?.title ?? null,
            link_url: `/shows/${need.show_id}/hub`,
          }
        );
        if (ok) sent++;
      } else if (signup.guest_email) {
        // Guest path — queue an email; dedupe_key keeps it idempotent.
        const { data: queued, error: queueError } = await supabase
          .from("guest_emails")
          .upsert(
            {
              to_email: signup.guest_email,
              to_name: signup.guest_name,
              subject: `Volunteer shift tomorrow — ${show?.title ?? "your show"}`,
              body,
              show_title: show?.title ?? null,
              cancel_token: signup.cancel_token,
              dedupe_key: `volunteer_reminder:24h:${signup.id}`,
            },
            { onConflict: "dedupe_key", ignoreDuplicates: true }
          )
          .select();
        if (queueError) {
          console.error(`guest reminder queue failed (${signup.id}): ${queueError.message}`);
        } else if (queued && queued.length > 0) {
          sent++;
        }
      }
    }
  }
  return sent;
}

// ── 5. Guest email queue (confirmations + guest reminders via Resend) ──
// Guests have no account, so their email can't ride the notifications
// pipeline. Rows are enqueued by claim_volunteer_slot (confirmations) and
// the volunteer scan above (reminders). No RESEND_API_KEY → rows stay
// 'pending' and go out on the first run after the key is set.

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3001";

type GuestEmail = {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  show_title: string | null;
  cancel_token: string | null;
};

function guestEmailHtml(e: GuestEmail): string {
  const cancelUrl = e.cancel_token
    ? new URL(`/volunteer/cancel/${e.cancel_token}`, APP_URL).toString()
    : null;
  const signupUrl = new URL("/signup", APP_URL).toString();
  return `
  <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="color: #3d2645; font-size: 22px; margin-bottom: 4px;">${e.subject}</h1>
    ${e.show_title ? `<p style="color: #8a7968; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">${e.show_title}</p>` : ""}
    <p style="color: #2b2b2b; font-size: 16px; line-height: 1.5;">${e.body}</p>
    ${cancelUrl ? `<p style="color: #8a7968; font-size: 13px; margin-top: 20px;">Plans changed? No hard feelings — <a href="${cancelUrl}" style="color: #3d2645;">give up your spot</a> so someone else can step in.</p>` : ""}
    <p style="color: #8a7968; font-size: 12px; margin-top: 28px;">
      Want to track your signups and hear when the theatre needs help?
      <a href="${signupUrl}" style="color: #3d2645;">Create a free Overture account</a>.
    </p>
  </div>`;
}

async function processGuestEmails(supabase: SupabaseClient): Promise<number> {
  const { data: pending, error } = await supabase
    .from("guest_emails")
    .select("id, to_email, to_name, subject, body, show_title, cancel_token")
    .eq("status", "pending")
    .order("created_at")
    .limit(50);

  if (error) {
    // Table missing (migration 011 not pasted) — degrade quietly.
    console.warn(`guest_emails query skipped: ${error.message}`);
    return 0;
  }
  if (!pending || pending.length === 0) return 0;

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    // Leave rows pending — they send automatically once the key exists.
    console.log(`RESEND_API_KEY not set — ${pending.length} guest email(s) waiting`);
    return 0;
  }

  let sent = 0;
  for (const email of pending as GuestEmail[]) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM") ?? "Overture <onboarding@resend.dev>",
          to: [email.to_email],
          subject: email.subject,
          html: guestEmailHtml(email),
        }),
      });
      if (res.ok) {
        await supabase
          .from("guest_emails")
          .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
          .eq("id", email.id);
        sent++;
      } else {
        const body = await res.text();
        console.error(`Resend error for guest email ${email.id}: ${res.status} ${body}`);
        await supabase
          .from("guest_emails")
          .update({ status: "failed", error: `Resend ${res.status}: ${body.slice(0, 500)}` })
          .eq("id", email.id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Guest email send threw (${email.id}): ${message}`);
      await supabase
        .from("guest_emails")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("id", email.id);
    }
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
    const rehearsalReminders = await sendRehearsalReminders(supabase);
    const volunteerReminders = await sendVolunteerReminders(supabase);
    const guestEmails = await processGuestEmails(supabase);

    console.log(
      `send-reminders: ${auditionReminders} audition reminders, ${offerNudges} offer nudges, ${rehearsalReminders} rehearsal reminders, ${volunteerReminders} volunteer reminders, ${guestEmails} guest emails`
    );
    return new Response(
      JSON.stringify({
        auditionReminders,
        offerNudges,
        rehearsalReminders,
        volunteerReminders,
        guestEmails,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`send-reminders failed: ${message}`);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
