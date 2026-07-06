"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShow,
  getShowRoles,
  getShowTeam,
  getAuditionGroups,
  getAuditionSignups,
  getCallbacks,
  updateShow,
  createShowRole,
  updateShowRole,
  deleteShowRole,
  addTeamMember,
  removeTeamMember,
  createAuditionGroup,
  updateAuditionGroup,
  deleteAuditionGroup,
} from "@/lib/api/client";
import { uploadShowPoster } from "@/lib/api/photos";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Pill,
  PageSkeleton,
  StatBlock,
  SectionHeader,
  EmptyState,
  Input,
  Textarea,
  Modal,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate, formatTime, formatTeamRole, groupBlocksByDay } from "@/lib/utils";
import {
  PencilSimple,
  Plus,
  Trash,
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  Warning,
  Calendar,
  MapPin,
  Users,
  MaskHappy,
  CheckCircle,
  Circle,
  ListChecks,
  Megaphone,
  Lightning,
  Image as ImageIcon,
  ArrowSquareOut,
  LinkSimple,
  Clock,
  CalendarX,
  HouseLine,
} from "@phosphor-icons/react";
import { SHOW_STATUS_LABELS } from "@/lib/constants";
import type { ShowStatus, ShowType, RoleType, GenderReq, TeamRole } from "@/types";

/* ============================================================
   Show Setup — Home base for a show. View + edit all config.
   ============================================================ */

const NEXT_STATUS: Partial<Record<ShowStatus, { label: string; next: ShowStatus; confirm: string }>> = {
  setup: { label: "Open Auditions", next: "auditions_open", confirm: "Open auditions? Your show will appear in the Discover feed for actors." },
  auditions_open: { label: "Close Auditions", next: "auditions_closed", confirm: "Close auditions? No new signups will be accepted." },
  auditions_closed: { label: "Move to Callbacks", next: "callbacks", confirm: "Move to the callback phase?" },
  callbacks: { label: "Move to Casting", next: "casting", confirm: "Move to casting? Make sure all callbacks have been sent." },
  casting: { label: "Publish Cast List", next: "cast", confirm: "Publish the cast list? This will notify all actors." },
};

// Backward transitions — only statuses with a SAFE step back. Deliberately
// no entry for 'cast': un-publishing a cast list lives on the Cast List page
// (Unpublish), so the setup page points there instead of duplicating it.
const PREV_STATUS: Partial<Record<ShowStatus, { label: string; prev: ShowStatus; confirm: string; warning: string }>> = {
  auditions_closed: {
    label: "Reopen Auditions",
    prev: "auditions_open",
    confirm: "Reopen auditions?",
    warning: "The show becomes publicly signable again — new actors will be able to sign up.",
  },
  callbacks: {
    label: "Back to Auditions Closed",
    prev: "auditions_closed",
    confirm: "Step back to the closed-auditions phase?",
    warning: "Callbacks you've already created are kept, but actors already notified about callbacks won't be un-notified.",
  },
  casting: {
    label: "Back to Callbacks",
    prev: "callbacks",
    confirm: "Step back to the callback phase?",
    warning: "Your casting-board work is kept. Any offers you've already sent stay active — actors won't be notified of this change.",
  },
  archived: {
    label: "Restore from Archive",
    prev: "cast",
    confirm: "Restore this show from the archive?",
    warning: "The show returns to your active shows with its cast list and history intact.",
  },
};

const SHOW_TYPES: { value: ShowType; label: string }[] = [
  { value: "musical", label: "Musical" },
  { value: "play", label: "Play" },
  { value: "revue", label: "Revue" },
];

const ROLE_TYPES: { value: RoleType; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "supporting", label: "Supporting" },
  { value: "featured_ensemble", label: "Featured Ensemble" },
  { value: "ensemble", label: "Ensemble" },
];

const GENDER_OPTIONS: { value: GenderReq; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
];

const TEAM_ROLES: { value: TeamRole; label: string }[] = [
  { value: "director", label: "Director" },
  { value: "music_director", label: "Music Director" },
  { value: "choreographer", label: "Choreographer" },
  { value: "stage_manager", label: "Stage Manager" },
  { value: "producer", label: "Producer" },
  { value: "asst_director", label: "Asst. Director" },
  { value: "asst_stage_manager", label: "Asst. SM" },
  { value: "accompanist", label: "Accompanist" },
];

