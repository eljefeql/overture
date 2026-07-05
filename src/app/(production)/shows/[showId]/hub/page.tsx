"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
  updateCommNorms,
  getVolunteerNeeds,
  createVolunteerNeed,
  updateVolunteerNeed,
  deleteVolunteerNeed,
  claimVolunteerSlot,
  unclaimVolunteerSlot,
  resolveCalledUserIds,
  calledLabel,
  nameForUser,
  type HubData,
  type RehearsalInput,
  type VolunteerNeedInput,
} from "@/lib/api/hub";
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
  Phone,
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
  CheckCircle,
} from "@phosphor-icons/react";
import type {
  ID,
  Announcement,
  AnnouncementAudience,
  Rehearsal,
  CalledGroup,
  ShowFile,
  CommNormItem,
  VolunteerNeed,
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

  const { show } = data;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="mb-6 animate-fade-up">
        <h1 className="text-3xl font-display text-curtain-900 mb-1">
          {show.title}
        </h1>
        <p className="text-sm text-clay-500">
          Show Hub — everything the company needs, in one place.
        </p>
      </div>

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
        <PeopleSection data={data} isTeam={isTeam} showId={showId} />
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
  const castIds = data.cast.map((c) => c.actorId);
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
   4. People — cast + team + comm norms routing card
   ============================================================ */

function PeopleSection({
  data,
  isTeam,
  showId,
}: {
  data: HubData;
  isTeam: boolean;
  showId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [normsOpen, setNormsOpen] = useState(false);
  const [normsDraft, setNormsDraft] = useState<CommNormItem[]>([]);

  const normsMutation = useMutation({
    mutationFn: () =>
      updateCommNorms(
        showId,
        normsDraft.filter((n) => n.topic.trim() && n.contact.trim())
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", showId] });
      toast("success", "Contact routing saved!");
      setNormsOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const openNorms = () => {
    setNormsDraft(
      data.commNorms.length > 0
        ? data.commNorms.map((n) => ({ ...n }))
        : [{ topic: "", contact: "", method: "" }]
    );
    setNormsOpen(true);
  };

  // Group multiple accepted roles per person.
  const castPeople = useMemo(() => {
    const byActor = new Map<string, { name: string; roles: string[] }>();
    for (const c of data.cast) {
      const entry = byActor.get(c.actorId) ?? { name: c.actorName, roles: [] };
      entry.roles.push(
        c.assignmentType === "primary"
          ? c.roleName
          : `${c.roleName} (${c.assignmentType})`
      );
      byActor.set(c.actorId, entry);
    }
    return [...byActor.entries()].map(([id, v]) => ({ id, ...v }));
  }, [data.cast]);

  return (
    <section>
      <SectionHeader>People</SectionHeader>
      <div className="flex flex-col gap-3">
        {/* Comm norms — who to contact for what */}
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
            <div className="flex flex-col gap-2">
              {data.commNorms.map((n, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 py-1.5 border-b border-cream-100 last:border-0"
                >
                  <span className="text-sm font-medium text-curtain-900">{n.topic}</span>
                  <span className="text-xs text-clay-500">
                    {n.contact}
                    {n.method ? ` · ${n.method}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-clay-500">
              {isTeam
                ? "Tell the company who to reach for what — running late, costumes, music questions."
                : "The team hasn't set contact routing yet."}
            </p>
          )}
        </Card>

        {/* Cast */}
        <Card variant="elevated" padding="standard">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MaskHappy className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Cast ({castPeople.length})</CardTitle>
            </div>
          </CardHeader>
          {castPeople.length > 0 ? (
            <div className="flex flex-col gap-3">
              {castPeople.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar name={p.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-curtain-900 truncate">{p.name}</p>
                    <p className="text-xs text-clay-500 truncate">{p.roles.join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-clay-500">
              The cast appears here as offers are accepted.
            </p>
          )}
        </Card>

        {/* Team */}
        <Card variant="elevated" padding="standard">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersThree className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Production Team ({data.team.length})</CardTitle>
            </div>
          </CardHeader>
          <div className="flex flex-col gap-3">
            {data.team.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={t.userName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-curtain-900 truncate">{t.userName}</p>
                    <p className="text-xs text-clay-500">{formatTeamRole(t.role)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.email && (
                    <a
                      href={`mailto:${t.email}`}
                      className="p-1.5 rounded-lg hover:bg-cream-50 transition"
                      aria-label={`Email ${t.userName}`}
                    >
                      <Envelope className="w-4 h-4 text-stage-500" weight="duotone" />
                    </a>
                  )}
                  {t.phone && (
                    <a
                      href={`tel:${t.phone}`}
                      className="p-1.5 rounded-lg hover:bg-cream-50 transition"
                      aria-label={`Call ${t.userName}`}
                    >
                      <Phone className="w-4 h-4 text-stage-500" weight="duotone" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Edit comm norms modal ── */}
      <Modal open={normsOpen} onClose={() => setNormsOpen(false)} title="Who to Contact">
        <div className="py-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-clay-500">
            Route questions before they become group texts — &quot;running late → text the
            SM&quot;, &quot;costumes → email the designer&quot;.
          </p>
          {normsDraft.map((n, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
              <Input
                value={n.topic}
                placeholder="Topic (e.g. Running late)"
                onChange={(e) => {
                  const next = [...normsDraft];
                  next[i] = { ...n, topic: e.target.value };
                  setNormsDraft(next);
                }}
              />
              <Input
                value={n.contact}
                placeholder="Who (e.g. Tom Briggs, SM)"
                onChange={(e) => {
                  const next = [...normsDraft];
                  next[i] = { ...n, contact: e.target.value };
                  setNormsDraft(next);
                }}
              />
              <Input
                value={n.method}
                placeholder="How (e.g. Text (951) 555-0102)"
                onChange={(e) => {
                  const next = [...normsDraft];
                  next[i] = { ...n, method: e.target.value };
                  setNormsDraft(next);
                }}
              />
              <button
                onClick={() => setNormsDraft(normsDraft.filter((_, j) => j !== i))}
                className="text-clay-300 hover:text-ruby-500 transition p-2"
                aria-label="Remove row"
              >
                <Trash className="w-4 h-4" weight="bold" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setNormsDraft([...normsDraft, { topic: "", contact: "", method: "" }])}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Add a row
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

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadShowFile(showId, file, file.name, null, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hubFiles", showId] });
      toast("success", "File uploaded!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (file: ShowFile) => deleteShowFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hubFiles", showId] });
      toast("info", "File removed.");
      setDeletingId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const download = async (file: ShowFile) => {
    try {
      const url = await getShowFileUrl(file.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Couldn't open the file.");
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader className="mb-0">Resources</SectionHeader>
        {isTeam && isSupabaseConfigured && (
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

      {!isSupabaseConfigured ? (
        <Card variant="flat" padding="standard">
          <div className="flex items-center gap-3">
            <CloudArrowUp className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
            <p className="text-sm text-clay-500">
              File sharing — sides, tracks, run sheets — arrives with your
              theatre&apos;s cloud setup. Uploads up to 10MB each.
            </p>
          </div>
        </Card>
      ) : files.length === 0 ? (
        <Card variant="flat" padding="standard">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-stage-500 flex-shrink-0" weight="duotone" />
            <p className="text-sm text-clay-500">
              {isTeam
                ? "No files yet. Upload sides, rehearsal tracks, run sheets, or forms (up to 10MB each)."
                : "No files yet. Anything the team shares — sides, tracks, forms — shows up here."}
            </p>
          </div>
        </Card>
      ) : (
        <Card variant="elevated" padding="standard">
          <div className="flex flex-col">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-cream-100 last:border-0"
              >
                <button
                  onClick={() => download(f)}
                  className="flex items-center gap-3 min-w-0 text-left hover:opacity-75 transition"
                >
                  {fileIcon(f.storagePath)}
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
                  {isTeam &&
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
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
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

  const list = needs ?? [];

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
      ) : list.length === 0 ? (
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
          {list.map((need) => {
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
                      {isFull ? (
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
                      {mine ? (
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
          })}
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
