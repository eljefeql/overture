"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getHubData,
  createRehearsal,
  updateRehearsal,
  deleteRehearsal,
  reportAbsence,
  cancelAbsence,
  postAnnouncement,
  setAnnouncementPinned,
  deleteAnnouncement,
  markAnnouncementRead,
  getShowFiles,
  uploadShowFile,
  deleteShowFile,
  getShowFileUrl,
  addShowLink,
  normalizeLinkUrl,
  updateCommNorms,
  getVolunteerNeeds,
  createVolunteerNeed,
  updateVolunteerNeed,
  deleteVolunteerNeed,
  claimVolunteerSlot,
  unclaimVolunteerSlot,
  isShiftPast,
  resolveCalledUserIds,
  calledLabel,
  nameForUser,
  addMemberConflict,
  removeMemberConflict,
  removeSignupConflict,
  myConflictRanges,
  rangesCoverDate,
  type HubData,
  type RehearsalInput,
  type VolunteerNeedInput,
} from "@/lib/api/hub";
import {
  ConflictDatePicker,
  type ConflictDate,
} from "@/components/auditions/ConflictDatePicker";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Pill,
  Avatar,
  PageSkeleton,
  SectionHeader,
  EmptyState,
  Input,
  Textarea,
  Modal,
  RichTextEditor,
  Markdown,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ContactActions } from "@/components/hub/ContactActions";
import { SendNoteModal, type NoteRecipient } from "@/components/hub/SendNoteModal";
import { SHOW_STATUS_LABELS, SHOW_STATUS_BADGE } from "@/lib/constants";
import { formatDate, formatTime, formatTeamRole, timeAgo } from "@/lib/utils";
import {
  Calendar,
  CalendarPlus,
  CalendarX,
  MapPin,
  Megaphone,
  PushPin,
  PencilSimple,
  Plus,
  Trash,
  Users,
  UsersThree,
  Warning,
  Envelope,
  ChatCircleText,
  FolderOpen,
  FilePdf,
  FileDoc,
  FileText,
  MusicNotes,
  ImageSquare,
  DownloadSimple,
  UploadSimple,
  CloudArrowUp,
  Eye,
  MaskHappy,
  HandHeart,
  LinkSimple,
  ArrowSquareOut,
  Buildings,
  Ticket,
  CheckCircle,
  CaretDown,
  CaretUp,
  ClockCounterClockwise,
  CalendarBlank,
  X,
} from "@phosphor-icons/react";
import type {
  ID,
  Announcement,
  AnnouncementAudience,
  Rehearsal,
  CalledGroup,
  ShowFile,
  ShowTeamMember,
  CommNormItem,
  VolunteerNeed,
  ConflictRange,
} from "@/types";

/* ============================================================
   Show Hub — the post-casting command center. One page,
   role-aware: cast members get "what do I need to know today"
   (mobile-first); the team gets the same page plus compose &
   manage controls. Spec: SHOW_HUB_SPEC.md.
   ============================================================ */

const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  company: "Full company",
  cast: "Cast",
  principals: "Principals",
  crew: "Production team",
  rehearsal: "Called to a rehearsal",
};

const CALLED_SCOPE_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "everyone", label: "Full company" },
  { value: "group:principals", label: "Principals" },
  { value: "group:ensemble", label: "Ensemble" },
  { value: "group:crew", label: "Production team" },
  { value: "custom", label: "Pick people" },
];

function fileIcon(name: string) {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const cls = "w-5 h-5 text-stage-500 flex-shrink-0";
  if (ext === "pdf") return <FilePdf className={cls} weight="duotone" />;
  if (["doc", "docx", "pages", "txt", "rtf"].includes(ext))
    return <FileDoc className={cls} weight="duotone" />;
  if (["mp3", "wav", "m4a", "aac", "midi", "mid"].includes(ext))
    return <MusicNotes className={cls} weight="duotone" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext))
    return <ImageSquare className={cls} weight="duotone" />;
  return <FileText className={cls} weight="duotone" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Local YYYY-MM-DD for "today", for this-week bucketing. */
function todayKey(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayKeyPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ShowHubPage() {
  const { showId } = useParams<{ showId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["hub", showId, user?.id],
    queryFn: () => getHubData(showId, user!.id),
    enabled: !!user,
  });

  const { data: files } = useQuery({
    queryKey: ["hubFiles", showId],
    queryFn: () => getShowFiles(showId),
  });

  // ── Role awareness ──
  const isTeam = !!data?.team.some((t) => t.userId === user?.id);

  // ── Mark unread announcements read on view ──
  const markedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !data) return;
    const unread = data.announcements.filter(
      (a) => !a.isRead && !markedRef.current.has(a.id)
    );
    if (unread.length === 0) return;
    unread.forEach((a) => markedRef.current.add(a.id));
    Promise.all(unread.map((a) => markAnnouncementRead(a.id, user.id))).then(
      () => queryClient.invalidateQueries({ queryKey: ["hub", showId] })
    );
  }, [data, user, showId, queryClient]);

  if (isLoading || !user) return <PageSkeleton />;
  if (isError || !data?.show) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <EmptyState
          icon={<Warning className="w-12 h-12" weight="duotone" />}
          title="Unable to load the hub"
          description="Something went wrong loading this show. Please try again."
          action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* ── Header (QC #34) — this show's home at a glance ── */}
      <HubHeader data={data} />

      <div className="flex flex-col gap-8">
        <NextCallSection data={data} userId={user.id} userName={user.displayName} showId={showId} />
        <AnnouncementsSection
          data={data}
          userId={user.id}
          userName={user.displayName}
          isTeam={isTeam}
          showId={showId}
        />
        <ScheduleSection data={data} userId={user.id} isTeam={isTeam} showId={showId} />
        <MyConflictsSection data={data} userId={user.id} showId={showId} />
        <PeopleSection
          data={data}
          isTeam={isTeam}
          showId={showId}
          userId={user.id}
          userName={user.displayName}
        />
        <ResourcesSection
          files={files ?? []}
          isTeam={isTeam}
          showId={showId}
          userId={user.id}
        />
        <VolunteersSection
          isTeam={isTeam}
          showId={showId}
          userId={user.id}
          userName={user.displayName}
        />
      </div>
      {isTeam && (
        <p className="text-[11px] text-clay-400 mt-8">
          Cast members see this same page without the compose and edit
          controls.
        </p>
      )}
    </div>
  );
}

/* ============================================================
   0. Header (QC #34) — theatre (→ public page), status, key
   dates, next rehearsal, poster thumbnail. Compact + scannable.
   ============================================================ */