export default function ShowSetupPage() {
  const { showId } = useParams<{ showId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stepBackOpen, setStepBackOpen] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);

  // Callback scheduling form
  const [callbackForm, setCallbackForm] = useState({
    callbackDate: "", callbackStartTime: "", callbackEndTime: "",
    callbackLocation: "", callbackNotes: "",
  });

  // Edit details form
  const [editForm, setEditForm] = useState({
    title: "", authorInfo: "", showType: "musical" as ShowType,
    season: "", city: "", state: "", auditionLocation: "",
    auditionStart: "", auditionEnd: "", callbackDate: "",
    callbackLocation: "", auditionNotes: "",
    rehearsalStart: "", showOpen: "", showClose: "",
  });

  // Add role form
  const [roleDraft, setRoleDraft] = useState({
    name: "", roleType: "lead" as RoleType, gender: "any" as GenderReq,
    ageRange: "", vocalRange: "", description: "",
  });

  // Edit role form
  const [editRoleDraft, setEditRoleDraft] = useState({
    name: "", roleType: "lead" as RoleType, gender: "any" as GenderReq,
    ageRange: "", vocalRange: "", description: "",
  });

  // Generate-day form — one day → many auto-generated blocks.
  const [genDraft, setGenDraft] = useState({
    date: "", startTime: "18:00", endTime: "21:00", blockMinutes: 30, capacity: 5,
  });

  // Add member form
  const [memberDraft, setMemberDraft] = useState({
    name: "", email: "", role: "stage_manager" as TeamRole, canEvaluate: false, phone: "",
  });

  // ── Data fetching ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["showSetup", showId],
    queryFn: async () => {
      const [show, roles, team, groups, signups, cbs] = await Promise.all([
        getShow(showId),
        getShowRoles(showId),
        getShowTeam(showId),
        getAuditionGroups(showId),
        getAuditionSignups(showId),
        getCallbacks(showId),
      ]);
      return { show, roles, team, groups, signups, callbacks: cbs };
    },
  });

  // ── Mutations ──
  const statusMutation = useMutation({
    mutationFn: (newStatus: ShowStatus) => updateShow(showId, { status: newStatus }),
    onSuccess: (_data, newStatus) => {
      if (newStatus === "auditions_open") track("auditions_opened", { showId });
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Show status updated!");
      setConfirmOpen(false);
      setStepBackOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const updateShowMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => updateShow(showId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Show details updated!");
      setEditDetailsOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const callbackMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => updateShow(showId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      toast("success", "Callback details saved!");
      setCallbackOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const addRoleMutation = useMutation({
    mutationFn: createShowRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", "Role added!");
      setRoleDraft({ name: "", roleType: "lead", gender: "any", ageRange: "", vocalRange: "", description: "" });
      setAddRoleOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const editRoleMutation = useMutation({
    mutationFn: ({ roleId, updates }: { roleId: string; updates: Record<string, unknown> }) =>
      updateShowRole(roleId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", "Role updated!");
      setEditRoleOpen(false);
      setEditRoleId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteShowRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("info", "Role removed.");
    },
  });

  const generateDayMutation = useMutation({
    mutationFn: async (blocks: Omit<typeof groups[0], "id">[]) => {
      // Create the blocks sequentially so sort_order stays stable.
      for (const block of blocks) {
        await createAuditionGroup(block);
      }
      return blocks.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", `Generated ${count} audition ${count === 1 ? "block" : "blocks"}!`);
      setGenDraft({ date: "", startTime: "18:00", endTime: "21:00", blockMinutes: 30, capacity: 5 });
      setAddSlotOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteAuditionGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("info", "Time slot removed.");
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: addTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", "Team member added!");
      setMemberDraft({ name: "", email: "", role: "stage_manager", canEvaluate: false, phone: "" });
      setAddMemberOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("info", "Team member removed.");
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.show) return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <EmptyState
        icon={<Warning className="w-12 h-12" weight="duotone" />}
        title="Unable to load show"
        description="Something went wrong loading this show. Please try again."
        action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
      />
    </div>
  );

  const { show, roles, team, groups, signups, callbacks: cbs } = data;
  const nextAction = NEXT_STATUS[show.status];
  const backAction = PREV_STATUS[show.status];

  // ── Checklist state (only meaningful while the show is being set up) ──
  const hasRoles = roles.length > 0;
  const hasTeam = team.length > 1; // creator counts as one; >1 means they invited someone
  const hasSchedule = groups.length > 0;
  const isLive = show.status !== "setup";
  // "Open auditions" is the final step — done once the show has left setup.
  const checklistSteps = [
    { key: "created", label: "Show created", done: true, optional: false, action: null as null | (() => void), cta: "" },
    { key: "roles", label: "Add roles", done: hasRoles, optional: false, action: () => setAddRoleOpen(true), cta: hasRoles ? "Add more" : "Add a role" },
    { key: "team", label: "Build your team", done: hasTeam, optional: true, action: () => setAddMemberOpen(true), cta: hasTeam ? "Manage" : "Invite" },
    { key: "schedule", label: "Schedule auditions", done: hasSchedule, optional: false, action: () => setAddSlotOpen(true), cta: hasSchedule ? "Add a day" : "Schedule" },
    { key: "open", label: "Open auditions", done: isLive, optional: false, action: () => setConfirmOpen(true), cta: "Open" },
  ];
  const requiredDone = checklistSteps.filter((s) => !s.optional && s.done).length;
  const requiredTotal = checklistSteps.filter((s) => !s.optional).length;

  // Stats
  const signupCount = signups.length;
  const checkedIn = signups.filter((s) => s.status === "checked_in").length;
  const auditioned = signups.filter((s) => s.status === "auditioned").length;
  const callbackCount = cbs.length;
  const accepted = cbs.filter((c) => c.status === "accepted").length;

  // Open edit details with current values pre-filled
  const openEditDetails = () => {
    setEditForm({
      title: show.title,
      authorInfo: show.authorInfo ?? "",
      showType: show.showType,
      season: show.season ?? "",
      city: show.city,
      state: show.state,
      auditionLocation: show.auditionLocation ?? "",
      auditionStart: show.auditionStart ?? "",
      auditionEnd: show.auditionEnd ?? "",
      callbackDate: show.callbackDate ?? "",
      callbackLocation: show.callbackLocation ?? "",
      auditionNotes: show.auditionNotes ?? "",
      rehearsalStart: show.rehearsalStart ?? "",
      showOpen: show.showOpen ?? "",
      showClose: show.showClose ?? "",
    });
    setEditDetailsOpen(true);
  };

  const submitEditDetails = () => {
    if (!editForm.title.trim()) {
      toast("error", "Show title is required.");
      return;
    }
    if (!editForm.city.trim()) {
      toast("error", "City is required.");
      return;
    }
    // Date validation
    if (editForm.auditionStart && editForm.auditionEnd && editForm.auditionEnd < editForm.auditionStart) {
      toast("error", "Audition end date must be after start date.");
      return;
    }
    if (editForm.auditionEnd && editForm.callbackDate && editForm.callbackDate < editForm.auditionEnd) {
      toast("error", "Callback date should be after auditions end.");
      return;
    }
    if (editForm.showOpen && editForm.showClose && editForm.showClose < editForm.showOpen) {
      toast("error", "Show close date must be after opening date.");
      return;
    }
    if (editForm.rehearsalStart && editForm.showOpen && editForm.rehearsalStart > editForm.showOpen) {
      toast("error", "Rehearsal should start before opening night.");
      return;
    }
    updateShowMutation.mutate(editForm);
  };

  const openEditRole = (role: typeof roles[0]) => {
    setEditRoleId(role.id);
    setEditRoleDraft({
      name: role.name,
      roleType: role.roleType,
      gender: role.gender ?? "any",
      ageRange: role.ageRange ?? "",
      vocalRange: role.vocalRange ?? "",
      description: role.description ?? "",
    });
    setEditRoleOpen(true);
  };

  const submitEditRole = () => {
    if (!editRoleId || !editRoleDraft.name.trim()) {
      toast("error", "Role name is required.");
      return;
    }
    editRoleMutation.mutate({
      roleId: editRoleId,
      updates: {
        name: editRoleDraft.name.trim(),
        roleType: editRoleDraft.roleType,
        gender: editRoleDraft.gender,
        ageRange: editRoleDraft.ageRange || null,
        vocalRange: editRoleDraft.vocalRange || null,
        description: editRoleDraft.description || null,
      },
    });
  };

  const submitRole = () => {
    if (!roleDraft.name.trim()) {
      toast("error", "Role name is required.");
      return;
    }
    addRoleMutation.mutate({
      showId,
      name: roleDraft.name.trim(),
      roleType: roleDraft.roleType,
      gender: roleDraft.gender,
      ageRange: roleDraft.ageRange || null,
      vocalRange: roleDraft.vocalRange || null,
      description: roleDraft.description || null,
      sortOrder: roles.length,
    });
  };

  // Build the list of audition dates available based on show.auditionStart/auditionEnd
  const auditionDates = (() => {
    const dates: string[] = [];
    if (!show.auditionStart) return dates;
    const start = new Date(show.auditionStart + "T00:00:00");
    const endStr = show.auditionEnd ?? show.auditionStart;
    const end = new Date(endStr + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  })();
  const singleAuditionDate = auditionDates.length === 1 ? auditionDates[0] : null;

  // Format an HH:MM (24h) string into a friendly "6:00 PM" label.
  const labelFromTime = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  // Compute the blocks the current generate form would produce (preview).
  const computeBlocks = () => {
    const dateStr = genDraft.date || singleAuditionDate || show.auditionStart || "";
    if (!dateStr || !genDraft.startTime || !genDraft.endTime) return [];
    const start = new Date(`${dateStr}T${genDraft.startTime}:00`);
    const end = new Date(`${dateStr}T${genDraft.endTime}:00`);
    const stepMs = genDraft.blockMinutes * 60 * 1000;
    if (!(end > start) || stepMs <= 0) return [];
    const blocks: { name: string; startTime: string; endTime: string; slotCount: number }[] = [];
    let cursor = start.getTime();
    let guard = 0;
    while (cursor < end.getTime() && guard < 200) {
      const blockStart = new Date(cursor);
      const blockEnd = new Date(Math.min(cursor + stepMs, end.getTime()));
      blocks.push({
        name: blockStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        startTime: blockStart.toISOString(),
        endTime: blockEnd.toISOString(),
        slotCount: genDraft.capacity,
      });
      cursor += stepMs;
      guard++;
    }
    return blocks;
  };

  const previewBlocks = computeBlocks();

  const submitGenerateDay = () => {
    const dateStr = genDraft.date || singleAuditionDate || show.auditionStart || "";
    if (!dateStr) {
      toast("error", "Pick an audition date first.");
      return;
    }
    if (genDraft.endTime <= genDraft.startTime) {
      toast("error", "End time must be after start time.");
      return;
    }
    if (genDraft.blockMinutes <= 0) {
      toast("error", "Block length must be at least 1 minute.");
      return;
    }
    const blocks = computeBlocks();
    if (blocks.length === 0) {
      toast("error", "That window doesn't produce any blocks — check your times.");
      return;
    }
    generateDayMutation.mutate(
      blocks.map((b, i) => ({
        showId,
        name: b.name,
        startTime: b.startTime,
        endTime: b.endTime,
        slotCount: b.slotCount,
        sortOrder: groups.length + i,
      }))
    );
  };

  const submitMember = () => {
    if (!memberDraft.name.trim()) {
      toast("error", "Name is required.");
      return;
    }
    addMemberMutation.mutate({
      showId,
      userId: `user-${Date.now()}`,
      userName: memberDraft.name.trim(),
      role: memberDraft.role,
      canEvaluate: memberDraft.canEvaluate,
      email: memberDraft.email || null,
      phone: memberDraft.phone || null,
    });
  };

  // Times are stored as full timestamps (e.g. "2026-04-16T18:00:00"); the
  // <input type="time"> needs "HH:MM". Extract one from either format.
  const toInputTime = (v: string | null) => {
    if (!v) return "";
    const m = /T(\d{2}:\d{2})/.exec(v);
    if (m) return m[1];
    if (/^\d{2}:\d{2}/.test(v)) return v.slice(0, 5);
    return "";
  };

  const openCallback = () => {
    setCallbackForm({
      callbackDate: show.callbackDate ?? "",
      callbackStartTime: toInputTime(show.callbackStartTime),
      callbackEndTime: toInputTime(show.callbackEndTime),
      callbackLocation: show.callbackLocation ?? "",
      callbackNotes: show.callbackNotes ?? "",
    });
    setCallbackOpen(true);
  };

  const submitCallback = () => {
    if (
      callbackForm.callbackStartTime &&
      callbackForm.callbackEndTime &&
      callbackForm.callbackEndTime <= callbackForm.callbackStartTime
    ) {
      toast("error", "Callback end time must be after the start time.");
      return;
    }
    // Rebuild full timestamps anchored to the callback date (fallback: today).
    // Construct the instant as LOCAL time, then serialize to UTC — a naked
    // "YYYY-MM-DDTHH:MM:00" string gets read as UTC by timestamptz, which
    // shifted a 6:30 PM entry to render as 2:30 PM.
    const dateAnchor = callbackForm.callbackDate || new Date().toISOString().slice(0, 10);
    const toTimestamp = (hhmm: string) =>
      hhmm ? new Date(`${dateAnchor}T${hhmm}:00`).toISOString() : null;
    callbackMutation.mutate({
      callbackDate: callbackForm.callbackDate || null,
      callbackStartTime: toTimestamp(callbackForm.callbackStartTime),
      callbackEndTime: toTimestamp(callbackForm.callbackEndTime),
      callbackLocation: callbackForm.callbackLocation.trim() || null,
      callbackNotes: callbackForm.callbackNotes.trim() || null,
    });
  };

  const publicAuditionUrl =
    typeof window !== "undefined" ? `${window.location.origin}/auditions/${showId}` : `/auditions/${showId}`;

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicAuditionUrl);
      toast("success", "Public link copied to clipboard!");
    } catch {
      toast("error", "Couldn't copy — try again.");
    }
  };

  const formatTimeRange = (start: string | null, end: string | null) => {
    if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
    if (start) return formatTime(start);
    return "";
  };

  const hasCallbackInfo =
    show.callbackDate || show.callbackStartTime || show.callbackLocation || show.callbackNotes;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ── Show Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-display text-curtain-900">{show.title}</h1>
            <Badge variant={show.status === "auditions_open" || show.status === "cast" ? "success" : "default"} size="md">
              {SHOW_STATUS_LABELS[show.status]}
            </Badge>
          </div>
          {show.authorInfo && (
            <p className="text-sm text-clay-500">{show.authorInfo}</p>
          )}
          <div className="flex items-center gap-3 text-sm text-clay-500 mt-1">
            <Pill variant="status" className="cursor-default">{show.showType === "musical" ? "Musical" : show.showType === "play" ? "Play" : "Revue"}</Pill>
            {show.season && <span>{show.season}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {backAction && (
            <Button
              variant="ghost"
              onClick={() => setStepBackOpen(true)}
              icon={<ArrowLeft className="w-4 h-4" weight="bold" />}
            >
              Step back
            </Button>
          )}
          {show.status === "cast" && (
            // Un-publishing a cast list is the Cast List page's Unpublish —
            // point there instead of duplicating the flow.
            <Button
              variant="ghost"
              onClick={() => {
                toast("info", "To step back from a published cast list, use Unpublish on the Cast List page.");
                router.push(`/shows/${showId}/cast-list`);
              }}
              icon={<ArrowLeft className="w-4 h-4" weight="bold" />}
            >
              Step back
            </Button>
          )}
          {nextAction && (
            <Button
              onClick={() => setConfirmOpen(true)}
              icon={show.status === "auditions_open" ? <Pause className="w-4 h-4" weight="bold" /> : <Play className="w-4 h-4" weight="bold" />}
            >
              {nextAction.label}
            </Button>
          )}
        </div>
      </div>

      {/* ── Progress Checklist (lead with this while setting up) ── */}
      {show.status === "setup" && (
        <Card variant="elevated" className="mb-6 animate-fade-up" style={{ animationDelay: "25ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Get this show ready</CardTitle>
            </div>
            <span className="text-xs font-semibold text-clay-500">
              {requiredDone}/{requiredTotal} essentials
            </span>
          </CardHeader>
          <p className="text-sm text-clay-500 -mt-2 mb-4">
            Nothing here is public until you open auditions. Work through these at your own pace.
          </p>
          <div className="flex flex-col gap-2">
            {checklistSteps.map((step) => (
              <div
                key={step.key}
                className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  {step.done ? (
                    <CheckCircle className="w-5 h-5 text-forest-500 flex-shrink-0" weight="fill" />
                  ) : (
                    <Circle className="w-5 h-5 text-clay-300 flex-shrink-0" weight="duotone" />
                  )}
                  <span className={`text-sm font-medium ${step.done ? "text-clay-400 line-through" : "text-curtain-900"}`}>
                    {step.label}
                  </span>
                  {step.optional && (
                    <span className="text-[10px] font-semibold text-clay-400 uppercase tracking-wide">Optional</span>
                  )}
                </div>
                {step.action && (
                  step.key === "open" ? (
                    <Button
                      size="sm"
                      variant={hasRoles && hasSchedule ? "primary" : "outline"}
                      onClick={step.action}
                      icon={<Megaphone className="w-4 h-4" weight={hasRoles && hasSchedule ? "bold" : "duotone"} />}
                    >
                      {step.cta}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={step.action} icon={<ArrowRight className="w-3.5 h-3.5" weight="bold" />}>
                      {step.cta}
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
        <StatBlock label="Signups" value={String(signupCount)} />
        <StatBlock label="Checked In" value={String(checkedIn)} />
        <StatBlock label="Auditioned" value={String(auditioned)} />
        <StatBlock label="Callbacks" value={String(callbackCount)} />
        <StatBlock label="Accepted" value={String(accepted)} />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Details Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle>Show Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={openEditDetails} icon={<PencilSimple className="w-4 h-4" weight="bold" />}>
                Edit
              </Button>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {show.auditionStart && (
                <div className="flex items-center gap-2 text-curtain-800">
                  <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
                  Auditions: {formatDate(show.auditionStart)}{show.auditionEnd && show.auditionEnd !== show.auditionStart ? ` – ${formatDate(show.auditionEnd)}` : ""}
                </div>
              )}
              {show.callbackDate && (
                <div className="flex items-center gap-2 text-curtain-800">
                  <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
                  Callbacks: {formatDate(show.callbackDate)}
                </div>
              )}
              {show.auditionLocation && (
                <div className="flex items-center gap-2 text-curtain-800 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-stage-500" weight="duotone" />
                  {show.auditionLocation}
                </div>
              )}
              {show.auditionNotes && (
                <p className="text-xs text-clay-500 sm:col-span-2 mt-2">
                  {show.auditionNotes}
                </p>
              )}
            </div>
          </Card>

          {/* Poster Card */}
          <PosterCard
            orgId={show.orgId}
            showId={show.id}
            title={show.title}
            posterUrl={show.posterUrl}
          />

          {/* Roles Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "150ms" }}>
            <CardHeader>
              <CardTitle>Roles ({roles.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddRoleOpen(true)} icon={<Plus className="w-4 h-4" weight="bold" />}>
                Add
              </Button>
            </CardHeader>
            {roles.length > 0 ? (
              <div className="flex flex-col gap-2">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                    <button
                      onClick={() => openEditRole(role)}
                      className="flex items-center gap-2 hover:opacity-70 transition text-left"
                    >
                      <span className="text-sm font-semibold text-curtain-900">{role.name}</span>
                      <Badge variant="default" size="sm">{role.roleType.replace("_", " ")}</Badge>
                      {role.gender && (
                        <span className="text-xs text-clay-400">{role.gender === "any" ? "any gender" : role.gender}</span>
                      )}
                      <PencilSimple className="w-3 h-3 text-clay-300" weight="bold" />
                    </button>
                    <button
                      onClick={() => deleteRoleMutation.mutate(role.id)}
                      className="text-clay-300 hover:text-ruby-500 transition p-1"
                    >
                      <Trash className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay-500">No roles defined yet.</p>
            )}
          </Card>

          {/* Schedule Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle>Audition Schedule ({groups.length} blocks)</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddSlotOpen(true)} icon={<Lightning className="w-4 h-4" weight="bold" />}>
                Generate a Day
              </Button>
            </CardHeader>
            {groups.length > 0 ? (
              <div className="flex flex-col gap-4">
                {groupBlocksByDay(groups).map((day) => (
                  <div key={day.dateKey}>
                    <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
                      {day.label}
                    </p>
                    <div className="flex flex-col gap-2">
                      {day.blocks.map((group) => {
                        const filled = signups.filter((s) => s.groupId === group.id).length;
                        return (
                          <div key={group.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                            <span className="text-sm font-semibold text-curtain-900">
                              {new Date(group.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              {" – "}
                              {new Date(group.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${filled >= group.slotCount ? "text-ruby-500" : "text-clay-500"}`}>
                                {filled}/{group.slotCount} filled{filled >= group.slotCount ? " · Full" : ""}
                              </span>
                              <button
                                onClick={() => deleteGroupMutation.mutate(group.id)}
                                className="text-clay-300 hover:text-ruby-500 transition p-1"
                              >
                                <Trash className="w-4 h-4" weight="bold" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay-500">No time slots defined yet.</p>
            )}
          </Card>

          {/* Callbacks Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "225ms" }}>
            <CardHeader>
              <CardTitle>Callbacks</CardTitle>
              <Button variant="ghost" size="sm" onClick={openCallback} icon={<PencilSimple className="w-4 h-4" weight="bold" />}>
                {hasCallbackInfo ? "Edit" : "Schedule"}
              </Button>
            </CardHeader>
            {hasCallbackInfo ? (
              <div className="flex flex-col gap-2 text-sm">
                {show.callbackDate && (
                  <div className="flex items-center gap-2 text-curtain-800">
                    <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
                    {formatDate(show.callbackDate)}
                    {formatTimeRange(show.callbackStartTime, show.callbackEndTime) && (
                      <span className="text-clay-500">
                        · {formatTimeRange(show.callbackStartTime, show.callbackEndTime)}
                      </span>
                    )}
                  </div>
                )}
                {!show.callbackDate && formatTimeRange(show.callbackStartTime, show.callbackEndTime) && (
                  <div className="flex items-center gap-2 text-curtain-800">
                    <Clock className="w-4 h-4 text-stage-500" weight="duotone" />
                    {formatTimeRange(show.callbackStartTime, show.callbackEndTime)}
                  </div>
                )}
                {show.callbackLocation && (
                  <div className="flex items-center gap-2 text-curtain-800">
                    <MapPin className="w-4 h-4 text-stage-500" weight="duotone" />
                    {show.callbackLocation}
                  </div>
                )}
                {show.callbackNotes && (
                  <p className="text-xs text-clay-500 mt-1">{show.callbackNotes}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-clay-500">
                No callback scheduled yet. Set the date, time, and location actors will need
                — it shows on their audition page once they&apos;re called back.
              </p>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Team Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle>Team ({team.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddMemberOpen(true)} icon={<Plus className="w-4 h-4" weight="bold" />}>
                Add
              </Button>
            </CardHeader>
            {team.length > 0 ? (
              <div className="flex flex-col gap-3">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-curtain-900">{member.userName}</span>
                      </div>
                      <p className="text-xs text-clay-500">{formatTeamRole(member.role)}{member.canEvaluate ? " · Evaluator" : ""}</p>
                    </div>
                    <button
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      className="text-clay-300 hover:text-ruby-500 transition p-1"
                    >
                      <Trash className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay-500">No team members yet.</p>
            )}
          </Card>

          {/* Share public audition page */}
          <Card variant="flat" className="animate-fade-up" style={{ animationDelay: "140ms" }}>
            <SectionHeader>Public Audition Page</SectionHeader>
            {show.status === "setup" ? (
              <p className="text-sm text-clay-500">
                Your show is a private draft. Open auditions to publish a shareable public
                page actors can sign up from.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <a href={`/auditions/${showId}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-center" icon={<ArrowSquareOut className="w-4 h-4 text-stage-500" weight="duotone" />}>
                    View public page
                  </Button>
                </a>
                <Button variant="ghost" size="sm" className="w-full justify-center" onClick={copyPublicLink} icon={<LinkSimple className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  Copy link
                </Button>
                <p className="text-[11px] text-clay-400 leading-snug">
                  Share this link on social media so actors can find your auditions.
                </p>
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card variant="flat" className="animate-fade-up" style={{ animationDelay: "150ms" }}>
            <SectionHeader>Quick Actions</SectionHeader>
            <div className="flex flex-col gap-2">
              {show.status === "setup" && nextAction && (
                <Button size="sm" className="w-full justify-center" onClick={() => setConfirmOpen(true)} icon={<Play className="w-4 h-4" weight="bold" />}>
                  {nextAction.label}
                </Button>
              )}
              {(show.status === "auditions_open" || show.status === "auditions_closed") && (
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => router.push(`/shows/${showId}/auditions`)} icon={<Users className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  View Audition Schedule
                </Button>
              )}
              {show.status !== "setup" && (
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => router.push(`/shows/${showId}/conflicts`)} icon={<CalendarX className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  Conflict Calendar
                </Button>
              )}
              {show.status === "callbacks" && (
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => router.push(`/shows/${showId}/callbacks`)} icon={<MaskHappy className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  Manage Callbacks
                </Button>
              )}
              {show.status === "casting" && (
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => router.push(`/shows/${showId}/casting`)} icon={<MaskHappy className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  Go to Casting Board
                </Button>
              )}
              {(show.status === "cast" || show.status === "archived") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => router.push(`/shows/${showId}/hub`)}
                  icon={<HouseLine className="w-4 h-4 text-stage-500" weight="duotone" />}
                >
                  Open the Show Hub
                </Button>
              )}
              {show.status === "cast" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    if (window.confirm("Archive this show? It moves to your archive and stops appearing in active lists. Cast and history are preserved.")) {
                      statusMutation.mutate("archived");
                    }
                  }}
                >
                  Archive Show
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Status Transition Confirmation Modal ── */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Status Change">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-4">
            {nextAction?.confirm}
          </p>
          {/* Guardrails — warn about missing prerequisites */}
          {show.status === "setup" && roles.length === 0 && (
            <p className="text-xs text-ruby-500 mb-2">You haven&apos;t defined any roles yet. Actors won&apos;t know what to audition for.</p>
          )}
          {show.status === "setup" && groups.length === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No audition time slots defined. Actors won&apos;t be able to sign up.</p>
          )}
          {show.status === "auditions_closed" && signupCount === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No actors have signed up yet. Are you sure you want to move to callbacks?</p>
          )}
          {show.status === "callbacks" && callbackCount === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No callbacks have been created yet. Moving to casting with no callback pool.</p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => nextAction && statusMutation.mutate(nextAction.next)}
              loading={statusMutation.isPending}
            >
              {nextAction?.label}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Step Back Confirmation Modal ── */}
      <Modal open={stepBackOpen} onClose={() => setStepBackOpen(false)} title="Step Back">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-2">
            {backAction?.confirm}
          </p>
          {/* Honest warning about what stepping back does (and doesn't) undo */}
          {backAction?.warning && (
            <p className="text-xs text-ruby-500 mb-4 max-w-sm">{backAction.warning}</p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStepBackOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => backAction && statusMutation.mutate(backAction.prev)}
              loading={statusMutation.isPending}
            >
              {backAction?.label}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Show Details Modal ── */}
      <Modal open={editDetailsOpen} onClose={() => setEditDetailsOpen(false)} title="Edit Show Details">
        <div className="py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Title *</label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Author / Composer</label>
              <Input value={editForm.authorInfo} onChange={(e) => setEditForm({ ...editForm, authorInfo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Show Type *</label>
              <select
                value={editForm.showType}
                onChange={(e) => setEditForm({ ...editForm, showType: e.target.value as ShowType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {SHOW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Season</label>
              <Input value={editForm.season} onChange={(e) => setEditForm({ ...editForm, season: e.target.value })} placeholder="e.g. 2026-2027" />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">City *</label>
              <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">State</label>
              <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </div>
          </div>

          <hr className="border-cream-100" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Start</label>
              <Input type="date" value={editForm.auditionStart} onChange={(e) => setEditForm({ ...editForm, auditionStart: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition End</label>
              <Input type="date" value={editForm.auditionEnd} onChange={(e) => setEditForm({ ...editForm, auditionEnd: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Callback Date</label>
              <Input type="date" value={editForm.callbackDate} onChange={(e) => setEditForm({ ...editForm, callbackDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Rehearsal Start</label>
              <Input type="date" value={editForm.rehearsalStart} onChange={(e) => setEditForm({ ...editForm, rehearsalStart: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Show Opens</label>
              <Input type="date" value={editForm.showOpen} onChange={(e) => setEditForm({ ...editForm, showOpen: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Show Closes</label>
              <Input type="date" value={editForm.showClose} onChange={(e) => setEditForm({ ...editForm, showClose: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Location</label>
              <Input value={editForm.auditionLocation} onChange={(e) => setEditForm({ ...editForm, auditionLocation: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Callback Location</label>
              <Input value={editForm.callbackLocation} onChange={(e) => setEditForm({ ...editForm, callbackLocation: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Notes</label>
              <Textarea value={editForm.auditionNotes} onChange={(e) => setEditForm({ ...editForm, auditionNotes: e.target.value })} rows={3} placeholder="Preparation instructions, what to bring, etc." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditDetailsOpen(false)}>Cancel</Button>
            <Button onClick={submitEditDetails} loading={updateShowMutation.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Role Modal ── */}
      <Modal open={addRoleOpen} onClose={() => setAddRoleOpen(false)} title="Add Role">
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Role Name *</label>
            <Input value={roleDraft.name} onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })} placeholder="e.g. Baker" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Type</label>
              <select
                value={roleDraft.roleType}
                onChange={(e) => setRoleDraft({ ...roleDraft, roleType: e.target.value as RoleType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {ROLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Gender</label>
              <select
                value={roleDraft.gender}
                onChange={(e) => setRoleDraft({ ...roleDraft, gender: e.target.value as GenderReq })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Age Range</label>
              <Input value={roleDraft.ageRange} onChange={(e) => setRoleDraft({ ...roleDraft, ageRange: e.target.value })} placeholder="e.g. 30-50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Vocal Range</label>
              <Input value={roleDraft.vocalRange} onChange={(e) => setRoleDraft({ ...roleDraft, vocalRange: e.target.value })} placeholder="e.g. Baritone" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Description</label>
            <Textarea value={roleDraft.description} onChange={(e) => setRoleDraft({ ...roleDraft, description: e.target.value })} rows={2} placeholder="Brief character description" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddRoleOpen(false)}>Cancel</Button>
            <Button onClick={submitRole} loading={addRoleMutation.isPending}>Add Role</Button>
          </div>
        </div>
      </Modal>

      {/* ── Generate Audition Day Modal ── */}
      <Modal open={addSlotOpen} onClose={() => setAddSlotOpen(false)} title="Schedule an Audition Day">
        <div className="py-4 flex flex-col gap-4">
          <p className="text-sm text-clay-500">
            Set your window and block size — we&apos;ll generate every time block automatically.
          </p>

          {/* Date selection */}
          {auditionDates.length > 1 ? (
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Date *</label>
              <select
                value={auditionDates.includes(genDraft.date) ? genDraft.date : ""}
                onChange={(e) => setGenDraft({ ...genDraft, date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                <option value="">Select a date</option>
                {auditionDates.map((d) => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
              <details className="text-[11px] text-clay-400 mt-1">
                <summary className="cursor-pointer">Use another date</summary>
                <Input type="date" className="mt-2" value={auditionDates.includes(genDraft.date) ? "" : genDraft.date} onChange={(e) => setGenDraft({ ...genDraft, date: e.target.value })} />
              </details>
            </div>
          ) : auditionDates.length === 1 ? (
            <div>
              <div className="text-xs text-clay-500 mb-1">
                <span className="font-semibold text-curtain-700">Date:</span> {formatDate(auditionDates[0])}
              </div>
              <details className="text-[11px] text-clay-400">
                <summary className="cursor-pointer">Use a different date</summary>
                <Input type="date" className="mt-2" value={genDraft.date} onChange={(e) => setGenDraft({ ...genDraft, date: e.target.value })} />
              </details>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Date *</label>
              <Input type="date" value={genDraft.date} onChange={(e) => setGenDraft({ ...genDraft, date: e.target.value })} />
              <p className="text-[11px] text-clay-400 mt-1">Tip: set audition dates in show details and they&apos;ll appear here.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Start Time *</label>
              <Input type="time" value={genDraft.startTime} onChange={(e) => setGenDraft({ ...genDraft, startTime: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">End Time *</label>
              <Input type="time" value={genDraft.endTime} onChange={(e) => setGenDraft({ ...genDraft, endTime: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Block Length (min)</label>
              <Input type="number" min={5} max={240} value={genDraft.blockMinutes} onChange={(e) => setGenDraft({ ...genDraft, blockMinutes: parseInt(e.target.value) || 30 })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Actors per Block</label>
              <Input type="number" min={1} max={50} value={genDraft.capacity} onChange={(e) => setGenDraft({ ...genDraft, capacity: parseInt(e.target.value) || 5 })} />
            </div>
          </div>

          {/* Live preview of generated blocks */}
          {previewBlocks.length > 0 ? (
            <Card variant="sunken" padding="compact">
              <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase mb-2">
                Preview · {previewBlocks.length} {previewBlocks.length === 1 ? "block" : "blocks"} · {previewBlocks.length * genDraft.capacity} total spots
              </p>
              <div className="flex flex-wrap gap-1.5">
                {previewBlocks.map((b, i) => (
                  <span key={i} className="text-xs font-medium text-curtain-800 bg-white rounded-lg px-2 py-1 border border-cream-200">
                    {labelFromTime(new Date(b.startTime).toTimeString().slice(0, 5))}
                  </span>
                ))}
              </div>
            </Card>
          ) : (
            <p className="text-xs text-clay-400">Set a date, window, and block length to preview the blocks.</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddSlotOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={submitGenerateDay}
              loading={generateDayMutation.isPending}
              disabled={previewBlocks.length === 0}
              icon={<Lightning className="w-4 h-4" weight="bold" />}
            >
              Generate {previewBlocks.length > 0 ? `${previewBlocks.length} ${previewBlocks.length === 1 ? "Block" : "Blocks"}` : "Blocks"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Role Modal ── */}
      <Modal open={editRoleOpen} onClose={() => { setEditRoleOpen(false); setEditRoleId(null); }} title="Edit Role">
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Role Name *</label>
            <Input value={editRoleDraft.name} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Type</label>
              <select
                value={editRoleDraft.roleType}
                onChange={(e) => setEditRoleDraft({ ...editRoleDraft, roleType: e.target.value as RoleType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {ROLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Gender</label>
              <select
                value={editRoleDraft.gender}
                onChange={(e) => setEditRoleDraft({ ...editRoleDraft, gender: e.target.value as GenderReq })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Age Range</label>
              <Input value={editRoleDraft.ageRange} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, ageRange: e.target.value })} placeholder="e.g. 30-50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Vocal Range</label>
              <Input value={editRoleDraft.vocalRange} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, vocalRange: e.target.value })} placeholder="e.g. Baritone" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Description</label>
            <Textarea value={editRoleDraft.description} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, description: e.target.value })} rows={2} placeholder="Brief character description" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setEditRoleOpen(false); setEditRoleId(null); }}>Cancel</Button>
            <Button onClick={submitEditRole} loading={editRoleMutation.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Team Member Modal ── */}
      <Modal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Add Team Member">
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Name *</label>
            <Input value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Email</label>
            <Input type="email" value={memberDraft.email} onChange={(e) => setMemberDraft({ ...memberDraft, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Role</label>
              <select
                value={memberDraft.role}
                onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value as TeamRole })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {TEAM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Phone</label>
              <Input type="tel" value={memberDraft.phone} onChange={(e) => setMemberDraft({ ...memberDraft, phone: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={memberDraft.canEvaluate} onChange={(e) => setMemberDraft({ ...memberDraft, canEvaluate: e.target.checked })} className="accent-stage-500 w-4 h-4" />
            <span className="text-sm text-curtain-800">Can evaluate actors (leave notes, shortlist)</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={submitMember} loading={addMemberMutation.isPending}>Add Member</Button>
          </div>
        </div>
      </Modal>

      {/* ── Schedule Callbacks Modal ── */}
      <Modal open={callbackOpen} onClose={() => setCallbackOpen(false)} title="Schedule Callbacks">
        <div className="py-4 flex flex-col gap-4">
          <p className="text-sm text-clay-500">
            Set when and where callbacks happen. Actors who are called back see these details
            on their audition page.
          </p>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Callback Date</label>
            <Input type="date" value={callbackForm.callbackDate} onChange={(e) => setCallbackForm({ ...callbackForm, callbackDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Start Time</label>
              <Input type="time" value={callbackForm.callbackStartTime} onChange={(e) => setCallbackForm({ ...callbackForm, callbackStartTime: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">End Time</label>
              <Input type="time" value={callbackForm.callbackEndTime} onChange={(e) => setCallbackForm({ ...callbackForm, callbackEndTime: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Location</label>
            <Input value={callbackForm.callbackLocation} onChange={(e) => setCallbackForm({ ...callbackForm, callbackLocation: e.target.value })} placeholder="The Riverside Playhouse" />
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Notes</label>
            <Textarea value={callbackForm.callbackNotes} onChange={(e) => setCallbackForm({ ...callbackForm, callbackNotes: e.target.value })} rows={3} placeholder="What to prepare, what to bring, etc." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCallbackOpen(false)}>Cancel</Button>
            <Button onClick={submitCallback} loading={callbackMutation.isPending}>Save Callbacks</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   Poster Card — upload + display the show poster (cloud-only).
   Stored in the public org-media bucket; sets shows.poster_url.
   ============================================================ */

function PosterCard({
  orgId,
  showId,
  title,
  posterUrl,
}: {
  orgId: string;
  showId: string;
  title: string;
  posterUrl: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => uploadShowPoster(orgId, showId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Poster updated!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("error", "That file is over 10MB \u2014 try a smaller one.");
      return;
    }
    mutation.mutate(file);
  }

  // Mock mode: storage uploads aren't available.
  if (!isSupabaseConfigured) return null;

  return (
    <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "120ms" }}>
      <CardHeader>
        <CardTitle>Poster</CardTitle>
      </CardHeader>
      <div className="flex items-center gap-4">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`${title} poster`}
            className="w-20 h-28 rounded-lg object-cover flex-shrink-0 bg-cream-100"
          />
        ) : (
          <div className="w-20 h-28 rounded-lg bg-cream-100 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-7 h-7 text-stage-500" weight="duotone" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-clay-500 mb-2">
            Shown on the show card, the audition page, and your theatre's season.
          </p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <Button
            size="sm"
            variant="outline"
            loading={mutation.isPending}
            onClick={() => inputRef.current?.click()}
            icon={<ImageIcon className="w-4 h-4" weight="bold" />}
          >
            {posterUrl ? "Replace Poster" : "Upload Poster"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
