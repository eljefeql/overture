"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShow,
  getShowRoles,
  getCallbacks,
  getCastAssignments,
  getAuditionSignups,
  getAuditionGroups,
  getShowConflicts,
  createCastAssignment,
  updateCastAssignment,
  createSupplementalCall,
  closeSupplementalCall,
  publishCastList,
  sendOffers,
} from "@/lib/api/client";
import { conflictDaysByActor, vocalMismatch, ageMismatch } from "@/lib/castingFit";
import { CompareActorsModal } from "@/components/casting/CompareActorsModal";
import { track } from "@/lib/analytics";
import {
  getActor,
  getTeamNotes,
  postTeamNote,
  updateTeamNote,
  deleteTeamNote,
} from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Avatar,
  Modal,
  Pill,
  SlidePanel,
  StatBlock,
  PageSkeleton,
  EmptyState,
  Input,
  Textarea,
} from "@/components/ui";
import { TeamNotesFeed } from "@/components/casting/TeamNotesFeed";
import { useUIStore } from "@/stores/useUIStore";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { formatHeight, formatRoleGender, formatDate, formatTime } from "@/lib/utils";
import {
  Users,
  Warning,
  Trash,
  Megaphone,
  UserCirclePlus,
  PaperPlaneTilt,
  Eye,
  CalendarX,
  Info,
  MagnifyingGlass,
  CaretDown,
  CaretUp,
  Scales,
  ArrowRight,
  ArrowSquareOut,
  UsersThree,
  LinkSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { publicShareUrl, copyText } from "@/lib/share";
import type { CastAssignment, AssignmentType, RoleType, ShowStatus, ShowRole } from "@/types";
import { isOpenSupplementalGroup } from "@/types";

/* ============================================================
   Casting Board — Role-based assignment list
   Select actors from accepted callbacks for each role slot
   ============================================================ */

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "alternate", label: "Alternate" },
  { value: "understudy", label: "Understudy" },
];

const ASSIGNMENT_BADGE: Record<AssignmentType, string> = {
  primary: "success",
  alternate: "warning",
  understudy: "default",
};

/** Ensemble-type roles are a "pot" — they hold many people at once. */
const isEnsembleRoleType = (t: RoleType) =>
  t === "ensemble" || t === "featured_ensemble";

/** Statuses past auditions_closed — where a supplemental casting call can be
 *  opened (SUPPLEMENTAL_AND_PRECAST_SPEC.md, Feature 1). The show's status
 *  NEVER moves backward; a call is orthogonal to the status machine. */
const SUPPLEMENTAL_CALL_STATUSES: ShowStatus[] = [
  "callbacks",
  "casting",
  "cast",
  "archived",
];

/** One person the assign modal can offer for a role, with their context. */
type RoleCandidate = {
  actorId: string;
  actorName: string;
  /** Accepted callback FOR THIS ROLE. */
  calledBackForRole: boolean;
  /** Names of OTHER roles this person was called back for (accepted). */
  otherCallbackRoles: string[];
  shortlisted: boolean;
  /** Signed up "open to any role". */
  openToOther: boolean;
  /** Acknowledged at signup: happy to take an ensemble/smaller role in this show. */
  openToEnsemble: boolean;
};