function HubHeader({ data }: { data: HubData }) {
  const show = data.show!;
  const [now] = useState(() => Date.now());
  const nextRehearsal = data.rehearsals.find(
    (r) => new Date(r.endTime).getTime() >= now
  );
  const runDates =
    show.showOpen && show.showClose
      ? show.showOpen === show.showClose
        ? formatDate(show.showOpen)
        : `${formatDate(show.showOpen)} – ${formatDate(show.showClose)}`
      : show.showOpen
        ? `Opens ${formatDate(show.showOpen)}`
        : null;

  return (
    <div className="mb-6 animate-fade-up">
      <div className="flex items-start gap-4">
        {show.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={show.posterUrl}
            alt={`${show.title} poster`}
            className="w-16 h-24 sm:w-20 sm:h-[120px] rounded-xl object-cover flex-shrink-0 shadow-sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-3xl font-display text-curtain-900">{show.title}</h1>
            <Badge variant={SHOW_STATUS_BADGE[show.status]} size="sm">
              {SHOW_STATUS_LABELS[show.status]}
            </Badge>
          </div>
          <Link
            href={`/theatres/${show.orgId}`}
            className="inline-flex items-center gap-1.5 text-sm text-curtain-700 hover:text-curtain-900 transition mt-1"
            title="View the theatre's public page"
          >
            <Buildings className="w-4 h-4 text-stage-500" weight="duotone" />
            {show.orgName}
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-clay-500">
            {runDates && (
              <span className="inline-flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-stage-500" weight="duotone" />
                {show.showClose && show.showOpen !== show.showClose ? "Runs " : ""}
                {runDates}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
              {nextRehearsal
                ? `Next rehearsal ${formatDate(nextRehearsal.date)} · ${formatTime(nextRehearsal.startTime)}`
                : "No upcoming rehearsals scheduled"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   1. Your next call
   ============================================================ */

function NextCallSection({
  data,
  userId,
  userName,
  showId,
}: {
  data: HubData;
  userId: ID;
  userName: string;
  showId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  // Snapshot "now" once per mount — stable across re-renders (purity rule).
  const [now] = useState(() => Date.now());
  const nextCall = useMemo(() => {
    return data.rehearsals
      .filter((r) => new Date(r.endTime).getTime() >= now)
      .find((r) =>
        resolveCalledUserIds(r, data.cast, data.team, data.roles).has(userId)
      );
  }, [data, userId, now]);

  const myAbsence = nextCall
    ? data.absences.find(
        (a) => a.rehearsalId === nextCall.id && a.userId === userId
      )
    : undefined;

  // The viewer's own conflict ranges (audition signup + hub-added) overlap
  // this call? Heads-up only — never auto-creates an absence.
  const myConflictOnCall =
    !!nextCall &&
    rangesCoverDate(myConflictRanges(data.conflicts, userId).ranges, nextCall.date);

  const absenceMutation = useMutation({
    mutationFn: () =>
      reportAbsence({
        rehearsalId: nextCall!.id,
        showId,
        userId,
        userName,
        reason: reason.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", showId] });
      toast("success", "Thanks for the heads-up — the stage manager can see it.");
      setConfirming(false);
      setReason("");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const undoMutation = useMutation({
    mutationFn: () => cancelAbsence(nextCall!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", showId] });
      toast("info", "Absence withdrawn — you're back on the call.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const downloadIcs = () => {
    if (!nextCall || !data.show) return;
    const fmt = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Overture//Community Theatre Casting//EN",
      "BEGIN:VEVENT",
      `UID:${showId}-${nextCall.id}@overture`,
      `DTSTAMP:${fmt(nextCall.startTime)}`,
      `DTSTART:${fmt(nextCall.startTime)}`,
      `DTEND:${fmt(nextCall.endTime)}`,
      `SUMMARY:Rehearsal — ${data.show.title}${nextCall.focus ? ` (${nextCall.focus})` : ""}`,
      nextCall.location ? `LOCATION:${nextCall.location}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rehearsal-${data.show.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("success", "Calendar file downloaded!");
  };

  return (
    <section>
      <SectionHeader>Your Next Call</SectionHeader>
      {nextCall ? (
        <Card variant="elevated" padding="standard">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-stage-100 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-lg font-display text-stage-700 leading-none">
                {new Date(nextCall.startTime).getDate()}
              </span>
              <span className="text-[10px] font-semibold text-stage-500 uppercase">
                {new Date(nextCall.startTime).toLocaleDateString("en-US", { month: "short" })}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-curtain-900">
                {formatDate(nextCall.date)} · {formatTime(nextCall.startTime)} –{" "}
                {formatTime(nextCall.endTime)}
              </p>
              {nextCall.focus && (
                <p className="text-sm text-curtain-700 mt-0.5">{nextCall.focus}</p>
              )}
              {nextCall.location && (
                <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                  {nextCall.location}
                </p>
              )}
              {nextCall.notes && (
                <p className="text-xs text-clay-500 mt-1">{nextCall.notes}</p>
              )}
              {myConflictOnCall && !myAbsence && (
                <p className="text-xs text-stage-700 flex items-start gap-1.5 mt-2">
                  <Warning className="w-3.5 h-3.5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                  <span>
                    You have a conflict on this date. If you can&apos;t make it, tap
                    &ldquo;Can&apos;t make it&rdquo; so the team knows.
                  </span>
                </p>
              )}

              {myAbsence ? (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="warning" size="sm">
                    You reported you can&apos;t make it
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => undoMutation.mutate()}
                    loading={undoMutation.isPending}
                  >
                    I can make it after all
                  </Button>
                </div>
              ) : confirming ? (
                <div className="mt-3 flex flex-col gap-2">
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Optional — what's keeping you? (helps the SM plan)"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => absenceMutation.mutate()}
                      loading={absenceMutation.isPending}
                    >
                      Confirm — I can&apos;t make it
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                      Never mind
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadIcs}
                    icon={<CalendarPlus className="w-4 h-4 text-stage-500" weight="duotone" />}
                  >
                    Add to calendar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(true)}
                    icon={<CalendarX className="w-4 h-4 text-stage-500" weight="duotone" />}
                  >
                    Can&apos;t make it
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card variant="flat" padding="standard">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
            <p className="text-sm text-clay-500">
              {data.rehearsals.length === 0
                ? "No rehearsals are on the schedule yet — they'll appear here the moment the stage manager adds them."
                : "You're not called to any upcoming rehearsals. Enjoy the night off!"}
            </p>
          </div>
        </Card>
      )}
    </section>
  );
}

/* ============================================================
   2. Announcements
   ============================================================ */

function audienceIds(
  a: Announcement,
  data: HubData
): Set<ID> {
  // Guests (no account yet, migration 024) have null actorIds — not reachable.
  const castIds = data.cast
    .map((c) => c.actorId)
    .filter((id): id is ID => !!id);
  const teamIds = data.team.map((t) => t.userId);
  switch (a.audience) {
    case "cast":
      return new Set(castIds);
    case "crew":
      return new Set(teamIds);
    case "principals": {
      const roleTypeById = new Map(data.roles.map((r) => [r.id, r.roleType]));
      return new Set(
        data.cast
          .filter((c) =>
            ["lead", "supporting"].includes(roleTypeById.get(c.roleId) ?? "")
          )
          .map((c) => c.actorId)
          .filter((id): id is ID => !!id)
      );
    }
    case "rehearsal": {
      const reh = data.rehearsals.find((r) => r.id === a.rehearsalId);
      if (reh) return resolveCalledUserIds(reh, data.cast, data.team, data.roles);
      return new Set([...castIds, ...teamIds]);
    }
    default:
      return new Set([...castIds, ...teamIds]);
  }
}

function AnnouncementsSection({
  data,
  userId,
  userName,
  isTeam,
  showId,
}: {
  data: HubData;
  userId: ID;
  userName: string;
  isTeam: boolean;
  showId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("company");
  const [rehearsalId, setRehearsalId] = useState<string>("");
  const [pinned, setPinned] = useState(false);
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [receiptsFor, setReceiptsFor] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const postMutation = useMutation({
    mutationFn: () =>
      postAnnouncement({
        showId,
        showTitle: data.show?.title ?? null,
        authorId: userId,
        authorName: userName,
        bodyMd: body.trim(),
        audience,
        rehearsalId: audience === "rehearsal" ? rehearsalId || null : null,
        pinned,
        alsoEmail,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", showId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast("success", "Announcement posted!");
      setBody("");
      setAudience("company");
      setRehearsalId("");
      setPinned(false);
      setAlsoEmail(false);
      setComposing(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: boolean }) =>
      setAnnouncementPinned(id, pin),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["hub", showId] });
      toast("info", v.pin ? "Pinned to the top." : "Unpinned.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", showId] });
      toast("info", "Announcement deleted.");
      setDeletingId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const upcomingRehearsals = data.rehearsals.filter(
    (r) => new Date(r.endTime).getTime() >= now
  );

  const submit = () => {
    if (!body.trim()) {
      toast("error", "Write something first.");
      return;
    }
    if (audience === "rehearsal" && !rehearsalId) {
      toast("error", "Pick which rehearsal's call list to send this to.");
      return;
    }
    postMutation.mutate();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader className="mb-0">Announcements</SectionHeader>
        {isTeam && !composing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setComposing(true)}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            New announcement
          </Button>
        )}
      </div>

      {/* Compose (team only) */}
      {isTeam && composing && (
        <Card variant="elevated" padding="standard" className="mb-3">
          <div className="flex flex-col gap-3">
            <RichTextEditor
              value={body}
              onChange={setBody}
              rows={4}
              placeholder="Schedule change? Costume call? Tell the company…"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                  Who should see this?
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
                >
                  {(Object.keys(AUDIENCE_LABELS) as AnnouncementAudience[]).map((k) => (
                    <option key={k} value={k}>
                      {AUDIENCE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              {audience === "rehearsal" && (
                <div>
                  <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                    Which rehearsal?
                  </label>
                  <select
                    value={rehearsalId}
                    onChange={(e) => setRehearsalId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
                  >
                    <option value="">Select a rehearsal</option>
                    {upcomingRehearsals.map((r) => (
                      <option key={r.id} value={r.id}>
                        {formatDate(r.date)} · {formatTime(r.startTime)}
                        {r.focus ? ` — ${r.focus}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-curtain-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="accent-stage-500"
                />
                Pin to top
              </label>
              <label className="flex items-center gap-2 text-sm text-curtain-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoEmail}
                  onChange={(e) => setAlsoEmail(e.target.checked)}
                  className="accent-stage-500"
                />
                Also email everyone targeted
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submit}
                loading={postMutation.isPending}
                icon={<Megaphone className="w-4 h-4" weight="bold" />}
              >
                Post
              </Button>
            </div>
          </div>
        </Card>
      )}

      {data.announcements.length === 0 ? (
        <Card variant="flat" padding="standard">
          <div className="flex items-center gap-3">
            <Megaphone className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
            <p className="text-sm text-clay-500">
              {isTeam
                ? "No announcements yet. Post the first one — it beats a 10pm group text."
                : "No announcements yet. Anything the team posts shows up here."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.announcements.map((a) => {
            const targeted = audienceIds(a, data);
            targeted.delete(a.authorId);
            const readers = a.readerIds.filter((id) => targeted.has(id));
            const unreadNames = [...targeted]
              .filter((id) => !a.readerIds.includes(id))
              .map((id) => nameForUser(id, data.cast, data.team))
              .filter(Boolean);
            return (
              <Card key={a.id} variant="elevated" padding="standard">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && (
                      <PushPin className="w-4 h-4 text-stage-500" weight="duotone" />
                    )}
                    <span className="text-sm font-semibold text-curtain-900">
                      {a.authorName}
                    </span>
                    <span className="text-xs text-clay-400">{timeAgo(a.createdAt)}</span>
                    <Pill variant="status" className="cursor-default">
                      {AUDIENCE_LABELS[a.audience]}
                    </Pill>
                    {a.emailed && (
                      <span className="text-[10px] font-semibold text-clay-400 uppercase tracking-wide flex items-center gap-1">
                        <Envelope className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                        Emailed
                      </span>
                    )}
                  </div>
                  {isTeam && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => pinMutation.mutate({ id: a.id, pin: !a.pinned })}
                        className="text-clay-300 hover:text-stage-500 transition p-1"
                        aria-label={a.pinned ? "Unpin announcement" : "Pin announcement"}
                      >
                        <PushPin className="w-4 h-4" weight={a.pinned ? "fill" : "bold"} />
                      </button>
                      <button
                        onClick={() => setDeletingId(a.id)}
                        className="text-clay-300 hover:text-ruby-500 transition p-1"
                        aria-label="Delete announcement"
                      >
                        <Trash className="w-4 h-4" weight="bold" />
                      </button>
                    </div>
                  )}
                </div>
                <Markdown className="text-sm text-curtain-800">{a.bodyMd}</Markdown>

                {deletingId === a.id && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-ruby-500 font-medium">Delete this announcement?</span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => deleteMutation.mutate(a.id)}
                      loading={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Read receipts (team only) */}
                {isTeam && targeted.size > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setReceiptsFor(receiptsFor === a.id ? null : a.id)}
                      className="text-xs text-clay-500 hover:text-curtain-700 transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                      Read by {readers.length} of {targeted.size}
                      {unreadNames.length > 0 && (
                        <span className="underline decoration-dotted">
                          {receiptsFor === a.id ? "hide" : "who hasn't?"}
                        </span>
                      )}
                    </button>
                    {receiptsFor === a.id && unreadNames.length > 0 && (
                      <p className="text-xs text-clay-500 mt-1.5">
                        Hasn&apos;t read yet: {unreadNames.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   3. Schedule — this week + full schedule
   ============================================================ */

type RehearsalDraft = {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  focus: string;
  notes: string;
  scope: string; // "everyone" | "group:<key>" | "custom"
  people: ID[];
};

const EMPTY_DRAFT: RehearsalDraft = {
  date: "",
  startTime: "18:30",
  endTime: "21:30",
  location: "",
  focus: "",
  notes: "",
  scope: "everyone",
  people: [],
};

function ScheduleSection({
  data,
  userId,
  isTeam,
  showId,
}: {
  data: HubData;
  userId: ID;
  isTeam: boolean;
  showId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RehearsalDraft>(EMPTY_DRAFT);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["hub", showId] });

  const buildInput = (): RehearsalInput | null => {
    if (!draft.date || !draft.startTime || !draft.endTime) {
      toast("error", "Date, start time, and end time are required.");
      return null;
    }
    if (draft.endTime <= draft.startTime) {
      toast("error", "End time must be after the start time.");
      return null;
    }
    const [scope, group] = draft.scope.split(":");
    if (scope === "custom" && draft.people.length === 0) {
      toast("error", "Pick at least one person, or call the full company.");
      return null;
    }
    return {
      showId,
      date: draft.date,
      startTime: new Date(`${draft.date}T${draft.startTime}:00`).toISOString(),
      endTime: new Date(`${draft.date}T${draft.endTime}:00`).toISOString(),
      location: draft.location.trim() || null,
      focus: draft.focus.trim() || null,
      notes: draft.notes.trim() || null,
      calledScope: scope as RehearsalInput["calledScope"],
      calledGroup: scope === "group" ? (group as CalledGroup) : null,
      calledPeople: scope === "custom" ? draft.people : [],
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = buildInput();
      if (!input) throw new Error("__validation__");
      return editingId
        ? updateRehearsal(editingId, input)
        : createRehearsal(input);
    },
    onSuccess: () => {
      invalidate();
      toast("success", editingId ? "Rehearsal updated!" : "Rehearsal added!");
      setModalOpen(false);
    },
    onError: (err: Error) => {
      if (err.message !== "__validation__") toast("error", err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRehearsal(editingId!),
    onSuccess: () => {
      invalidate();
      toast("info", "Rehearsal removed.");
      setModalOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const openAdd = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, location: data.show?.auditionLocation ?? "" });
    setConfirmDelete(false);
    setModalOpen(true);
  };

  const openEdit = (r: Rehearsal) => {
    if (!isTeam) return;
    const toHHMM = (iso: string) => {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    setEditingId(r.id);
    setDraft({
      date: r.date,
      startTime: toHHMM(r.startTime),
      endTime: toHHMM(r.endTime),
      location: r.location ?? "",
      focus: r.focus ?? "",
      notes: r.notes ?? "",
      scope:
        r.calledScope === "group"
          ? `group:${r.calledGroup ?? "principals"}`
          : r.calledScope,
      people: [...r.calledPeople],
    });
    setConfirmDelete(false);
    setModalOpen(true);
  };

  // People available to a "custom" call: accepted cast + team.
  const pickablePeople = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: ID; name: string; detail: string }[] = [];
    for (const c of data.cast) {
      // Guests (no account yet) can't be picked for a call — skip them.
      if (!c.actorId) continue;
      if (seen.has(c.actorId)) {
        const existing = list.find((p) => p.id === c.actorId);
        if (existing) existing.detail += `, ${c.roleName}`;
        continue;
      }
      seen.add(c.actorId);
      list.push({ id: c.actorId, name: c.actorName, detail: c.roleName });
    }
    for (const t of data.team) {
      if (seen.has(t.userId)) continue;
      seen.add(t.userId);
      list.push({ id: t.userId, name: t.userName, detail: formatTeamRole(t.role) });
    }
    return list;
  }, [data.cast, data.team]);

  // The viewer's own unified conflict ranges — "You have a conflict" chips.
  const myRanges = useMemo(
    () => myConflictRanges(data.conflicts, userId).ranges,
    [data.conflicts, userId]
  );

  // QC #17 — conflicts on the date being scheduled (team-only, unified
  // data, company members only — auditionees who weren't cast don't count).
  const companyIds = useMemo(() => {
    const ids = new Set<ID>();
    for (const c of data.cast) if (c.actorId) ids.add(c.actorId);
    for (const t of data.team) ids.add(t.userId);
    return ids;
  }, [data.cast, data.team]);
  const draftDateConflicts = useMemo(() => {
    if (!draft.date) return [];
    return data.conflicts
      .filter(
        (c) => companyIds.has(c.actorId) && rangesCoverDate(c.ranges, draft.date)
      )
      .map((c) => c.actorName || nameForUser(c.actorId, data.cast, data.team))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [draft.date, data.conflicts, data.cast, data.team, companyIds]);
  const editingAbsences = editingId
    ? data.absences.filter((a) => a.rehearsalId === editingId)
    : [];

  const today = todayKey();
  const weekEnd = dayKeyPlus(7);
  const upcoming = data.rehearsals.filter((r) => r.date >= today);
  const thisWeek = upcoming.filter((r) => r.date <= weekEnd);
  const later = upcoming.filter((r) => r.date > weekEnd);
  const past = data.rehearsals.filter((r) => r.date < today);

  const groupByDay = (list: Rehearsal[]) => {
    const byDay = new Map<string, Rehearsal[]>();
    for (const r of list) {
      const arr = byDay.get(r.date) ?? [];
      arr.push(r);
      byDay.set(r.date, arr);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  };

  const renderRow = (r: Rehearsal) => {
    const calledIds = resolveCalledUserIds(r, data.cast, data.team, data.roles);
    const iAmCalled = calledIds.has(userId);
    const iHaveConflict = iAmCalled && rangesCoverDate(myRanges, r.date);
    const absences = data.absences.filter((a) => a.rehearsalId === r.id);
    const conflictCount = data.conflicts.filter(
      (c) =>
        calledIds.has(c.actorId) &&
        c.ranges.some((rg) => rg.startDate <= r.date && r.date <= rg.endDate)
    ).length;

    const row = (
      <div className="flex items-start justify-between gap-3 py-2.5 border-b border-cream-100 last:border-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-curtain-900">
            {formatTime(r.startTime)} – {formatTime(r.endTime)}
            {iAmCalled && (
              <span className="ml-2 text-[10px] font-semibold text-forest-600 uppercase tracking-wide">
                You&apos;re called
              </span>
            )}
          </p>
          {r.focus && <p className="text-xs text-curtain-700 mt-0.5">{r.focus}</p>}
          {r.location && (
            <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
              <span className="truncate">{r.location}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Pill variant="status" className="cursor-default">
              <Users className="w-3.5 h-3.5 text-stage-500 mr-1" weight="duotone" />
              {calledLabel(r, (id) => nameForUser(id, data.cast, data.team))}
            </Pill>
            {isTeam && conflictCount > 0 && (
              <Badge variant="warning" size="sm">
                {conflictCount} conflict{conflictCount === 1 ? "" : "s"}
              </Badge>
            )}
            {iHaveConflict && (
              <Badge variant="warning" size="sm">
                You have a conflict
              </Badge>
            )}
            {absences.length > 0 && (
              <Badge variant="danger" size="sm">
                {absences.length} out
              </Badge>
            )}
          </div>
          {isTeam && absences.length > 0 && (
            <p className="text-xs text-clay-500 mt-1">
              Out: {absences.map((a) => a.userName + (a.reason ? ` (${a.reason})` : "")).join(", ")}
            </p>
          )}
        </div>
        {isTeam && (
          <PencilSimple className="w-4 h-4 text-clay-300 flex-shrink-0 mt-1" weight="bold" />
        )}
      </div>
    );

    return isTeam ? (
      <button key={r.id} onClick={() => openEdit(r)} className="text-left w-full hover:opacity-80 transition">
        {row}
      </button>
    ) : (
      <div key={r.id}>{row}</div>
    );
  };

  const renderDayGroups = (list: Rehearsal[]) =>
    groupByDay(list).map(([dateKey, dayList]) => (
      <div key={dateKey}>
        <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-1">
          {new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </p>
        <div className="flex flex-col">{dayList.map(renderRow)}</div>
      </div>
    ));

  const [scope] = draft.scope.split(":");

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader className="mb-0">This Week</SectionHeader>
        {isTeam && (
          <Button
            size="sm"
            variant="ghost"
            onClick={openAdd}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Add rehearsal
          </Button>
        )}
      </div>

      <Card variant="elevated" padding="standard">
        <div
          className={
            later.length > 0 || past.length > 0
              ? "border-b border-cream-100 pb-3 mb-3"
              : undefined
          }
        >
          {thisWeek.length > 0 ? (
            <div className="flex flex-col gap-4">{renderDayGroups(thisWeek)}</div>
          ) : (
            <p className="text-sm text-clay-500">
              Nothing scheduled in the next seven days.
            </p>
          )}
        </div>

        {(later.length > 0 || past.length > 0) && (
          <div>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-medium text-curtain-600 hover:text-curtain-900 transition"
            >
              {showAll
                ? "Hide full schedule"
                : `Full schedule (${later.length} more upcoming${past.length > 0 ? `, ${past.length} past` : ""})`}
            </button>
            {showAll && (
              <div className="flex flex-col gap-4 mt-3">
                {renderDayGroups(later)}
                {past.length > 0 && (
                  <details>
                    <summary className="text-xs text-clay-400 cursor-pointer mb-2">
                      Past rehearsals ({past.length})
                    </summary>
                    <div className="flex flex-col gap-4">{renderDayGroups(past)}</div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Add / edit rehearsal modal (team) ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Rehearsal" : "Add a Rehearsal"}
      >
        <div className="py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Date *</label>
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Start *</label>
              <Input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">End *</label>
              <Input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
              />
            </div>
          </div>
          {/* QC #17 — who's got a conflict on the chosen date, BEFORE saving.
              Heads-up only, never blocking. */}
          {draft.date && (
            <Card variant="flat" padding="compact">
              {draftDateConflicts.length > 0 ? (
                <p className="text-xs text-curtain-800 flex items-start gap-1.5">
                  <Warning className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                  <span>
                    <span className="font-semibold">
                      {draftDateConflicts.length}{" "}
                      {draftDateConflicts.length === 1 ? "person has" : "people have"}{" "}
                      conflicts that day:
                    </span>{" "}
                    {draftDateConflicts.join(", ")}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-clay-500 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                  No known conflicts that day.
                </p>
              )}
              {editingAbsences.length > 0 && (
                <p className="text-xs text-clay-500 mt-1.5">
                  Already reported out for this rehearsal:{" "}
                  {editingAbsences.map((a) => a.userName).join(", ")}
                </p>
              )}
            </Card>
          )}
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
              What&apos;s being worked
            </label>
            <Input
              value={draft.focus}
              onChange={(e) => setDraft({ ...draft, focus: e.target.value })}
              placeholder='e.g. "Act 1, sc. 3–5" or "Full run — off book"'
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Location</label>
            <Input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Notes</label>
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              placeholder="Anything the company should know — parking, what to bring…"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Who&apos;s called *</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {CALLED_SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDraft({ ...draft, scope: opt.value })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                    draft.scope === opt.value
                      ? "bg-curtain-800 text-white border-curtain-800"
                      : "bg-white text-curtain-700 border-cream-200 hover:border-curtain-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {scope === "custom" && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-cream-200 p-3 flex flex-col gap-2">
                {pickablePeople.length === 0 && (
                  <p className="text-xs text-clay-500">
                    Nobody to pick yet — the company fills in as offers are accepted.
                  </p>
                )}
                {pickablePeople.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-curtain-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-stage-500"
                      checked={draft.people.includes(p.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          people: e.target.checked
                            ? [...draft.people, p.id]
                            : draft.people.filter((id) => id !== p.id),
                        })
                      }
                    />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-clay-400">{p.detail}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingId ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ruby-500 font-medium">Remove?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteMutation.mutate()}
                    loading={deleteMutation.isPending}
                  >
                    Yes, remove
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  icon={<Trash className="w-4 h-4" weight="bold" />}
                >
                  Remove rehearsal
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                {editingId ? "Save Changes" : "Add Rehearsal"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/* ============================================================
   3b. My conflicts — dates the viewer can't rehearse. The UNION
   of their audition-signup ranges and ranges added here
   (member_conflicts, migration 025). Every production member
   sees their own; the team sees everyone's in the schedule
   counts, the rehearsal modal, and the Conflict Calendar.
   Mobile-first: actors fill this in from their phones.
   ============================================================ */

function formatRangeLabel(r: ConflictRange): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return r.startDate === r.endDate
    ? fmt(r.startDate)
    : `${fmt(r.startDate)} – ${fmt(r.endDate)}`;
}

function MyConflictsSection({
  data,
  userId,
  showId,
}: {
  data: HubData;
  userId: ID;
  showId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { signupId, ranges } = myConflictRanges(data.conflicts, userId);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["hub", showId] });
    queryClient.invalidateQueries({ queryKey: ["showConflicts", showId] });
  };

  const addMutation = useMutation({
    mutationFn: (c: ConflictDate) =>
      addMemberConflict({
        showId,
        userId,
        startDate: c.startDate,
        endDate: c.endDate,
        note: c.note?.trim() || null,
      }),
    onSuccess: () => {
      invalidate();
      toast("success", "Conflict saved — the team can see it when scheduling.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (r: ConflictRange) => {
      if (!r.id) throw new Error("This conflict can't be removed here.");
      if (r.source === "signup") {
        if (!signupId) throw new Error("This conflict can't be removed here.");
        await removeSignupConflict({
          rangeId: r.id,
          signupId,
          startDate: r.startDate,
          endDate: r.endDate,
        });
      } else {
        await removeMemberConflict(r.id);
      }
    },
    onMutate: (r) => setRemovingId(r.id ?? null),
    onSettled: () => setRemovingId(null),
    onSuccess: () => {
      invalidate();
      toast("info", "Conflict removed.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  // Can't add conflicts in the past; cap at the show's close if we know it.
  const today = todayKey();
  const maxDate =
    data.show?.showClose && data.show.showClose >= today
      ? data.show.showClose
      : undefined;

  return (
    <section>
      <SectionHeader>My Conflicts</SectionHeader>
      <Card variant="elevated" padding="standard">
        <p className="text-sm text-clay-500 mb-4">
          Dates you can&apos;t rehearse. The team sees these when scheduling —
          keeping this current saves everyone a phone call.
        </p>

        {ranges.length > 0 ? (
          <div className="flex flex-col gap-2 mb-4">
            {ranges.map((r) => {
              const key = r.id ?? `${r.startDate}-${r.endDate}`;
              const isRemoving = removeMutation.isPending && removingId === r.id;
              return (
                <Card key={key} variant="flat" padding="compact">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <CalendarBlank
                        className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5"
                        weight="duotone"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-curtain-900">
                          {formatRangeLabel(r)}
                        </p>
                        <p className="text-xs text-clay-400">
                          {r.source === "signup"
                            ? "from your audition signup"
                            : "added here"}
                          {r.note ? ` · ${r.note}` : ""}
                        </p>
                      </div>
                    </div>
                    {r.id && (
                      <button
                        onClick={() => removeMutation.mutate(r)}
                        disabled={isRemoving}
                        aria-label={`Remove conflict ${formatRangeLabel(r)}`}
                        className="p-2 -m-1 rounded-full text-clay-400 hover:text-ruby-600 hover:bg-ruby-50 transition disabled:opacity-50 flex-shrink-0"
                      >
                        <X className="w-4 h-4" weight="bold" />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-curtain-700 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-stage-500 flex-shrink-0" weight="duotone" />
            No conflicts yet — add any dates you can&apos;t rehearse.
          </p>
        )}

        <ConflictDatePicker
          conflicts={[]}
          onChange={(list) => {
            const added = list[list.length - 1];
            if (added) addMutation.mutate(added);
          }}
          minDate={today}
          maxDate={maxDate}
          label={null}
          hint={null}
          withNote
        />
        {addMutation.isPending && (
          <p className="text-xs text-clay-400 mt-2">Saving…</p>
        )}
      </Card>
    </section>
  );
}

/* ============================================================
   4. People — cast + team + comm norms routing card
   ============================================================ */

function PeopleSection({
  data,
  isTeam,
  showId,
  userId,
  userName,
}: {
  data: HubData;
  isTeam: boolean;
  showId: string;
  userId: ID;
  userName: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [normsOpen, setNormsOpen] = useState(false);
  // Draft-only `other` flag: "Someone else…" picked in the Who select, so
  // the free-text name field stays open even while the name is still empty.
  type NormDraft = CommNormItem & { other?: boolean };
  const [normsDraft, setNormsDraft] = useState<NormDraft[]>([]);

  // ── Send a note (QC #32) — recipient + 30s per-person cooldown ──
  const [noteTo, setNoteTo] = useState<NoteRecipient | null>(null);
  const [cooldownIds, setCooldownIds] = useState<Set<ID>>(() => new Set());
  const startCooldown = (id: ID) => {
    setCooldownIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setCooldownIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 30_000);
  };

  // Team members with accounts (guests have a `guest-` placeholder id) —
  // the only valid note recipients in v1. Never yourself.
  const noteableTeam = useMemo(
    () =>
      new Map(
        data.team
          .filter((t) => !t.userId.startsWith("guest-") && t.userId !== userId)
          .map((t) => [t.userId, t])
      ),
    [data.team, userId]
  );
  const noteFor = (t: ShowTeamMember | undefined) =>
    t && noteableTeam.has(t.userId)
      ? () =>
          setNoteTo({
            userId: t.userId,
            name: t.userName,
            detail: formatTeamRole(t.role),
          })
      : undefined;

  const normsMutation = useMutation({
    mutationFn: () =>
      updateCommNorms(
        showId,
        normsDraft
          .filter((n) => n.topic.trim() && n.contact.trim())
          .map((n) => ({
            topic: n.topic.trim(),
            contact: n.contact.trim(),
            method: (n.method ?? "").trim(),
            phone: (n.phone ?? "").trim() || undefined,
            email: (n.email ?? "").trim() || undefined,
            userId: n.userId ?? undefined,
          }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", showId] });
      toast("success", "Contact routing saved!");
      setNormsOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const EMPTY_NORM: NormDraft = { topic: "", contact: "", method: "", phone: "", email: "", userId: null };
  const openNorms = () => {
    setNormsDraft(
      data.commNorms.length > 0
        ? data.commNorms.map((n) => ({
            ...EMPTY_NORM,
            ...n,
            // Saved rows that aren't linked to a team member = "someone else".
            other: !n.userId && !!n.contact,
          }))
        : [{ ...EMPTY_NORM }]
    );
    setNormsOpen(true);
  };
  const updateNorm = (i: number, patch: Partial<NormDraft>) =>
    setNormsDraft((prev) => prev.map((n, j) => (j === i ? { ...n, ...patch } : n)));

  // Group multiple accepted roles per person. Cast members added by email
  // (precast bulk add) have no account yet — actorId is null until they sign
  // up and claim_cast_assignments links them. They render as "Invited" (no
  // profile link) so the SM can see who still needs a nudge.
  // Grouping (QC #31): Principals (lead/supporting) → Featured roles
  // (featured_ensemble — named parts, one flat grid) → one pot per
  // `ensemble` role ("Villagers of Anatevka (8)").
  type CastPerson = {
    id: string;
    name: string;
    avatarUrl: string | null;
    roles: string[];
    joined: boolean;
    invited: boolean;
    email: string | null;
    tier: "principal" | "featured" | "ensemble";
    /** Ensemble pot name(s) this person belongs to, for grouping. */
    pots: string[];
  };
  const { principals, featured, ensemblePots } = useMemo(() => {
    const roleTypeById = new Map(data.roles.map((r) => [r.id, r.roleType]));
    const byActor = new Map<string, CastPerson>();
    for (const c of data.cast) {
      const key = c.actorId ?? `guest-${c.id}`;
      const entry =
        byActor.get(key) ?? {
          id: key,
          name: c.actorName,
          avatarUrl: c.actorAvatarUrl ?? null,
          roles: [],
          joined: !!c.actorId,
          invited: !!c.invitedAt,
          email: c.guestEmail ?? null,
          tier: "ensemble" as const,
          pots: [],
        };
      const roleType = roleTypeById.get(c.roleId) ?? "ensemble";
      entry.roles.push(
        c.assignmentType === "primary"
          ? c.roleName
          : `${c.roleName} (${c.assignmentType})`
      );
      if (roleType === "lead" || roleType === "supporting") entry.tier = "principal";
      else if (roleType === "featured_ensemble" && entry.tier !== "principal")
        entry.tier = "featured";
      else if (!entry.pots.includes(c.roleName)) entry.pots.push(c.roleName);
      byActor.set(key, entry);
    }
    const all = [...byActor.values()];
    const principals = all.filter((p) => p.tier === "principal");
    const featured = all.filter((p) => p.tier === "featured");
    // Ensemble pots keep the roles' sort order (data.roles order).
    const pots = new Map<string, CastPerson[]>();
    for (const r of data.roles) {
      if (r.roleType !== "ensemble") continue;
      const members = all.filter((p) => p.tier === "ensemble" && p.pots.includes(r.name));
      if (members.length > 0) pots.set(r.name, members);
    }
    // Anyone left (ensemble-tier but their role isn't in data.roles) still shows.
    const placed = new Set([...pots.values()].flat().map((p) => p.id));
    const leftovers = all.filter((p) => p.tier === "ensemble" && !placed.has(p.id));
    if (leftovers.length > 0) pots.set("Ensemble", [...(pots.get("Ensemble") ?? []), ...leftovers]);
    return { principals, featured, ensemblePots: [...pots.entries()] };
  }, [data.cast, data.roles]);
  const castCount =
    principals.length + featured.length + ensemblePots.reduce((n, [, m]) => n + m.length, 0);
  const unjoinedCount = [principals, featured, ...ensemblePots.map(([, m]) => m)]
    .flat()
    .filter((p) => !p.joined).length;
  const groupCount = (principals.length ? 1 : 0) + (featured.length ? 1 : 0) + ensemblePots.length;

  const renderCastTile = (p: CastPerson) => {
    const inner = (
      <>
        <Avatar name={p.name} imageUrl={p.avatarUrl} size="lg" className="mb-2" />
        <p className="text-sm font-semibold text-curtain-900 truncate w-full">{p.name}</p>
        <p className="text-xs text-clay-500 truncate w-full">{p.roles.join(" · ")}</p>
        {!p.joined && (
          <div className="mt-1.5">
            <Badge variant={p.invited ? "gold" : "muted"} size="sm">
              {p.invited ? "Invited" : "Not invited yet"}
            </Badge>
          </div>
        )}
        {!p.joined && isTeam && p.email && (
          <p className="text-[10px] text-clay-400 truncate w-full mt-0.5">{p.email}</p>
        )}
      </>
    );
    const cls = "flex flex-col items-center text-center min-w-0 p-2 rounded-xl";
    return p.joined ? (
      <Link
        key={p.id}
        href={`/actors/${p.id}`}
        className={`${cls} hover:bg-cream-50 transition`}
        title={`View ${p.name}'s profile`}
      >
        {inner}
      </Link>
    ) : (
      <div key={p.id} className={cls}>
        {inner}
      </div>
    );
  };

  const castGrid = (people: CastPerson[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {people.map(renderCastTile)}
    </div>
  );

  // Routing-row → team member (for "Send a note"). Prefers the explicit
  // userId saved from the edit modal; falls back to a name match so rows
  // saved before QC #30 still light up.
  const teamForNorm = (n: CommNormItem): ShowTeamMember | undefined => {
    if (n.userId) return data.team.find((t) => t.userId === n.userId);
    const needle = n.contact.toLowerCase();
    return data.team.find(
      (t) => t.userName && needle.includes(t.userName.toLowerCase())
    );
  };

  const teamOptions = data.team.filter((t) => t.userName);

  return (
    <section>
      <SectionHeader>People</SectionHeader>
      <div className="flex flex-col gap-3">
        {/* ── Production team — first, prominent (QC #31) ── */}
        <Card variant="elevated" padding="standard">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersThree className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Production Team ({data.team.length})</CardTitle>
            </div>
          </CardHeader>
          {data.team.length === 0 ? (
            <p className="text-sm text-clay-500">
              The production team appears here as members are added on the show&apos;s setup page.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.team.map((t) => {
                const isGuest = t.userId.startsWith("guest-");
                const isMe = t.userId === userId;
                return (
                  <Card key={t.id} variant="flat" padding="compact">
                    <div className="flex items-start gap-3">
                      {isGuest ? (
                        <Avatar name={t.userName} imageUrl={t.avatarUrl} size="md" />
                      ) : (
                        <Link href={`/actors/${t.userId}`} title={`View ${t.userName}'s profile`}>
                          <Avatar name={t.userName} imageUrl={t.avatarUrl} size="md" />
                        </Link>
                      )}
                      <div className="min-w-0 flex-1">
                        {isGuest ? (
                          <p className="text-sm font-semibold text-curtain-900 truncate">{t.userName}</p>
                        ) : (
                          <Link
                            href={`/actors/${t.userId}`}
                            className="text-sm font-semibold text-curtain-900 truncate block hover:text-curtain-700 transition"
                            title={`View ${t.userName}'s profile`}
                          >
                            {t.userName}
                            {isMe && <span className="text-clay-400 font-normal"> (you)</span>}
                          </Link>
                        )}
                        <p className="text-xs text-clay-500 mb-2">{formatTeamRole(t.role)}</p>
                        <ContactActions
                          name={t.userName}
                          phone={t.phone}
                          email={t.email}
                          onNote={noteFor(t)}
                          noteDisabled={cooldownIds.has(t.userId)}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Who to contact — routing rows with real contact info (QC #30) ── */}
        <Card variant="elevated" padding="standard">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChatCircleText className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Who to Contact</CardTitle>
            </div>
            {isTeam && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openNorms}
                icon={<PencilSimple className="w-4 h-4" weight="bold" />}
              >
                Edit
              </Button>
            )}
          </CardHeader>
          {data.commNorms.length > 0 ? (
            <div className="flex flex-col">
              {data.commNorms.map((n, i) => {
                const member = teamForNorm(n);
                return (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 py-3 border-b border-cream-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-curtain-900">{n.topic}</p>
                      <p className="text-xs text-clay-500">
                        {n.contact}
                        {n.method ? ` · ${n.method}` : ""}
                      </p>
                    </div>
                    <ContactActions
                      name={n.contact}
                      phone={n.phone}
                      email={n.email}
                      onNote={noteFor(member)}
                      noteDisabled={member ? cooldownIds.has(member.userId) : false}
                      className="sm:items-end sm:text-right flex-shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-clay-500">
              {isTeam
                ? "Tell the company who to reach for what — running late, costumes, music questions — with a number or email they can actually use."
                : "The team hasn't set contact routing yet."}
            </p>
          )}
        </Card>

        {/* ── Cast — compact headshot grid, principals above the ensemble (QC #31) ── */}
        <Card variant="elevated" padding="standard">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MaskHappy className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Cast ({castCount})</CardTitle>
            </div>
          </CardHeader>
          {castCount > 0 ? (
            <div className="flex flex-col gap-4">
              {principals.length > 0 && (
                <div>
                  {groupCount > 1 && (
                    <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
                      Principals
                    </p>
                  )}
                  {castGrid(principals)}
                </div>
              )}
              {featured.length > 0 && (
                <div>
                  {groupCount > 1 && (
                    <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
                      Featured roles
                    </p>
                  )}
                  {castGrid(featured)}
                </div>
              )}
              {ensemblePots.map(([potName, members]) => (
                <div key={potName}>
                  <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
                    {potName} ({members.length})
                  </p>
                  {castGrid(members)}
                </div>
              ))}
              {unjoinedCount > 0 && (
                <p className="text-[11px] text-clay-400 leading-snug">
                  {unjoinedCount === 1
                    ? "1 cast member hasn't joined Overture yet — they"
                    : `${unjoinedCount} cast members haven't joined Overture yet — they`}{" "}
                  can&apos;t receive announcements or reminders until they create
                  their account with the invited email.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-clay-500">
              The cast appears here as offers are accepted.
            </p>
          )}
        </Card>
      </div>

      {/* ── Send a note modal (QC #32) ── */}
      <SendNoteModal
        open={!!noteTo}
        onClose={() => setNoteTo(null)}
        recipient={noteTo}
        showId={showId}
        showTitle={data.show?.title ?? null}
        senderName={userName}
        onSent={startCooldown}
      />

      {/* ── Edit comm norms modal — one entry per card (QC #16 + #30) ── */}
      <Modal open={normsOpen} onClose={() => setNormsOpen(false)} title="Who to Contact">
        <div className="py-2 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-clay-500">
            Route questions before they become group texts. Share only the
            number or email each person is happy to hand out — nothing is
            pulled from anyone&apos;s profile.
          </p>
          {normsDraft.map((n, i) => {
            const linked = n.userId ? teamOptions.find((t) => t.userId === n.userId) : undefined;
            const selectValue = linked ? linked.userId : n.other ? "__other" : "";
            return (
              <Card key={i} variant="flat" padding="standard">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase">
                    Entry {i + 1}
                  </p>
                  <button
                    onClick={() => setNormsDraft(normsDraft.filter((_, j) => j !== i))}
                    className="text-clay-300 hover:text-ruby-500 transition p-1 -m-1"
                    aria-label={`Remove entry ${i + 1}`}
                  >
                    <Trash className="w-4 h-4" weight="bold" />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                      For what *
                    </label>
                    <Input
                      value={n.topic}
                      placeholder='e.g. "Running late to rehearsal"'
                      onChange={(e) => updateNorm(i, { topic: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                      Who *
                    </label>
                    <select
                      value={selectValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__other") {
                          updateNorm(i, { userId: null, other: true, contact: linked ? "" : n.contact });
                        } else if (v === "") {
                          updateNorm(i, { userId: null, other: false, contact: "" });
                        } else {
                          const t = teamOptions.find((x) => x.userId === v);
                          if (t) {
                            updateNorm(i, {
                              // Guest team members (no account) get a name only —
                              // no userId, so no "Send a note".
                              userId: t.userId.startsWith("guest-") ? null : t.userId,
                              other: false,
                              contact: `${t.userName} (${formatTeamRole(t.role)})`,
                            });
                          }
                        }
                      }}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-curtain-200 text-curtain-900"
                    >
                      <option value="">Pick a team member…</option>
                      {teamOptions.map((t) => (
                        <option key={t.id} value={t.userId}>
                          {t.userName} — {formatTeamRole(t.role)}
                        </option>
                      ))}
                      <option value="__other">Someone else…</option>
                    </select>
                    {selectValue === "__other" && (
                      <div className="mt-2">
                        <Input
                          value={n.contact}
                          placeholder='Name (e.g. "Dana at the box office")'
                          onChange={(e) => updateNorm(i, { contact: e.target.value, userId: null, other: true })}
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                        Phone
                      </label>
                      <Input
                        type="tel"
                        value={n.phone ?? ""}
                        placeholder="(951) 555-0102"
                        onChange={(e) => updateNorm(i, { phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={n.email ?? ""}
                        placeholder="name@example.com"
                        onChange={(e) => updateNorm(i, { email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                      How <span className="text-clay-400 normal-case font-normal">(optional)</span>
                    </label>
                    <Input
                      value={n.method}
                      placeholder='e.g. "Text first — email if it can wait"'
                      onChange={(e) => updateNorm(i, { method: e.target.value })}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setNormsDraft([...normsDraft, { ...EMPTY_NORM }])}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Add another
          </Button>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setNormsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => normsMutation.mutate()} loading={normsMutation.isPending}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/* ============================================================
   5. Resources — files on the show
   ============================================================ */

function ResourcesSection({
  files,
  isTeam,
  showId,
  userId,
}: {
  files: ShowFile[];
  isTeam: boolean;
  showId: string;
  userId: ID;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["hubFiles", showId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadShowFile(showId, file, file.name, null, userId),
    onSuccess: () => {
      invalidate();
      toast("success", "File uploaded!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const linkMutation = useMutation({
    mutationFn: () => addShowLink({ showId, title: linkTitle, url: linkUrl, userId }),
    onSuccess: () => {
      invalidate();
      toast("success", "Link added!");
      setLinkOpen(false);
      setLinkTitle("");
      setLinkUrl("");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (file: ShowFile) => deleteShowFile(file),
    onSuccess: (_d, file) => {
      invalidate();
      toast("info", file.url ? "Link removed." : "File removed.");
      setDeletingId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const download = async (file: ShowFile) => {
    if (!file.storagePath) return;
    try {
      const url = await getShowFileUrl(file.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Couldn't open the file.");
    }
  };

  const hostOf = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  const linkUrlValid = normalizeLinkUrl(linkUrl) !== null;

  const deleteControls = (f: ShowFile) =>
    isTeam &&
    (deletingId === f.id ? (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="danger"
          onClick={() => deleteMutation.mutate(f)}
          loading={deleteMutation.isPending}
        >
          Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
          Keep
        </Button>
      </div>
    ) : (
      <button
        onClick={() => setDeletingId(f.id)}
        className="p-1.5 rounded-lg hover:bg-cream-50 transition"
        aria-label={`Delete ${f.label}`}
      >
        <Trash className="w-4 h-4 text-clay-300 hover:text-ruby-500" weight="bold" />
      </button>
    ));

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <SectionHeader className="mb-0">Resources</SectionHeader>
        {isTeam && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLinkOpen(true)}
              icon={<LinkSimple className="w-4 h-4" weight="bold" />}
            >
              Add a link
            </Button>
            {isSupabaseConfigured && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadMutation.mutate(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => inputRef.current?.click()}
                  loading={uploadMutation.isPending}
                  icon={<UploadSimple className="w-4 h-4" weight="bold" />}
                >
                  Upload
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {files.length === 0 ? (
        <Card variant="flat" padding="standard">
          <div className="flex items-center gap-3">
            {isSupabaseConfigured ? (
              <FolderOpen className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
            ) : (
              <CloudArrowUp className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
            )}
            <p className="text-sm text-clay-500">
              {!isSupabaseConfigured
                ? "Add links to Drive folders, YouTube, or docs. File uploads (sides, tracks, run sheets — up to 10MB each) arrive with your theatre's cloud setup."
                : isTeam
                  ? "Nothing here yet. Add a link (Drive, YouTube, a doc) or upload sides, rehearsal tracks, run sheets, or forms (up to 10MB each)."
                  : "Nothing here yet. Anything the team shares — links, sides, tracks, forms — shows up here."}
            </p>
          </div>
        </Card>
      ) : (
        <Card variant="elevated" padding="standard">
          <div className="flex flex-col">
            {files.map((f) =>
              f.url ? (
                // Link row (migration 026) — opens in a new tab.
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-cream-100 last:border-0"
                >
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 min-w-0 text-left hover:opacity-75 transition"
                  >
                    <LinkSimple className="w-5 h-5 text-stage-500 flex-shrink-0" weight="duotone" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-curtain-900 truncate">{f.label}</p>
                      <p className="text-xs text-clay-400 truncate">
                        {hostOf(f.url)} · {formatDate(f.createdAt)}
                      </p>
                    </div>
                  </a>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-cream-50 transition"
                      aria-label={`Open ${f.label} in a new tab`}
                    >
                      <ArrowSquareOut className="w-4 h-4 text-stage-500" weight="duotone" />
                    </a>
                    {deleteControls(f)}
                  </div>
                </div>
              ) : (
                // File row — unchanged.
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-cream-100 last:border-0"
                >
                  <button
                    onClick={() => download(f)}
                    className="flex items-center gap-3 min-w-0 text-left hover:opacity-75 transition"
                  >
                    {fileIcon(f.storagePath ?? f.label)}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-curtain-900 truncate">{f.label}</p>
                      <p className="text-xs text-clay-400">
                        {formatBytes(f.sizeBytes)}
                        {f.sizeBytes ? " · " : ""}
                        {formatDate(f.createdAt)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => download(f)}
                      className="p-1.5 rounded-lg hover:bg-cream-50 transition"
                      aria-label={`Download ${f.label}`}
                    >
                      <DownloadSimple className="w-4 h-4 text-stage-500" weight="duotone" />
                    </button>
                    {deleteControls(f)}
                  </div>
                </div>
              )
            )}
          </div>
          {!isSupabaseConfigured && isTeam && (
            <p className="text-[11px] text-clay-400 mt-3 flex items-center gap-1.5">
              <CloudArrowUp className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
              File uploads arrive with your theatre&apos;s cloud setup — links work now.
            </p>
          )}
        </Card>
      )}

      {/* ── Add a link modal (team) ── */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Add a Link">
        <div className="py-2 flex flex-col gap-4">
          <p className="text-sm text-clay-500">
            A Drive folder, a YouTube playlist, a Google Doc — anything with a
            web address. It stays where it lives; the hub just points to it.
          </p>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
              Link *
            </label>
            <Input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              autoFocus
              error={linkUrl.trim() && !linkUrlValid ? "Needs to be a web address starting with http:// or https://" : undefined}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
              Title
            </label>
            <Input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value.slice(0, 120))}
              placeholder='e.g. "Rehearsal tracks" (defaults to the address)'
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => linkMutation.mutate()}
              disabled={!linkUrlValid}
              loading={linkMutation.isPending}
              icon={<LinkSimple className="w-4 h-4" weight="bold" />}
            >
              Add link
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/* ============================================================
   6. Volunteers — dual-path (SHOW_HUB_SPEC.md).
   Company members claim with one tap here; community guests use
   the public /volunteer/[showId] link (no account — approved
   gating exception; it's the growth loop).
   ============================================================ */

type VolunteerDraft = {
  label: string;
  eventDate: string;
  startTime: string; // HH:MM or ""
  endTime: string;
  slots: string;
  notes: string;
};

const EMPTY_VOLUNTEER_DRAFT: VolunteerDraft = {
  label: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  slots: "4",
  notes: "",
};

/** "Fri, Jul 12 · 6:00 PM – 9:30 PM" from a need's date + optional times. */
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

function VolunteersSection({
  isTeam,
  showId,
  userId,
  userName,
}: {
  isTeam: boolean;
  showId: string;
  userId: ID;
  userName: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VolunteerDraft>(EMPTY_VOLUNTEER_DRAFT);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  const { data: needs, isLoading } = useQuery({
    queryKey: ["hubVolunteers", showId],
    queryFn: () => getVolunteerNeeds(showId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["hubVolunteers", showId] });

  const buildInput = (): VolunteerNeedInput | null => {
    if (!draft.label.trim()) {
      toast("error", "Give the need a label — e.g. \"Ushers\".");
      return null;
    }
    const slots = parseInt(draft.slots, 10);
    if (!Number.isFinite(slots) || slots < 1) {
      toast("error", "Slots must be at least 1.");
      return null;
    }
    if (draft.startTime && !draft.eventDate) {
      toast("error", "Add the event date for those times.");
      return null;
    }
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      toast("error", "End time must be after the start time.");
      return null;
    }
    const iso = (hhmm: string) =>
      hhmm && draft.eventDate
        ? new Date(`${draft.eventDate}T${hhmm}:00`).toISOString()
        : null;
    return {
      showId,
      label: draft.label.trim(),
      eventDate: draft.eventDate || null,
      startTime: iso(draft.startTime),
      endTime: iso(draft.endTime),
      slots,
      notes: draft.notes.trim() || null,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = buildInput();
      if (!input) throw new Error("__validation__");
      return editingId
        ? updateVolunteerNeed(editingId, input)
        : createVolunteerNeed(input);
    },
    onSuccess: () => {
      invalidate();
      toast("success", editingId ? "Volunteer need updated!" : "Volunteer need added!");
      setModalOpen(false);
    },
    onError: (err: Error) => {
      if (err.message !== "__validation__") toast("error", err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVolunteerNeed(editingId!),
    onSuccess: () => {
      invalidate();
      toast("info", "Volunteer need removed.");
      setModalOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const claimMutation = useMutation({
    mutationFn: (needId: string) =>
      claimVolunteerSlot({ needId, mockUser: { id: userId, name: userName } }),
    onSuccess: () => {
      invalidate();
      toast("success", "You're on the list — thank you!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const unclaimMutation = useMutation({
    mutationFn: (needId: string) => unclaimVolunteerSlot(needId, userId),
    onSuccess: () => {
      invalidate();
      toast("info", "You gave up your spot.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/volunteer/${showId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("success", "Public signup link copied — share it with your community!");
    } catch {
      toast("error", `Couldn't copy — the link is ${url}`);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setDraft(EMPTY_VOLUNTEER_DRAFT);
    setConfirmDelete(false);
    setModalOpen(true);
  };

  const openEdit = (need: VolunteerNeed) => {
    const toHHMM = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    setEditingId(need.id);
    setDraft({
      label: need.label,
      eventDate: need.eventDate ?? "",
      startTime: toHHMM(need.startTime),
      endTime: toHHMM(need.endTime),
      slots: String(need.slots),
      notes: need.notes ?? "",
    });
    setConfirmDelete(false);
    setModalOpen(true);
  };

  // Past shifts stay visible (who helped) but collapsed and never claimable.
  const allNeeds = needs ?? [];
  const list = allNeeds.filter((n) => !isShiftPast(n));
  const pastList = allNeeds.filter((n) => isShiftPast(n));

  const renderNeed = (need: VolunteerNeed, isPast: boolean) => {
    const filled = need.signups.length;
    const isFull = filled >= need.slots;
    const mine = need.signups.find((s) => s.userId === userId);
    const when = shiftWhen(need);
    return (
      <Card key={need.id} variant="elevated" padding="standard">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-curtain-900">{need.label}</p>
              {isPast ? (
                <Badge size="sm">Past</Badge>
              ) : isFull ? (
                <Badge variant="success" size="sm">Full</Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  {need.slots - filled} open
                </Badge>
              )}
            </div>
            {when && (
              <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {when}
              </p>
            )}
            {need.notes && (
              <p className="text-xs text-clay-500 mt-1">{need.notes}</p>
            )}
            <p className="text-xs font-medium text-curtain-700 mt-2">
              {filled} of {need.slots} filled
            </p>
            {need.signups.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {need.signups.map((s) => (
                  <Pill key={s.id} variant="status" className="cursor-default">
                    {s.name}
                    {s.isGuest && (
                      <span className="ml-1.5 text-[10px] font-semibold text-clay-400 uppercase tracking-wide">
                        guest
                      </span>
                    )}
                  </Pill>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {isPast ? (
                <span className="text-xs text-clay-400">
                  This shift has passed{mine ? " — thank you for helping!" : "."}
                </span>
              ) : mine ? (
                <>
                  <span className="text-xs font-semibold text-forest-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" weight="duotone" />
                    You&apos;re signed up
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unclaimMutation.mutate(need.id)}
                    loading={unclaimMutation.isPending && unclaimMutation.variables === need.id}
                  >
                    Give up my spot
                  </Button>
                </>
              ) : isFull ? (
                <span className="text-xs text-clay-400">
                  All spots are taken — thank you, everyone!
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => claimMutation.mutate(need.id)}
                  loading={claimMutation.isPending && claimMutation.variables === need.id}
                  icon={<HandHeart className="w-4 h-4 text-stage-500" weight="duotone" />}
                >
                  Claim a spot
                </Button>
              )}
            </div>
          </div>
          {isTeam && (
            <button
              onClick={() => openEdit(need)}
              className="text-clay-300 hover:text-stage-500 transition p-1 flex-shrink-0"
              aria-label={`Edit ${need.label}`}
            >
              <PencilSimple className="w-4 h-4" weight="bold" />
            </button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <SectionHeader className="mb-0">Volunteers</SectionHeader>
        {isTeam && (
          <Button
            size="sm"
            variant="ghost"
            onClick={openAdd}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Add a need
          </Button>
        )}
      </div>

      {/* Share the public link — the community guest path (no account). */}
      {isTeam && (
        <Card variant="flat" padding="compact" className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HandHeart className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
              <p className="text-sm text-clay-500">
                Anyone in your community can sign up from the public link — no
                account needed.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={copyPublicLink}
              icon={<LinkSimple className="w-4 h-4 text-stage-500" weight="duotone" />}
            >
              Share public signup link
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card variant="flat" padding="standard">
          <p className="text-sm text-clay-500">Loading volunteer needs…</p>
        </Card>
      ) : allNeeds.length === 0 ? (
        <Card variant="flat" padding="standard">
          <div className="flex items-center gap-3">
            <HandHeart className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
            <p className="text-sm text-clay-500">
              {isTeam
                ? "No volunteer needs yet. Add ushers, concessions, set build — then share the public link."
                : "No volunteer needs yet. When the team posts them, you can claim a spot with one tap."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {list.length === 0 && (
            <Card variant="flat" padding="standard">
              <div className="flex items-center gap-3">
                <HandHeart className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
                <p className="text-sm text-clay-500">
                  {isTeam
                    ? "No upcoming volunteer needs — add the next one when it's planned."
                    : "No upcoming volunteer needs right now."}
                </p>
              </div>
            </Card>
          )}
          {list.map((need) => renderNeed(need, false))}
          {pastList.length > 0 && (
            <div>
              <button
                onClick={() => setPastOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs font-semibold text-clay-500 hover:text-curtain-700 transition py-1"
                aria-expanded={pastOpen}
              >
                <ClockCounterClockwise className="w-4 h-4 text-stage-500" weight="duotone" />
                Past shifts ({pastList.length})
                {pastOpen ? (
                  <CaretUp className="w-3.5 h-3.5" weight="bold" />
                ) : (
                  <CaretDown className="w-3.5 h-3.5" weight="bold" />
                )}
              </button>
              {pastOpen && (
                <div className="flex flex-col gap-3 mt-2">
                  {pastList.map((need) => renderNeed(need, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Add / edit volunteer need modal (team) ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Volunteer Need" : "Add a Volunteer Need"}
      >
        <div className="py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
              What do you need? *
            </label>
            <Input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder='e.g. "Ushers — opening night"'
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                Event date
              </label>
              <Input
                type="date"
                value={draft.eventDate}
                onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                Start
              </label>
              <Input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                End
              </label>
              <Input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
              How many people? *
            </label>
            <Input
              type="number"
              min={1}
              value={draft.slots}
              onChange={(e) => setDraft({ ...draft, slots: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
              Notes
            </label>
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              placeholder="Anything volunteers should know — dress code, where to check in…"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingId ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ruby-500 font-medium">
                    Remove? Signups go with it.
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteMutation.mutate()}
                    loading={deleteMutation.isPending}
                  >
                    Yes, remove
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  icon={<Trash className="w-4 h-4" weight="bold" />}
                >
                  Remove need
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                {editingId ? "Save Changes" : "Add Need"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}
