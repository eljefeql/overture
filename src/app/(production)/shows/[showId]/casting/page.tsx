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
  createCastAssignment,
  updateCastAssignment,
  publishCastList,
  sendOffers,
} from "@/lib/api/client";
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
} from "@/components/ui";
import { TeamNotesFeed } from "@/components/casting/TeamNotesFeed";
import { useUIStore } from "@/stores/useUIStore";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { formatHeight } from "@/lib/utils";
import {
  Users,
  Warning,
  Plus,
  Trash,
  Megaphone,
  UserCirclePlus,
  PaperPlaneTilt,
  Eye,
} from "@phosphor-icons/react";
import type { ShowRole, Callback, CastAssignment, AssignmentType } from "@/types";

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

  // ── Data fetching ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["casting", showId],
    queryFn: async () => {
      const [show, roles, cbs, assignments, signups] = await Promise.all([
        getShow(showId),
        getShowRoles(showId),
        getCallbacks(showId),
        getCastAssignments(showId),
        getAuditionSignups(showId),
      ]);
      return { show, roles, callbacks: cbs, assignments, signups };
    },
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
    mutationFn: (params: { roleId: string; roleName: string; actorId: string; actorName: string; assignmentType: AssignmentType }) =>
      createCastAssignment({
        showId,
        roleId: params.roleId,
        roleName: params.roleName,
        actorId: params.actorId,
        actorName: params.actorName,
        assignmentType: params.assignmentType,
        status: "draft",
        sortOrder: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casting", showId] });
      toast("success", "Actor assigned!");
      setAssignModalOpen(false);
      setSelectedActorId(null);
      setAssignRoleId(null);
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

  const sendOffersMutation = useMutation({
    mutationFn: () => sendOffers(showId),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["casting", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", `${count} offer${count !== 1 ? "s" : ""} sent! Waiting for actor responses.`);
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

  const { show, roles, callbacks: cbs, assignments, signups } = data;

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

  // Get callback-accepted candidates for a role (not already assigned)
  const getCallbackCandidates = (roleId: string) => {
    const assigned = activeAssignments
      .filter((a) => a.roleId === roleId)
      .map((a) => a.actorId);
    const assignedSet = new Set(assigned);
    return acceptedCallbacks.filter(
      (c) => c.roleId === roleId && !assignedSet.has(c.actorId)
    );
  };

  // Get all-auditioned candidates for a role (not in callback pool, not already assigned)
  const getAllAuditionedCandidates = (roleId: string) => {
    const assigned = activeAssignments
      .filter((a) => a.roleId === roleId)
      .map((a) => a.actorId);
    const callbackActorIds = new Set(
      acceptedCallbacks.filter((c) => c.roleId === roleId).map((c) => c.actorId)
    );
    const assignedSet = new Set(assigned);
    return allAuditionedSignups.filter(
      (s) => !assignedSet.has(s.actorId) && !callbackActorIds.has(s.actorId)
    );
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
    setAssignModalOpen(true);
  };

  const submitAssignment = () => {
    if (!assignRoleId || !selectedActorId) return;
    const role = roles?.find((r) => r.id === assignRoleId);
    // Look in callbacks first, then in signups
    const cb = cbs.find((c) => c.actorId === selectedActorId && c.roleId === assignRoleId);
    const signup = signups.find((s) => s.actorId === selectedActorId);
    const actorName = cb?.actorName ?? signup?.actorName;
    if (!role || !actorName) return;
    assignMutation.mutate({
      roleId: assignRoleId,
      roleName: role.name,
      actorId: selectedActorId,
      actorName,
      assignmentType: assignType,
    });
  };

  const callbackCandidates = assignRoleId ? getCallbackCandidates(assignRoleId) : [];
  const allAuditionedCandidates = assignRoleId ? getAllAuditionedCandidates(assignRoleId) : [];

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
            const hasPrimary = roleAssignments.some((a) => a.assignmentType === "primary");
            const hasAlternate = roleAssignments.some((a) => a.assignmentType === "alternate");
            const hasUnderstudy = roleAssignments.some((a) => a.assignmentType === "understudy");

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
                    <span className="text-xs text-clay-400">
                      {role.gender === "any" ? "Any gender" : role.gender}
                    </span>
                  </div>
                  <span className="text-xs text-clay-400">
                    {candidateCount} candidate{candidateCount !== 1 ? "s" : ""}
                  </span>
                </CardHeader>

                {/* Assignment slots */}
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
        onClose={() => {
          setAssignModalOpen(false);
          setAssignRoleId(null);
          setSelectedActorId(null);
        }}
        title={`Select ${assignType} — ${roles?.find((r) => r.id === assignRoleId)?.name ?? "Role"}`}
      >
        <div className="py-4">
          {callbackCandidates.length > 0 || allAuditionedCandidates.length > 0 ? (
            <>
              <div className="flex flex-col gap-2 mb-6 max-h-72 overflow-y-auto">
                {/* Callback-accepted actors (primary pool) */}
                {callbackCandidates.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-1">
                      Callback Pool
                    </h3>
                    {callbackCandidates.map((cb) => (
                      <label
                        key={cb.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                          selectedActorId === cb.actorId
                            ? "border-stage-400 bg-stage-50"
                            : "border-cream-200 hover:border-stage-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="castActor"
                          value={cb.actorId}
                          checked={selectedActorId === cb.actorId}
                          onChange={() => setSelectedActorId(cb.actorId)}
                          className="accent-stage-500"
                        />
                        <Avatar name={cb.actorName} size="sm" />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-curtain-900">{cb.actorName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openActorPanel(cb.actorId, showId);
                          }}
                          className="p-1.5 rounded-lg text-clay-500 hover:text-curtain-900 hover:bg-cream-100 transition"
                          title="View profile"
                          aria-label="View profile"
                        >
                          <Eye className="w-4 h-4" weight="duotone" />
                        </button>
                      </label>
                    ))}
                  </>
                )}

                {/* All Auditioned actors (broader pool) */}
                {allAuditionedCandidates.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-1 mt-3">
                      All Auditioned
                    </h3>
                    {allAuditionedCandidates.map((signup) => (
                      <label
                        key={signup.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                          selectedActorId === signup.actorId
                            ? "border-stage-400 bg-stage-50"
                            : "border-cream-200 hover:border-stage-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="castActor"
                          value={signup.actorId}
                          checked={selectedActorId === signup.actorId}
                          onChange={() => setSelectedActorId(signup.actorId)}
                          className="accent-stage-500"
                        />
                        <Avatar name={signup.actorName} size="sm" />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-curtain-900">{signup.actorName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openActorPanel(signup.actorId, showId);
                          }}
                          className="p-1.5 rounded-lg text-clay-500 hover:text-curtain-900 hover:bg-cream-100 transition"
                          title="View profile"
                          aria-label="View profile"
                        >
                          <Eye className="w-4 h-4" weight="duotone" />
                        </button>
                      </label>
                    ))}
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setAssignModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitAssignment}
                  loading={assignMutation.isPending}
                  disabled={!selectedActorId}
                >
                  Assign Actor
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-clay-500 mb-4">
                No available candidates. Actors must have auditioned for this show.
              </p>
              <Button variant="ghost" onClick={() => setAssignModalOpen(false)}>
                Close
              </Button>
            </div>
          )}
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