export default function CastingBoardPage() {
  const { showId } = useParams<{ showId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const panel = useUIStore((s) => s.panel);
  const openActorPanel = useUIStore((s) => s.openActorPanel);
  const closePanel = useUIStore((s) => s.closePanel);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState<string | null>(null);
  const [assignType, setAssignType] = useState<AssignmentType>("primary");
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [sendOffersConfirmOpen, setSendOffersConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CastAssignment | null>(null);

  // ── Week 4 additive upgrades: conflict-aware pool + compare ──
  const [poolFilter, setPoolFilter] = useState<"all" | "none" | "few">("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  // ── Assign-modal redesign (QA finding 11): search + full-pool expander ──
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showEveryone, setShowEveryone] = useState(false);

  // ── Supplemental casting call (spec Feature 1) ──
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callRoleIds, setCallRoleIds] = useState<Set<string>>(new Set());
  const [callNote, setCallNote] = useState("");
  const [callDraft, setCallDraft] = useState({
    date: "", startTime: "18:00", endTime: "20:00", blockMinutes: 20, capacity: 4,
  });
  const [closeCallConfirmOpen, setCloseCallConfirmOpen] = useState(false);

  // ── Data fetching ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["casting", showId],
    queryFn: async () => {
      const [show, roles, cbs, assignments, signups, groups] = await Promise.all([
        getShow(showId),
        getShowRoles(showId),
        getCallbacks(showId),
        getCastAssignments(showId),
        getAuditionSignups(showId),
        getAuditionGroups(showId),
      ]);
      return { show, roles, callbacks: cbs, assignments, signups, groups };
    },
  });

  // Structured conflicts (Conflict Calendar read model) — powers the
  // conflict-aware pool chips + per-candidate day counts. Additive: the
  // board never waits on this; it degrades to "no data" quietly.
  const { data: conflictEntries } = useQuery({
    queryKey: ["showConflicts", showId],
    queryFn: () => getShowConflicts(showId),
  });
  const conflictDayMap = conflictDaysByActor(conflictEntries);

  // Profile of the actor currently picked in the assign modal — powers the
  // soft vocal/age fit warnings (heads-up only, never blocking).
  const { data: assignCandidateActor } = useQuery({
    queryKey: ["actor", selectedActorId],
    queryFn: () => getActor(selectedActorId!),
    enabled: !!selectedActorId && assignModalOpen,
  });

  // Panel actor data
  const selectedPanelActorId = panel.type === "actor" ? panel.actorId : null;

  const { data: selectedActor } = useQuery({
    queryKey: ["actor", selectedPanelActorId],
    queryFn: () => getActor(selectedPanelActorId!),
    enabled: !!selectedPanelActorId,
  });

  const { data: actorNotes } = useQuery({
    queryKey: ["teamNotes", showId, selectedPanelActorId],
    queryFn: () => getTeamNotes(showId, selectedPanelActorId!),
    enabled: !!selectedPanelActorId,
  });

  const handlePostNote = async (body: string) => {
    if (!user || activeRole.type !== "team" || !selectedPanelActorId) return;
    await postTeamNote({
      showId,
      actorId: selectedPanelActorId,
      authorId: user.id,
      authorName: user.displayName,
      authorRole: activeRole.teamRole,
      body,
    });
    queryClient.invalidateQueries({ queryKey: ["teamNotes", showId, selectedPanelActorId] });
  };

  const handleEditNote = async (noteId: string, body: string) => {
    await updateTeamNote(noteId, body);
    queryClient.invalidateQueries({ queryKey: ["teamNotes", showId, selectedPanelActorId] });
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteTeamNote(noteId);
    queryClient.invalidateQueries({ queryKey: ["teamNotes", showId, selectedPanelActorId] });
  };

  // ── Mutations ──
  const assignMutation = useMutation({
    mutationFn: (params: { roleId: string; roleName: string; actorId: string; actorName: string; assignmentType: AssignmentType; allowMultiple?: boolean }) =>
      createCastAssignment(
        {
          showId,
          roleId: params.roleId,
          roleName: params.roleName,
          actorId: params.actorId,
          actorName: params.actorName,
          assignmentType: params.assignmentType,
          status: "draft",
          sortOrder: 0,
        },
        { allowMultiple: params.allowMultiple }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casting", showId] });
      toast("success", "Actor assigned!");
      setAssignModalOpen(false);
      setSelectedActorId(null);
      setAssignRoleId(null);
      // Week 4 additions: clear compare/filter state too
      setCompareOpen(false);
      setCompareIds([]);
      setPoolFilter("all");
      setCandidateSearch("");
      setShowEveryone(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      updateCastAssignment(assignmentId, { status: "withdrawn" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casting", showId] });
      toast("info", "Assignment removed.");
      setRemoveConfirmOpen(false);
      setRemoveTarget(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishCastList(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casting", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Cast list published! Congratulations!");
      setPublishConfirmOpen(false);
      router.push(`/shows/${showId}/cast-list`);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  // Invalidate everything a casting call touches: this board, the auditions
  // board (new blocks), the public page's groups, and Browse/Discover.
  const invalidateCallSurfaces = () => {
    queryClient.invalidateQueries({ queryKey: ["casting", showId] });
    queryClient.invalidateQueries({ queryKey: ["auditions", showId] });
    queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
    queryClient.invalidateQueries({ queryKey: ["auditionGroups", showId] });
    queryClient.invalidateQueries({ queryKey: ["openAuditions"] });
  };

  const openCallMutation = useMutation({
    mutationFn: (input: Parameters<typeof createSupplementalCall>[0]) =>
      createSupplementalCall(input),
    onSuccess: (created) => {
      invalidateCallSurfaces();
      toast(
        "success",
        `Casting call opened — ${created.length} audition block${created.length !== 1 ? "s" : ""} published. The show is back on Browse for actors.`
      );
      setCallModalOpen(false);
      setCallRoleIds(new Set());
      setCallNote("");
      setCallDraft({ date: "", startTime: "18:00", endTime: "20:00", blockMinutes: 20, capacity: 4 });
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const closeCallMutation = useMutation({
    mutationFn: () => closeSupplementalCall(showId),
    onSuccess: () => {
      invalidateCallSurfaces();
      toast("info", "Casting call closed. Signups and blocks are kept for your records.");
      setCloseCallConfirmOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const sendOffersMutation = useMutation({
    mutationFn: () => sendOffers(showId),
    onSuccess: (count) => {
      track("offers_sent", { showId, count });
      queryClient.invalidateQueries({ queryKey: ["casting", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", `${count} offer${count !== 1 ? "s" : ""} sent! Track responses on the Offers tab.`);
      setSendOffersConfirmOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.show) return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <EmptyState
        icon={<Warning className="w-12 h-12" weight="duotone" />}
        title="Unable to load casting board"
        description="Something went wrong. Please try again."
        action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
      />
    </div>
  );

  const { show, roles, callbacks: cbs, assignments, signups, groups } = data;

  // Active assignments (not withdrawn)
  const activeAssignments = assignments.filter((a) => a.status !== "withdrawn");
  const draftAssignments = activeAssignments.filter((a) => a.status === "draft");
  const sentAssignments = activeAssignments.filter((a) => a.status === "sent");
  const acceptedAssignments = activeAssignments.filter((a) => a.status === "accepted");
  const declinedAssignments = activeAssignments.filter((a) => a.status === "declined");
  const allAccepted =
    activeAssignments.length > 0 &&
    activeAssignments.every((a) => a.status === "accepted");

  // All callbacks that were accepted (primary candidate pool)
  const acceptedCallbacks = cbs.filter((c) => c.status === "accepted");

  // All auditioned actors (broader pool for the modal)
  const allAuditionedSignups = signups.filter((s) =>
    ["auditioned", "shortlisted", "callback", "cast"].includes(s.status)
  );

  // Stats
  const totalRoles = roles?.length ?? 0;
  const rolesFilled = roles?.filter((role) =>
    activeAssignments.some((a) => a.roleId === role.id && a.assignmentType === "primary")
  ).length ?? 0;
  const unfilledRoles = totalRoles - rolesFilled;
  const totalAssignments = activeAssignments.length;

  // Get assignments for a specific role
  const getAssignmentsForRole = (roleId: string) =>
    activeAssignments.filter((a) => a.roleId === roleId);

  // ── Supplemental casting call (spec Feature 1) ──
  const callsAvailable = SUPPLEMENTAL_CALL_STATUSES.includes(show.status);
  const openCallGroups = (groups ?? []).filter(isOpenSupplementalGroup);
  const hasOpenCall = openCallGroups.length > 0;
  const openCallRoleIds = new Set(openCallGroups.flatMap((g) => g.targetRoleIds ?? []));
  const openCallRoleNames = (roles ?? [])
    .filter((r) => openCallRoleIds.has(r.id))
    .map((r) => r.name);
  const openCallSignupCount = signups.filter(
    (s) => s.groupId && openCallGroups.some((g) => g.id === s.groupId)
  ).length;

  // "Unfilled or vacated" = no accepted or pending (sent) PRIMARY assignment.
  // Ensemble pots are always callable — more members is always valid.
  const isRoleCallable = (role: ShowRole) => {
    if (isEnsembleRoleType(role.roleType)) return true;
    return !activeAssignments.some(
      (a) =>
        a.roleId === role.id &&
        a.assignmentType === "primary" &&
        (a.status === "accepted" || a.status === "sent")
    );
  };
  const callableRoles = (roles ?? []).filter(isRoleCallable);

  const openCallModal = (roleId?: string) => {
    setCallRoleIds(new Set(roleId ? [roleId] : []));
    setCallNote("");
    setCallDraft({ date: "", startTime: "18:00", endTime: "20:00", blockMinutes: 20, capacity: 4 });
    setCallModalOpen(true);
  };

  const toggleCallRole = (roleId: string) => {
    setCallRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  // Day-based block generation — same approach as the setup page's
  // "Generate a Day" (local instants serialized to UTC).
  const computeCallBlocks = () => {
    if (!callDraft.date || !callDraft.startTime || !callDraft.endTime) return [];
    const start = new Date(`${callDraft.date}T${callDraft.startTime}:00`);
    const end = new Date(`${callDraft.date}T${callDraft.endTime}:00`);
    const stepMs = callDraft.blockMinutes * 60 * 1000;
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
        slotCount: callDraft.capacity,
      });
      cursor += stepMs;
      guard++;
    }
    return blocks;
  };
  const callPreviewBlocks = computeCallBlocks();

  const submitCall = () => {
    if (callRoleIds.size === 0) {
      toast("error", "Pick at least one role for the casting call.");
      return;
    }
    if (!callDraft.date) {
      toast("error", "Pick an audition date for the call.");
      return;
    }
    if (callDraft.endTime <= callDraft.startTime) {
      toast("error", "End time must be after start time.");
      return;
    }
    if (callPreviewBlocks.length === 0) {
      toast("error", "That window doesn't produce any blocks — check your times.");
      return;
    }
    openCallMutation.mutate({
      showId,
      targetRoleIds: [...callRoleIds],
      note: callNote.trim() || null,
      blocks: callPreviewBlocks,
      sortOrderStart: (groups?.length ?? 0) + 100,
    });
  };

  const copyCallLink = async () => {
    if (await copyText(publicShareUrl(`/auditions/${showId}`))) {
      toast("success", "Public link copied to clipboard!");
    } else {
      toast("error", "Couldn't copy — try again.");
    }
  };

  // Build the full candidate pool for a role (QA finding 11): everyone who
  // auditioned (plus anyone with an accepted callback), minus people already
  // assigned to THIS role, each annotated with callback/shortlist context.
  const getRoleCandidates = (roleId: string): RoleCandidate[] => {
    const assignedSet = new Set(
      activeAssignments.filter((a) => a.roleId === roleId).map((a) => a.actorId)
    );
    const byActor = new Map<string, RoleCandidate>();
    const upsert = (actorId: string, actorName: string): RoleCandidate => {
      let c = byActor.get(actorId);
      if (!c) {
        c = {
          actorId,
          actorName,
          calledBackForRole: false,
          otherCallbackRoles: [],
          shortlisted: false,
          openToOther: false,
          openToEnsemble: false,
        };
        byActor.set(actorId, c);
      }
      return c;
    };
    for (const s of allAuditionedSignups) {
      if (assignedSet.has(s.actorId)) continue;
      const c = upsert(s.actorId, s.actorName);
      c.shortlisted = s.status === "shortlisted";
      c.openToOther = s.openToOther;
      c.openToEnsemble = s.openToEnsemble ?? false;
    }
    for (const cb of acceptedCallbacks) {
      if (assignedSet.has(cb.actorId)) continue;
      const c = upsert(cb.actorId, cb.actorName);
      if (cb.roleId === roleId) c.calledBackForRole = true;
      else if (!c.otherCallbackRoles.includes(cb.roleName)) {
        c.otherCallbackRoles.push(cb.roleName);
      }
    }
    // Called-back-for-this-role first, then shortlisted, then everyone else;
    // alphabetical within each group.
    return [...byActor.values()].sort((a, b) => {
      const rank = (c: RoleCandidate) =>
        c.calledBackForRole ? 0 : c.shortlisted ? 1 : 2;
      return rank(a) - rank(b) || a.actorName.localeCompare(b.actorName);
    });
  };

  // Panel actor data
  const panelActorCallbacks = selectedPanelActorId
    ? cbs.filter((c) => c.actorId === selectedPanelActorId)
    : [];

  const panelActorAssignments = selectedPanelActorId
    ? activeAssignments.filter((a) => a.actorId === selectedPanelActorId)
    : [];

  // Open assign modal
  const openAssignModal = (roleId: string, type: AssignmentType) => {
    setAssignRoleId(roleId);
    setAssignType(type);
    setSelectedActorId(null);
    setCandidateSearch("");
    setShowEveryone(false);
    setAssignModalOpen(true);
  };

  const submitAssignment = () => {
    if (!assignRoleId || !selectedActorId) return;
    const role = roles?.find((r) => r.id === assignRoleId);
    const candidate = allCandidates.find((c) => c.actorId === selectedActorId);
    if (!role || !candidate) return;
    assignMutation.mutate({
      roleId: assignRoleId,
      roleName: role.name,
      actorId: selectedActorId,
      actorName: candidate.actorName,
      assignmentType: assignType,
      allowMultiple: isEnsembleRoleType(role.roleType),
    });
  };

  const allCandidates = assignRoleId ? getRoleCandidates(assignRoleId) : [];
  // Default view (QA finding 11): only people shortlisted or called back
  // FOR THIS ROLE — the expander/search reach everyone who auditioned.
  const defaultCandidates = allCandidates.filter(
    (c) => c.calledBackForRole || c.shortlisted
  );

  // ── Week 4 additive upgrades (conflict chips, compare, soft warnings) ──

  const assignRole = roles?.find((r) => r.id === assignRoleId) ?? null;
  const assignRoleIsEnsemble = !!assignRole && isEnsembleRoleType(assignRole.roleType);

  // Conflict-aware pool filter — "all" (default) shows everyone, exactly as before.
  const matchesPoolFilter = (actorId: string) => {
    if (poolFilter === "all") return true;
    const days = conflictDayMap.get(actorId) ?? 0;
    return poolFilter === "none" ? days === 0 : days <= 2;
  };
  const searchQuery = candidateSearch.trim().toLowerCase();
  // Typing a name always searches EVERYONE who auditioned — nobody should be
  // unfindable just because the expander is closed.
  const basePool = searchQuery || showEveryone ? allCandidates : defaultCandidates;
  const visibleCandidates = basePool.filter(
    (c) =>
      matchesPoolFilter(c.actorId) &&
      (!searchQuery || c.actorName.toLowerCase().includes(searchQuery))
  );
  const expanderExtraCount = allCandidates.length - defaultCandidates.length;
  const filterHidEveryone =
    poolFilter !== "all" && basePool.length > 0 && visibleCandidates.length === 0;

  const toggleCompare = (actorId: string) => {
    setCompareIds((prev) =>
      prev.includes(actorId)
        ? prev.filter((id) => id !== actorId)
        : prev.length >= 3
          ? prev // cap at 3
          : [...prev, actorId]
    );
  };

  // Soft fit warnings for the actor picked in the assign modal.
  const candidateProfile =
    selectedActorId && assignCandidateActor?.id === selectedActorId
      ? assignCandidateActor.profile
      : null;
  const vocalWarning =
    !!assignRole && !!candidateProfile
      ? vocalMismatch(assignRole.vocalRange, candidateProfile.vocalRange)
      : false;
  const ageWarning =
    !!assignRole && !!candidateProfile
      ? ageMismatch(
          assignRole.ageRange,
          candidateProfile.ageRangeLow,
          candidateProfile.ageRangeHigh
        )
      : false;

  // "Cast this actor" from the compare modal — the existing assign flow,
  // just with the actor pre-picked.
  const castFromCompare = (actorId: string) => {
    if (!assignRoleId || !assignRole) return;
    const cb = cbs.find((c) => c.actorId === actorId && c.roleId === assignRoleId);
    const signup = signups.find((s) => s.actorId === actorId);
    const actorName = cb?.actorName ?? signup?.actorName;
    if (!actorName) return;
    setSelectedActorId(actorId);
    assignMutation.mutate({
      roleId: assignRoleId,
      roleName: assignRole.name,
      actorId,
      actorName,
      assignmentType: assignType,
      allowMultiple: isEnsembleRoleType(assignRole.roleType),
    });
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssignRoleId(null);
    setSelectedActorId(null);
    setCompareIds([]);
    setCompareOpen(false);
    setPoolFilter("all");
    setCandidateSearch("");
    setShowEveryone(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display text-curtain-900">Casting Board</h1>
          <p className="text-sm text-clay-500 mt-1">
            Assign actors to roles from your callback pool.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {activeAssignments.length > 0 && (
            <p className="text-xs text-clay-500">
              {acceptedAssignments.length} of {activeAssignments.length} role{activeAssignments.length !== 1 ? "s" : ""} confirmed
              {sentAssignments.length > 0 && ` · ${sentAssignments.length} awaiting response`}
              {declinedAssignments.length > 0 && ` · ${declinedAssignments.length} declined`}
            </p>
          )}
          <div className="flex gap-2">
            <Link href={`/shows/${showId}/conflicts`}>
              <Button
                variant="outline"
                icon={<CalendarX className="w-4 h-4 text-stage-500" weight="duotone" />}
              >
                Conflict Calendar
              </Button>
            </Link>
            {draftAssignments.length > 0 && (
              <Button
                variant="primary"
                onClick={() => setSendOffersConfirmOpen(true)}
                icon={<PaperPlaneTilt className="w-4 h-4" weight="bold" />}
              >
                Send Offers ({draftAssignments.length})
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => setPublishConfirmOpen(true)}
              icon={<Megaphone className="w-4 h-4" weight="bold" />}
              disabled={!allAccepted}
              title={
                !allAccepted
                  ? "All cast assignments must be accepted before publishing."
                  : undefined
              }
            >
              Publish Cast List
            </Button>
          </div>
        </div>
      </div>

      {/* ── Offers-out breadcrumb → the Offers tracker (QA finding 14) ── */}
      {(sentAssignments.length > 0 || acceptedAssignments.length > 0 || declinedAssignments.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-forest-50 border border-forest-200 rounded-xl mb-6 animate-fade-up" style={{ animationDelay: "25ms" }}>
          <div className="flex items-center gap-3">
            <PaperPlaneTilt className="w-5 h-5 text-forest-700" weight="duotone" />
            <p className="text-sm text-curtain-800">
              <strong>{acceptedAssignments.length}</strong> accepted ·{" "}
              <strong>{sentAssignments.length}</strong> awaiting response ·{" "}
              <strong>{declinedAssignments.length}</strong> declined
            </p>
          </div>
          <Link
            href={`/shows/${showId}/offers`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:text-forest-800 transition"
          >
            Track responses
            <ArrowRight className="w-4 h-4" weight="bold" />
          </Link>
        </div>
      )}

      {/* ── Open supplemental casting call (spec Feature 1) ── */}
      {hasOpenCall && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stage-50 border border-stage-200 rounded-xl mb-6 animate-fade-up" style={{ animationDelay: "35ms" }}>
          <div className="flex items-center gap-3 min-w-0">
            <Megaphone className="w-5 h-5 text-stage-600 flex-shrink-0" weight="duotone" />
            <p className="text-sm text-curtain-800 min-w-0">
              <strong>Casting call open</strong>
              {openCallRoleNames.length > 0 && (
                <> — seeking {openCallRoleNames.join(", ")}</>
              )}
              {" · "}
              {openCallSignupCount} signup{openCallSignupCount !== 1 ? "s" : ""} so far
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/auditions/${showId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" icon={<ArrowSquareOut className="w-4 h-4 text-stage-500" weight="duotone" />}>
                View public page
              </Button>
            </a>
            <Button variant="ghost" size="sm" onClick={copyCallLink} icon={<LinkSimple className="w-4 h-4 text-stage-500" weight="duotone" />}>
              Copy link
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCloseCallConfirmOpen(true)}>
              Close call
            </Button>
          </div>
        </div>
      )}

      {/* ── Unfilled Alert ── */}
      {unfilledRoles > 0 && (
        <div className="flex items-center gap-3 p-3 bg-stage-50 border border-stage-200 rounded-xl mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
          <Warning className="w-5 h-5 text-stage-600" weight="duotone" />
          <p className="text-sm text-curtain-800">
            <strong>{unfilledRoles}</strong> role{unfilledRoles !== 1 ? "s" : ""} still need a primary assignment.
          </p>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-fade-up" style={{ animationDelay: "75ms" }}>
        <StatBlock label="Total Roles" value={String(totalRoles)} />
        <StatBlock label="Roles Filled" value={String(rolesFilled)} />
        <StatBlock label="Unfilled" value={String(unfilledRoles)} />
        <StatBlock label="Assignments" value={String(totalAssignments)} />
      </div>

      {/* ── Roles List ── */}
      <div className="flex flex-col gap-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
        {roles && roles.length > 0 ? (
          roles.map((role) => {
            const roleAssignments = getAssignmentsForRole(role.id);
            const isEnsemble = isEnsembleRoleType(role.roleType);
            const hasPrimary = roleAssignments.some((a) => a.assignmentType === "primary");

            // How many candidates exist for this role (accepted callbacks + other auditioned)
            const candidateCount = acceptedCallbacks.filter((c) => c.roleId === role.id).length;

            return (
              <Card
                key={role.id}
                variant="elevated"
                className={!hasPrimary ? "ring-1 ring-stage-200" : ""}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle>{role.name}</CardTitle>
                    <Badge variant="default" size="sm">{role.roleType}</Badge>
                    {role.gender && (
                      <span className="text-xs text-clay-400">
                        {formatRoleGender(role.gender)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Per-role "Open a casting call" (spec Feature 1) —
                        unfilled/vacated roles (ensemble pots always) on
                        late-status shows; hidden while this role is already
                        sought by an open call. */}
                    {callsAvailable &&
                      isRoleCallable(role) &&
                      !openCallRoleIds.has(role.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCallModal(role.id)}
                          icon={<Megaphone className="w-4 h-4 text-stage-500" weight="duotone" />}
                        >
                          Open a casting call
                        </Button>
                      )}
                    <span className="text-xs text-clay-400">
                      {candidateCount} candidate{candidateCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardHeader>

                {isEnsemble ? (
                  /* Ensemble pot — holds any number of members (QA finding 13) */
                  <div className="flex flex-col gap-2 py-2 px-3 rounded-xl bg-cream-50 border border-cream-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-clay-500">
                        <UsersThree className="w-4 h-4 text-stage-500" weight="duotone" />
                        {roleAssignments.length === 0
                          ? "No one cast yet — an ensemble can hold as many people as you need."
                          : `${roleAssignments.length} member${roleAssignments.length !== 1 ? "s" : ""} in this ensemble`}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAssignModal(role.id, "primary")}
                        icon={<UserCirclePlus className="w-4 h-4" weight="duotone" />}
                      >
                        {roleAssignments.length === 0 ? "Add member" : "Add another"}
                      </Button>
                    </div>
                    {roleAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between py-1.5 border-t border-cream-100"
                      >
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
                          onClick={() => openActorPanel(assignment.actorId, showId)}
                        >
                          <Avatar name={assignment.actorName} size="sm" />
                          <span className="text-sm font-semibold text-curtain-900 hover:text-curtain-700">
                            {assignment.actorName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignment.status === "sent" && (
                            <Badge variant="warning" size="sm">Pending</Badge>
                          )}
                          {assignment.status === "accepted" && (
                            <Badge variant="success" size="sm">Accepted</Badge>
                          )}
                          {assignment.status === "declined" && (
                            <Badge variant="danger" size="sm">Declined</Badge>
                          )}
                          <button
                            onClick={() => {
                              setRemoveTarget(assignment);
                              setRemoveConfirmOpen(true);
                            }}
                            className="text-clay-300 hover:text-ruby-500 transition p-1"
                            title="Remove from ensemble"
                          >
                            <Trash className="w-4 h-4" weight="bold" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                /* Principal roles — single occupant per slot type */
                <div className="flex flex-col gap-3">
                  {ASSIGNMENT_TYPES.map(({ value: type, label }) => {
                    const assignment = roleAssignments.find((a) => a.assignmentType === type);
                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between py-2 px-3 rounded-xl bg-cream-50 border border-cream-100"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={ASSIGNMENT_BADGE[type] as "default"} size="sm">
                            {label}
                          </Badge>
                          {assignment ? (
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
                              onClick={() => openActorPanel(assignment.actorId, showId)}
                            >
                              <Avatar name={assignment.actorName} size="sm" />
                              <span className="text-sm font-semibold text-curtain-900 hover:text-curtain-700">
                                {assignment.actorName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-clay-400 italic">Unassigned</span>
                          )}
                        </div>

                        {assignment ? (
                          <button
                            onClick={() => {
                              setRemoveTarget(assignment);
                              setRemoveConfirmOpen(true);
                            }}
                            className="text-clay-300 hover:text-ruby-500 transition p-1"
                            title="Remove assignment"
                          >
                            <Trash className="w-4 h-4" weight="bold" />
                          </button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAssignModal(role.id, type)}
                            icon={<UserCirclePlus className="w-4 h-4" weight="duotone" />}
                          >
                            Select Actor
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon={<Users className="w-12 h-12" weight="duotone" />}
            title="No roles defined"
            description="Add roles from the Setup page before casting."
          />
        )}
      </div>

      {/* ── Actor Selection Modal ── */}
      <Modal
        open={assignModalOpen}
        onClose={closeAssignModal}
        title={
          assignRoleIsEnsemble
            ? `Add to ${assignRole?.name ?? "Ensemble"}`
            : assignType === "primary"
              ? `Cast ${assignRole?.name ?? "Role"}`
              : `Select ${assignType} — ${assignRole?.name ?? "Role"}`
        }
      >
        <div className="py-4">
          {allCandidates.length > 0 ? (
            <>
              {/* Name search — instant, client-side (QA finding 11) */}
              <div className="relative mb-3">
                <MagnifyingGlass
                  className="w-4 h-4 text-clay-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
                  weight="bold"
                />
                <Input
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search everyone who auditioned by name…"
                  aria-label="Search candidates by name"
                  className="pl-9"
                />
              </div>

              {/* Conflict-aware pool chips (Week 4 — additive; "All" = original view) */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Pill variant="filter" active={poolFilter === "all"} onClick={() => setPoolFilter("all")}>
                  All candidates
                </Pill>
                <Pill variant="filter" active={poolFilter === "none"} onClick={() => setPoolFilter("none")}>
                  No conflicts
                </Pill>
                <Pill variant="filter" active={poolFilter === "few"} onClick={() => setPoolFilter("few")}>
                  Few conflicts (≤2 days)
                </Pill>
              </div>

              <div className="flex flex-col gap-2 mb-4 max-h-72 overflow-y-auto">
                <h3 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-1">
                  {searchQuery
                    ? "Search results — everyone who auditioned"
                    : showEveryone
                      ? "Everyone who auditioned"
                      : "Called back or shortlisted for this role"}
                </h3>

                {visibleCandidates.length === 0 && !filterHidEveryone && (
                  <p className="text-sm text-clay-500 text-center py-4">
                    {searchQuery
                      ? "No one matches that name."
                      : "No one was called back or shortlisted for this role yet — show everyone who auditioned below."}
                  </p>
                )}

                {visibleCandidates.map((c) => {
                  const selected = selectedActorId === c.actorId;
                  const comparing = compareIds.includes(c.actorId);
                  const days = conflictDayMap.get(c.actorId) ?? 0;
                  return (
                    <div
                      key={c.actorId}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => setSelectedActorId(selected ? null : c.actorId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedActorId(selected ? null : c.actorId);
                        }
                      }}
                      className={`group flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                        selected
                          ? "border-stage-400 bg-stage-50"
                          : "border-cream-200 hover:border-stage-300 hover:bg-cream-50"
                      }`}
                    >
                      <Avatar name={c.actorName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-curtain-900">
                            {c.actorName}
                          </span>
                          {c.calledBackForRole && (
                            <Badge variant="success" size="sm">
                              Called back · {assignRole?.name}
                            </Badge>
                          )}
                          {c.shortlisted && (
                            <Badge variant="warning" size="sm">Shortlisted</Badge>
                          )}
                          {c.otherCallbackRoles.slice(0, 2).map((rn) => (
                            <Badge key={rn} variant="default" size="sm">
                              Called back · {rn}
                            </Badge>
                          ))}
                          {c.otherCallbackRoles.length > 2 && (
                            <Badge variant="muted" size="sm">
                              +{c.otherCallbackRoles.length - 2} more
                            </Badge>
                          )}
                          {c.openToOther && (
                            <Badge variant="muted" size="sm">Open to any role</Badge>
                          )}
                          {c.openToEnsemble && (
                            <Badge variant="gold" size="sm">Open to ensemble</Badge>
                          )}
                        </div>
                        {days > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-stage-700 mt-0.5">
                            <CalendarX className="w-3.5 h-3.5 text-stage-600" weight="duotone" />
                            {days} conflict day{days !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {/* Cast affordance — appears on hover, sticks when selected (QA finding 12) */}
                      <span
                        className={`hidden sm:flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap transition ${
                          selected
                            ? "text-stage-700"
                            : "text-stage-600 opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <UserCirclePlus className="w-3.5 h-3.5" weight="duotone" />
                        {selected
                          ? "Selected"
                          : assignRoleIsEnsemble
                            ? `Add to ${assignRole?.name ?? "ensemble"}`
                            : `Cast as ${assignRole?.name ?? "role"}`}
                      </span>
                      {/* Explicit Compare toggle — no more mystery checkbox (QA finding 12) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompare(c.actorId);
                        }}
                        disabled={!comparing && compareIds.length >= 3}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium transition flex-shrink-0 ${
                          comparing
                            ? "bg-curtain-700 text-white border-curtain-700"
                            : "bg-cream-100 text-clay-600 border-cream-300 hover:border-curtain-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                        title="Add to side-by-side compare (up to 3)"
                        aria-pressed={comparing}
                        aria-label={`Compare ${c.actorName}`}
                      >
                        <Scales className="w-3.5 h-3.5" weight="duotone" />
                        Compare
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openActorPanel(c.actorId, showId);
                        }}
                        className="p-1.5 rounded-lg text-clay-500 hover:text-curtain-900 hover:bg-cream-100 transition flex-shrink-0"
                        title="Quick view"
                        aria-label="Quick view"
                      >
                        <Eye className="w-4 h-4" weight="duotone" />
                      </button>
                      <Link
                        href={`/actors/${c.actorId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-clay-500 hover:text-curtain-900 hover:bg-cream-100 transition flex-shrink-0"
                        title={`Open ${c.actorName}'s full profile`}
                        aria-label={`Open ${c.actorName}'s full profile`}
                      >
                        <ArrowSquareOut className="w-4 h-4" weight="duotone" />
                      </Link>
                    </div>
                  );
                })}

                {/* Filter hid everyone — friendly note, not an empty screen */}
                {filterHidEveryone && (
                  <p className="text-sm text-clay-500 text-center py-4">
                    Nobody matches that conflict filter — try &ldquo;All candidates.&rdquo;
                  </p>
                )}

                {/* Full-pool expander (QA finding 11) */}
                {!searchQuery && expanderExtraCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEveryone((v) => !v)}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-curtain-700 hover:text-curtain-900 border border-dashed border-cream-300 hover:border-curtain-300 rounded-xl transition"
                  >
                    {showEveryone ? (
                      <>
                        Show only this role&apos;s callbacks &amp; shortlist
                        <CaretUp className="w-3.5 h-3.5" weight="bold" />
                      </>
                    ) : (
                      <>
                        Show everyone who auditioned ({expanderExtraCount} more)
                        <CaretDown className="w-3.5 h-3.5" weight="bold" />
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Soft fit warnings (Week 4) — heads up, never blocking */}
              {(vocalWarning || ageWarning) && assignRole && candidateProfile && (
                <div className="flex items-start gap-2 p-3 bg-stage-50 border border-stage-200 rounded-xl mb-4">
                  <Info className="w-4 h-4 text-stage-600 mt-0.5 flex-shrink-0" weight="duotone" />
                  <div className="text-xs text-stage-700 leading-relaxed">
                    {vocalWarning && (
                      <p>
                        Heads up: {assignRole.name} calls for{" "}
                        <strong>{assignRole.vocalRange}</strong>, and this actor lists{" "}
                        <strong>{candidateProfile.vocalRange}</strong> — not a dealbreaker,
                        just worth a listen.
                      </p>
                    )}
                    {ageWarning && (
                      <p>
                        Heads up: {assignRole.name} plays <strong>{assignRole.ageRange}</strong>,
                        and this actor lists{" "}
                        <strong>
                          {candidateProfile.ageRangeLow ?? "?"}–{candidateProfile.ageRangeHigh ?? "?"}
                        </strong>{" "}
                        — not a dealbreaker, just flagging it.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div>
                  {compareIds.length >= 2 && (
                    <Button
                      variant="outline"
                      onClick={() => setCompareOpen(true)}
                      icon={<Scales className="w-4 h-4" weight="duotone" />}
                    >
                      Compare ({compareIds.length})
                    </Button>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={closeAssignModal}>
                    Cancel
                  </Button>
                  <Button
                    onClick={submitAssignment}
                    loading={assignMutation.isPending}
                    disabled={!selectedActorId}
                  >
                    {assignRoleIsEnsemble
                      ? `Add to ${assignRole?.name ?? "Ensemble"}`
                      : assignType === "primary"
                        ? `Cast as ${assignRole?.name ?? "Role"}`
                        : `Assign ${assignType}`}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-clay-500 mb-4">
                No available candidates. Actors must have auditioned for this show.
              </p>
              <Button variant="ghost" onClick={closeAssignModal}>
                Close
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Compare Actors (Week 4 additive) ── */}
      <CompareActorsModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        actorIds={compareIds}
        role={assignRole}
        roles={roles ?? []}
        signups={signups}
        conflictDays={conflictDayMap}
        onCast={castFromCompare}
        castPending={assignMutation.isPending}
      />

      {/* ── Open a Casting Call (spec Feature 1) ── */}
      <Modal
        open={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        title="Open a Casting Call"
      >
        <div className="py-4 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-clay-500">
            A role-scoped mini-audition. The show&apos;s public page reframes to
            &ldquo;Now casting,&rdquo; and the show reappears on Browse for
            actors while the call is open. Your cast list and show status are
            untouched.
          </p>

          {/* Roles */}
          <div>
            <label className="block text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
              Which role{callableRoles.length !== 1 ? "s" : ""} are you casting?
            </label>
            {callableRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {callableRoles.map((role) => (
                  <Pill
                    key={role.id}
                    variant="role"
                    active={callRoleIds.has(role.id)}
                    onClick={() => toggleCallRole(role.id)}
                  >
                    {role.name}
                  </Pill>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay-500">
                Every role has an accepted or pending primary right now —
                there&apos;s nothing to recast.
              </p>
            )}
            <p className="text-[11px] text-clay-400 mt-2">
              Only unfilled or vacated roles are listed. Ensemble roles are
              always available — an ensemble can take more members anytime.
            </p>
          </div>

          {/* Audition day — reuses the day-based generator */}
          <div>
            <label className="block text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
              Audition day &amp; blocks
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[11px] font-semibold text-clay-500">Date</label>
                <Input
                  type="date"
                  value={callDraft.date}
                  onChange={(e) => setCallDraft({ ...callDraft, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-clay-500">Start</label>
                <Input
                  type="time"
                  value={callDraft.startTime}
                  onChange={(e) => setCallDraft({ ...callDraft, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-clay-500">End</label>
                <Input
                  type="time"
                  value={callDraft.endTime}
                  onChange={(e) => setCallDraft({ ...callDraft, endTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-clay-500">Block length (min)</label>
                <Input
                  type="number"
                  min={5}
                  value={String(callDraft.blockMinutes)}
                  onChange={(e) =>
                    setCallDraft({ ...callDraft, blockMinutes: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-clay-500">Actors per block</label>
                <Input
                  type="number"
                  min={1}
                  value={String(callDraft.capacity)}
                  onChange={(e) =>
                    setCallDraft({ ...callDraft, capacity: Number(e.target.value) || 1 })
                  }
                />
              </div>
            </div>
            {callDraft.date && callPreviewBlocks.length > 0 && (
              <p className="text-xs text-clay-500 mt-2">
                {formatDate(callDraft.date)} · {callPreviewBlocks.length} block
                {callPreviewBlocks.length !== 1 ? "s" : ""} (
                {formatTime(callPreviewBlocks[0].startTime)} –{" "}
                {formatTime(callPreviewBlocks[callPreviewBlocks.length - 1].endTime)}),{" "}
                {callDraft.capacity} actor{callDraft.capacity !== 1 ? "s" : ""} each
              </p>
            )}
          </div>

          {/* Public note */}
          <div>
            <label className="block text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
              Public note <span className="normal-case font-normal text-clay-400">(optional)</span>
            </label>
            <Textarea
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              rows={2}
              placeholder="e.g. Seeking a strong tenor — sides provided at the call."
            />
            <p className="text-[11px] text-clay-400 mt-1">
              Shown to actors on the public audition page.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setCallModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitCall}
              loading={openCallMutation.isPending}
              disabled={callableRoles.length === 0}
              icon={<Megaphone className="w-4 h-4" weight="bold" />}
            >
              Open Casting Call
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Close Casting Call Confirmation ── */}
      <Modal
        open={closeCallConfirmOpen}
        onClose={() => setCloseCallConfirmOpen(false)}
        title="Close Casting Call"
      >
        <div className="flex flex-col items-center text-center py-4">
          <Megaphone className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-2">
            Close the open casting call
            {openCallRoleNames.length > 0 && (
              <> for <strong>{openCallRoleNames.join(", ")}</strong></>
            )}
            ?
          </p>
          <p className="text-xs text-clay-500 mb-6 max-w-sm">
            The show leaves Browse and its public page stops taking casting-call
            signups. Blocks and signups you already have are kept. (Filling a
            sought role closes its call automatically, too.)
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setCloseCallConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => closeCallMutation.mutate()}
              loading={closeCallMutation.isPending}
            >
              Close Call
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Remove Assignment Confirmation ── */}
      <Modal open={removeConfirmOpen} onClose={() => setRemoveConfirmOpen(false)} title="Remove Assignment">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-ruby-400 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-6">
            Remove <strong>{removeTarget?.actorName}</strong> as {removeTarget?.assignmentType} for{" "}
            <strong>{removeTarget?.roleName}</strong>?
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setRemoveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
              loading={removeMutation.isPending}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Send Offers Confirmation ── */}
      <Modal open={sendOffersConfirmOpen} onClose={() => setSendOffersConfirmOpen(false)} title="Send Offers">
        <div className="flex flex-col items-center text-center py-4">
          <PaperPlaneTilt className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-2">
            Send {draftAssignments.length} cast offer{draftAssignments.length !== 1 ? "s" : ""} for <strong>{show.title}</strong>?
          </p>
          <p className="text-xs text-clay-500 mb-6">
            Actors will be notified and asked to accept or decline. The cast list can be published once all offers are accepted.
          </p>
          {unfilledRoles > 0 && (
            <div className="flex items-center gap-2 p-2 bg-stage-50 border border-stage-200 rounded-lg mb-4 text-xs text-stage-700">
              <Warning className="w-4 h-4" weight="duotone" />
              {unfilledRoles} role{unfilledRoles !== 1 ? "s" : ""} still unfilled
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setSendOffersConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => sendOffersMutation.mutate()}
              loading={sendOffersMutation.isPending}
              icon={<PaperPlaneTilt className="w-4 h-4" weight="bold" />}
            >
              Send Offers
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Publish Confirmation ── */}
      <Modal open={publishConfirmOpen} onClose={() => setPublishConfirmOpen(false)} title="Publish Cast List">
        <div className="flex flex-col items-center text-center py-4">
          <Megaphone className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-2">
            Publish the cast list for <strong>{show.title}</strong>?
          </p>
          <p className="text-xs text-clay-500 mb-6">
            This will notify all actors of their casting decisions. Make sure all assignments are finalized.
          </p>
          {unfilledRoles > 0 && (
            <div className="flex items-center gap-2 p-2 bg-stage-50 border border-stage-200 rounded-lg mb-4 text-xs text-stage-700">
              <Warning className="w-4 h-4" weight="duotone" />
              {unfilledRoles} role{unfilledRoles !== 1 ? "s" : ""} still unfilled
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setPublishConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => publishMutation.mutate()}
              loading={publishMutation.isPending}
              icon={<Megaphone className="w-4 h-4" weight="bold" />}
              disabled={!allAccepted}
            >
              Publish Cast List
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Actor Slide Panel ── */}
      <SlidePanel open={panel.type === "actor"} onClose={closePanel}>
        {selectedActor && (
          <div className="flex flex-col gap-6">
            {/* Actor header */}
            <div className="flex items-center gap-4 animate-fade-up">
              <Avatar
                name={selectedActor.displayName}
                imageUrl={selectedActor.avatarUrl}
                size="xl"
              />
              <div>
                <h2 className="text-xl font-display text-curtain-900">
                  {selectedActor.displayName}
                </h2>
                {selectedActor.pronouns && (
                  <p className="text-sm text-clay-500">{selectedActor.pronouns}</p>
                )}
              </div>
            </div>

            {/* Cast assignments for this actor */}
            {panelActorAssignments.length > 0 && (
              <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Cast As
                </h4>
                <div className="flex flex-col gap-2">
                  {panelActorAssignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                      <Pill variant="role">{a.roleName}</Pill>
                      <Badge variant={a.assignmentType === "primary" ? "success" : a.assignmentType === "alternate" ? "warning" : "default"} size="sm">
                        {a.assignmentType === "primary" ? "Primary" : a.assignmentType === "alternate" ? "Alternate" : "Understudy"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Callback roles for this actor */}
            {panelActorCallbacks.length > 0 && (
              <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Called Back For
                </h4>
                <div className="flex flex-col gap-2">
                  {panelActorCallbacks.map((cb) => (
                    <div key={cb.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                      <Pill variant="role">{cb.roleName}</Pill>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team notes */}
            <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
              <TeamNotesFeed
                notes={actorNotes ?? []}
                showId={showId}
                actorId={selectedActor.id}
                onPostNote={handlePostNote}
                onEditNote={handleEditNote}
                onDeleteNote={handleDeleteNote}
              />
            </div>

            <hr className="gold-line" />

            {/* Vitals */}
            {selectedActor.profile && (
              <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Vitals
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {selectedActor.profile.heightInches && (
                    <Card variant="flat" padding="compact" className="text-center">
                      <p className="text-[10px] text-clay-400 uppercase tracking-wide">Height</p>
                      <p className="text-sm font-semibold">{formatHeight(selectedActor.profile.heightInches)}</p>
                    </Card>
                  )}
                  {selectedActor.profile.vocalRange && (
                    <Card variant="flat" padding="compact" className="text-center">
                      <p className="text-[10px] text-clay-400 uppercase tracking-wide">Vocal Range</p>
                      <p className="text-sm font-semibold">{selectedActor.profile.vocalRange}</p>
                    </Card>
                  )}
                  {selectedActor.profile.danceStyles.length > 0 && (
                    <Card variant="flat" padding="compact" className="text-center">
                      <p className="text-[10px] text-clay-400 uppercase tracking-wide">Dance</p>
                      <p className="text-sm font-semibold">{selectedActor.profile.danceStyles.join(", ")}</p>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Production history */}
            {selectedActor.credits.length > 0 && (
              <div className="animate-fade-up" style={{ animationDelay: "250ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Production History
                </h4>
                <div className="flex flex-col gap-0">
                  {selectedActor.credits.map((credit) => (
                    <div key={credit.id} className="flex items-center justify-between text-sm py-1.5 border-b border-cream-100 last:border-0">
                      <span className="font-medium text-curtain-900">{credit.showTitle}</span>
                      <div className="flex items-center gap-3 text-clay-500 text-xs">
                        <span>{credit.roleName}</span>
                        <span className="text-stage-600">{credit.year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SlidePanel>
    </div>
  );
}
