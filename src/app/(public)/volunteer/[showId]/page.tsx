"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import {
  getVolunteerBoard,
  claimVolunteerSlot,
} from "@/lib/api/hub";
import {
  Card,
  Badge,
  Button,
  PageSkeleton,
  EmptyState,
  Input,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatTime } from "@/lib/utils";
import {
  Calendar,
  CalendarPlus,
  MapPin,
  HandHeart,
  CheckCircle,
  Buildings,
  EnvelopeSimple,
  ArrowRight,
} from "@phosphor-icons/react";
import type { VolunteerBoard } from "@/types";

/* ============================================================
   Public volunteer signup — /volunteer/[showId].
   Anonymous-viewable and mobile-first: community guests sign up
   with just a name + email, NO account. This is the approved
   exception to the access-gating rule (SHOW_HUB_SPEC.md) — the
   page never shows who else signed up, only open-slot counts.
   ============================================================ */

type BoardNeed = VolunteerBoard["needs"][number];

/** "Fri, Jul 12 · 6:00 PM – 9:30 PM" */
function shiftWhen(need: {
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
}): string {
  const parts: string[] = [];
  if (need.eventDate) {
    parts.push(
      new Date(`${need.eventDate}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    );
  }
  if (need.startTime) {
    parts.push(
      `${formatTime(need.startTime)}${need.endTime ? ` – ${formatTime(need.endTime)}` : ""}`
    );
  }
  return parts.join(" · ");
}

function downloadShiftIcs(need: BoardNeed, showTitle: string, orgName: string) {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateOnly = (ymd: string) => ymd.replace(/-/g, "");
  const nextDay = (ymd: string) => {
    const d = new Date(`${ymd}T12:00:00`);
    d.setDate(d.getDate() + 1);
    const pad = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  };
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Overture//Community Theatre Casting//EN",
    "BEGIN:VEVENT",
    `UID:volunteer-${need.id}@overture`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
  ];
  if (need.startTime) {
    lines.push(`DTSTART:${fmt(need.startTime)}`);
    lines.push(`DTEND:${fmt(need.endTime ?? need.startTime)}`);
  } else if (need.eventDate) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(need.eventDate)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(need.eventDate)}`);
  }
  lines.push(
    `SUMMARY:Volunteering — ${need.label} (${showTitle}, ${orgName})`,
    "END:VEVENT",
    "END:VCALENDAR"
  );
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `volunteer-${need.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

type ClaimedShift = { need: BoardNeed; cancelToken: string; asGuest: boolean };

export default function PublicVolunteerPage() {
  const { showId } = useParams<{ showId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formFor, setFormFor] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [claimed, setClaimed] = useState<ClaimedShift | null>(null);

  const { data: board, isLoading } = useQuery({
    queryKey: ["volunteerBoard", showId],
    queryFn: () => getVolunteerBoard(showId),
  });

  const claimMutation = useMutation({
    mutationFn: (need: BoardNeed) =>
      claimVolunteerSlot(
        user
          ? { needId: need.id, mockUser: { id: user.id, name: user.displayName } }
          : {
              needId: need.id,
              guestName: guestName.trim(),
              guestEmail: guestEmail.trim(),
              guestPhone: guestPhone.trim() || undefined,
            }
      ),
    onSuccess: (token, need) => {
      queryClient.invalidateQueries({ queryKey: ["volunteerBoard", showId] });
      setClaimed({ need, cancelToken: token, asGuest: !user });
      setFormFor(null);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (isLoading) return <PageSkeleton />;

  if (!board) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <EmptyState
          icon={<HandHeart className="w-12 h-12" weight="duotone" />}
          title="This signup page isn't available"
          description="The show may have closed or the link may be out of date. Check with the theatre that shared it with you."
          action={
            <Link href="/browse">
              <Button>Browse Open Auditions</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { show, needs } = board;
  const dates =
    show.showOpen && show.showClose
      ? `${formatDate(show.showOpen)} – ${formatDate(show.showClose)}`
      : show.showOpen
        ? formatDate(show.showOpen)
        : null;

  const submitGuest = (need: BoardNeed) => {
    if (!guestName.trim() || !guestEmail.trim()) {
      toast("error", "Your name and email are all we need.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(guestEmail.trim())) {
      toast("error", "That email doesn't look right — mind checking it?");
      return;
    }
    claimMutation.mutate(need);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* ── Show header ── */}
      <div className="mb-6 animate-fade-up">
        <div className="flex items-start gap-4">
          {show.posterUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={show.posterUrl}
              alt={`${show.title} poster`}
              className="w-20 h-28 rounded-xl object-cover flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-1">
              Volunteer with us
            </p>
            <h1 className="text-3xl font-display text-curtain-900 mb-1">
              {show.title}
            </h1>
            <p className="text-sm text-clay-500 flex items-center gap-1.5">
              <Buildings className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
              {show.orgName} · {show.city}, {show.state}
            </p>
            {dates && (
              <p className="text-sm text-clay-500 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {dates}
              </p>
            )}
            {show.performanceLocation && (
              <p className="text-sm text-clay-500 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {show.performanceLocation}
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-clay-500 mt-4">
          Community theatre runs on neighbors like you. Pick a shift below —
          no account needed, just your name and email.
        </p>
      </div>

      {/* ── Success state ── */}
      {claimed && (
        <Card variant="highlighted" padding="spacious" className="mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-8 h-8 text-forest-600 flex-shrink-0" weight="duotone" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-display text-curtain-900 mb-1">
                You&apos;re on the list — thank you!
              </h2>
              <p className="text-sm font-semibold text-curtain-900">
                {claimed.need.label}
              </p>
              {shiftWhen(claimed.need) && (
                <p className="text-sm text-curtain-700">{shiftWhen(claimed.need)}</p>
              )}
              {claimed.need.notes && (
                <p className="text-xs text-clay-500 mt-1">{claimed.need.notes}</p>
              )}
              {claimed.asGuest && (
                <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-2">
                  <EnvelopeSimple className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                  We&apos;ll email your confirmation and a reminder the day before.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadShiftIcs(claimed.need, show.title, show.orgName)
                  }
                  icon={<CalendarPlus className="w-4 h-4 text-stage-500" weight="duotone" />}
                >
                  Add to calendar
                </Button>
                <Link
                  href={`/volunteer/cancel/${claimed.cancelToken}`}
                  className="text-xs text-clay-500 underline decoration-dotted hover:text-curtain-700 transition"
                >
                  Can&apos;t make it after all? Give up your spot
                </Link>
              </div>
              {claimed.asGuest && (
                <p className="text-xs text-clay-500 mt-4">
                  Want to track your signups and hear when {show.orgName} needs
                  help?{" "}
                  <Link
                    href={`/signup?next=/volunteer/${showId}`}
                    className="font-semibold text-curtain-700 hover:text-curtain-900 transition"
                  >
                    Create a free account
                    <ArrowRight className="w-3.5 h-3.5 inline ml-0.5" weight="bold" />
                  </Link>
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Needs ── */}
      {needs.length === 0 ? (
        <EmptyState
          icon={<HandHeart className="w-12 h-12" weight="duotone" />}
          title="Nothing to sign up for right now"
          description={`${show.orgName} hasn't posted volunteer needs for this show yet — check back soon!`}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {needs.map((need) => {
            const open = need.slots - need.filled;
            const isFull = open <= 0;
            const when = shiftWhen(need);
            return (
              <Card key={need.id} variant="elevated" padding="standard">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-curtain-900">{need.label}</p>
                    {when && (
                      <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                        {when}
                      </p>
                    )}
                    {need.notes && (
                      <p className="text-xs text-clay-500 mt-1">{need.notes}</p>
                    )}
                  </div>
                  {isFull ? (
                    <Badge variant="success" size="sm">Full</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      {open} spot{open === 1 ? "" : "s"} open
                    </Badge>
                  )}
                </div>

                <div className="mt-3">
                  {isFull ? (
                    <p className="text-xs text-clay-400">
                      All spots are taken — thank you, everyone!
                    </p>
                  ) : user ? (
                    <Button
                      size="sm"
                      onClick={() => claimMutation.mutate(need)}
                      loading={
                        claimMutation.isPending &&
                        claimMutation.variables?.id === need.id
                      }
                      icon={<HandHeart className="w-4 h-4" weight="duotone" />}
                    >
                      Claim a spot
                    </Button>
                  ) : formFor === need.id ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                            Your name *
                          </label>
                          <Input
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="First and last"
                            autoComplete="name"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                            Email *
                          </label>
                          <Input
                            type="email"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                          Phone (optional)
                        </label>
                        <Input
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="In case plans change day-of"
                          autoComplete="tel"
                        />
                      </div>
                      <p className="text-[11px] text-clay-400">
                        We only use this to confirm your shift and send a
                        reminder — no spam, ever.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => submitGuest(need)}
                          loading={claimMutation.isPending}
                        >
                          Sign me up
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setFormFor(null)}>
                          Never mind
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setFormFor(need.id)}
                      icon={<HandHeart className="w-4 h-4" weight="duotone" />}
                    >
                      Claim a spot
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-clay-400 mt-8 text-center">
        Powered by Overture — where community theatre finds its people.
      </p>
    </div>
  );
}
