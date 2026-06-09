"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShow,
  getShowRoles,
  getAuditionGroups,
  getAuditionSignups,
  getTeamNotes,
  getActor,
  getCallbacks,
  updateSignupStatus,
  updateShow,
  createCallback,
  deleteCallback,
  postTeamNote,
  updateTeamNote,
  deleteTeamNote,
} from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  VerifiedBadge,
  Button,
  Pill,
  Avatar,
  Modal,
  SlidePanel,
  StatBlock,
  PageSkeleton,
  EmptyState,
} from "@/components/ui";
import { TeamNotesFeed } from "@/components/casting/TeamNotesFeed";
import { useUIStore } from "@/stores/useUIStore";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { formatTime, formatHeight, formatDate } from "@/lib/utils";
import {
  MagnifyingGlass,
  CheckCircle,
  ClipboardText,
  Star,
  ArrowBendUpRight,
  UserMinus,
  Users,
  Warning,
  X,
} from "@phosphor-icons/react";
import { SIGNUP_STATUS_LABELS, SIGNUP_STATUS_BADGE } from "@/lib/constants";
import type { AuditionSignup, SignupStatus, ShowStatus } from "@/types";

/* ============================================================
   Auditions Page — Production team audition management
   Real status actions, search/filter, batch ops, actor panel
   ============================================================ */

const STATUS_FILTERS: { value: SignupStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "signed_up", label: "Signed Up" },
  { value: "checked_in", label: "Checked In" },
  { value: "auditioned", label: "Auditioned" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "callback", label: "Callback" },
];

export default function AuditionsPage() {
  const { showId } = useParams<{ showId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const panel = useUIStore((s) => s.panel);
  const openActorPanel = useUIStore((s) => s.openActorPanel);
  const closePanel = useUIStore((s) => s.closePanel);

  const [statusFilter, setStatusFilter] = useState<SignupStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);
  const [callbackTarget, setCallbackTarget] = useState<AuditionSignup | null>(null);
  const [callbackRoleIds, setCallbackRoleIds] = useState<Set<string>>(new Set());
  const [advanceConfirmOpen, setAdvanceConfirmOpen] = useState(false);
  const [callbackPrepNotes, setCallbackPrepNotes] = useState("");

  // ── Data fetching ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["auditions", showId],
    queryFn: async () => {
      const [show, roles, groups, signups, cbs] = await Promise.all([
        getShow(showId),
        getShowRoles(showId),
        getAuditionGroups(showId),
        getAuditionSignups(showId),
        getCallbacks(showId),
      ]);
      return { show, roles, groups, signups, callbacks: cbs };
    },
  });

  // Panel actor data
  const selectedActorId = panel.type === "actor" ? panel.actorId : null;

  const { data: selectedActor } = useQuery({
    queryKey: ["actor", selectedActorId],
    queryFn: () => getActor(selectedActorId!),
    enabled: !!selectedActorId,
  });

  const { data: actorNotes } = useQuery({
    queryKey: ["teamNotes", showId, selectedActorId],
    queryFn: () => getTeamNotes(showId, selectedActorId!),
    enabled: !!selectedActorId,
  });

  // ── Mutations ──
  const statusMutation = useMutation({
    mutationFn: ({ signupId, status }: { signupId: string; status: SignupStatus }) =>
      updateSignupStatus(signupId, status),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["auditions", showId] });
      toast("success", `Status updated to ${SIGNUP_STATUS_LABELS[status]}`);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const callbackMutation = useMutation({
    mutationFn: createCallback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditions", showId] });
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteCallbackMutation = useMutation({
    mutationFn: deleteCallback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditions", showId] });
      toast("info", "Callback removed.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const advanceShowMutation = useMutation({
    mutationFn: (newStatus: ShowStatus) => updateShow(showId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditions", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Show status updated!");
      setAdvanceConfirmOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const handlePostNote = async (body: string) => {
    if (!user || activeRole.type !== "team" || !selectedActorId) return;
    await postTeamNote({
      showId,
      actorId: selectedActorId,
      authorId: user.id,
      authorName: user.displayName,
      authorRole: activeRole.teamRole,
      body,
    });
    queryClient.invalidateQueries({ queryKey: ["teamNotes", showId, selectedActorId] });
  };

  const handleEditNote = async (noteId: string, body: string) => {
    await updateTeamNote(noteId, body);
    queryClient.invalidateQueries({ queryKey: ["teamNotes", showId, selectedActorId] });
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteTeamNote(noteId);
    queryClient.invalidateQueries({ queryKey: ["teamNotes", showId, selectedActorId] });
  };

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.show) return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <EmptyState
        icon={<Warning className="w-12 h-12" weight="duotone" />}
        title="Unable to load auditions"
        description="Something went wrong. Please try again."
        action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
      />
    </div>
  );

  const { show, roles, groups, signups, callbacks: cbs } = data;

  const roleMap: Record<string, string> =
    roles?.reduce((acc, r) => ({ ...acc, [r.id]: r.name }), {} as Record<string, string>) ?? {};

  // Stats
  const totalSignups = signups.length;
  const checkedIn = signups.filter((s) => s.status === "checked_in").length;
  const auditioned = signups.filter((s) => s.status === "auditioned").length;
  const shortlisted = signups.filter((s) => s.status === "shortlisted").length;
  const callbackCount = signups.filter((s) => s.status === "callback").length;

  // Filter + search signups
  const filteredSignups = signups.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search && !s.actorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Toggle batch selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filteredSignups.map((s) => s.id)));
  const clearSelection = () => setSelected(new Set());

  // Valid status transitions — enforce logical order
  const VALID_TRANSITIONS: Record<string, SignupStatus[]> = {
    signed_up: ["checked_in", "shortlisted", "released"],
    checked_in: ["auditioned", "shortlisted", "released"],
    auditioned: ["shortlisted", "callback", "released"],
    shortlisted: ["callback", "released"],
  };

  // Batch status update with validation
  const batchUpdateStatus = (status: SignupStatus) => {
    const validSignups = [...selected].filter((signupId) => {
      const signup = signups.find((s) => s.id === signupId);
      if (!signup) return false;
      const allowed = VALID_TRANSITIONS[signup.status];
      return allowed?.includes(status);
    });

    if (validSignups.length === 0) {
      toast("error", `None of the selected actors can be moved to "${SIGNUP_STATUS_LABELS[status]}" from their current status.`);
      return;
    }

    if (validSignups.length < selected.size) {
      toast("info", `${selected.size - validSignups.length} actor(s) skipped — already past that status.`);
    }

    validSignups.forEach((signupId) => {
      statusMutation.mutate({ signupId, status });
    });
    clearSelection();
  };

  // Open callback modal for a specific actor (checkboxes for multi-role)
  // Shows the desired final state: existing callbacks are pre-checked,
  // plus the actor's interested roles as suggestions. Director can toggle any.
  const openCallbackModal = (signup: AuditionSignup) => {
    setCallbackTarget(signup);
    // Start with: existing callbacks + actor's interested roles (as suggestions)
    const existingCallbackRoleIds = cbs
      .filter((c) => c.actorId === signup.actorId)
      .map((c) => c.roleId);
    const suggested = new Set([
      ...existingCallbackRoleIds,
      ...signup.rolesInterested,
    ]);
    setCallbackRoleIds(suggested);
    setCallbackPrepNotes("");
    setCallbackModalOpen(true);
  };

  // Toggle a role in the checkbox set
  const toggleCallbackRole = (roleId: string) => {
    setCallbackRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  // Submit: diff desired state vs existing callbacks → create new, delete removed
  const submitCallbacks = async () => {
    if (!callbackTarget) return;
    const existingCbsForActor = cbs.filter((c) => c.actorId === callbackTarget.actorId);
    const existingRoleIds = new Set(existingCbsForActor.map((c) => c.roleId));

    // Roles to ADD (in desired set but not existing)
    const toAdd = [...callbackRoleIds].filter((rid) => !existingRoleIds.has(rid));
    // Roles to REMOVE (existing but not in desired set)
    const toRemove = existingCbsForActor.filter((c) => !callbackRoleIds.has(c.roleId));

    let added = 0;
    let removed = 0;

    for (const roleId of toAdd) {
      const role = roles?.find((r) => r.id === roleId);
      if (!role) continue;
      try {
        await createCallback({
          showId,
          actorId: callbackTarget.actorId,
          actorName: callbackTarget.actorName,
          roleId,
          roleName: role.name,
          prepNotes: callbackPrepNotes.trim() || undefined,
        });
        added++;
      } catch {
        // Skip duplicates silently
      }
    }

    for (const cb of toRemove) {
      try {
        await deleteCallback(cb.id);
        removed++;
      } catch {
        // Skip errors silently
      }
    }

    queryClient.invalidateQueries({ queryKey: ["auditions", showId] });

    if (added > 0 && removed > 0) {
      toast("success", `Added ${added} role${added !== 1 ? "s" : ""}, removed ${removed}.`);
    } else if (added > 0) {
      toast("success", `Sent to callback for ${added} role${added !== 1 ? "s" : ""}!`);
    } else if (removed > 0) {
      toast("info", `Removed ${removed} callback role${removed !== 1 ? "s" : ""}.`);
    }

    setCallbackModalOpen(false);
    setCallbackTarget(null);
    setCallbackRoleIds(new Set());
  };

  // Find the signup for the panel actor
  const panelSignup = selectedActorId
    ? signups.find((s) => s.actorId === selectedActorId)
    : null;

  // Callbacks for the panel actor
  const panelActorCallbacks = selectedActorId
    ? cbs.filter((c) => c.actorId === selectedActorId)
    : [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display text-curtain-900">Audition Schedule</h1>
          <p className="text-sm text-clay-500 mt-1">
            {show.auditionStart ? formatDate(show.auditionStart) : "Date TBD"}
            {show.auditionLocation && ` · ${show.auditionLocation}`}
          </p>
        </div>
        <div className="flex gap-2">
          {show.status === "auditions_open" && (
            <Button
              variant="primary"
              onClick={() => setAdvanceConfirmOpen(true)}
            >
              Close Auditions
            </Button>
          )}
          {(show.status === "auditions_closed" || show.status === "auditions_open") && (
            <Button
              variant="primary"
              onClick={() => advanceShowMutation.mutate("callbacks")}
              loading={advanceShowMutation.isPending}
            >
              Move to Callbacks
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
        <StatBlock label="Signed Up" value={String(totalSignups)} />
        <StatBlock label="Checked In" value={String(checkedIn)} />
        <StatBlock label="Auditioned" value={String(auditioned)} />
        <StatBlock label="Shortlisted" value={String(shortlisted)} />
        <StatBlock label="Callbacks" value={String(callbackCount)} />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clay-400" weight="bold" />
          <input
            type="text"
            placeholder="Search actors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 focus:border-stage-400 text-curtain-900 placeholder:text-clay-400"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Pill
              key={f.value}
              variant="filter"
              active={statusFilter === f.value}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Pill>
          ))}
        </div>

        {/* Batch toggle */}
        <Button
          variant={batchMode ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setBatchMode(!batchMode);
            clearSelection();
          }}
        >
          {batchMode ? "Exit Batch" : "Batch"}
        </Button>
      </div>

      {/* ── Batch Action Bar ── */}
      {batchMode && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-stage-50 border border-stage-200 rounded-xl animate-fade-up">
          <span className="text-sm font-semibold text-curtain-900">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => batchUpdateStatus("checked_in")}>Check In</Button>
          <Button size="sm" variant="outline" onClick={() => batchUpdateStatus("auditioned")}>Mark Auditioned</Button>
          <Button size="sm" variant="outline" onClick={() => batchUpdateStatus("shortlisted")}>Shortlist</Button>
          <Button size="sm" variant="outline" onClick={() => batchUpdateStatus("released")}>Release</Button>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={selectAll}>Select All</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
        </div>
      )}

      {/* ── Groups ── */}
      <div className="flex flex-col gap-6 animate-fade-up" style={{ animationDelay: "150ms" }}>
        {groups && groups.length > 0 ? (
          groups.map((group) => {
            const groupSignups = filteredSignups.filter((s) => s.groupId === group.id);
            const totalInGroup = signups.filter((s) => s.groupId === group.id).length;

            return (
              <Card key={group.id} variant="elevated">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle>{group.name}</CardTitle>
                    <span className="text-xs text-stage-600 font-medium">
                      {formatTime(group.startTime)} &ndash; {formatTime(group.endTime)}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${totalInGroup >= group.slotCount ? "text-ruby-500" : totalInGroup >= group.slotCount * 0.8 ? "text-stage-600" : "text-clay-400"}`}>
                    {totalInGroup} / {group.slotCount} slots{totalInGroup >= group.slotCount ? " · Full" : ""}
                  </span>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupSignups.map((signup) => (
                    <div
                      key={signup.id}
                      className={`relative bg-cream-50 border rounded-2xl p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md group ${
                        selected.has(signup.id) ? "border-stage-400 ring-2 ring-stage-200" : "border-cream-200 hover:border-stage-300"
                      }`}
                    >
                      {/* Batch checkbox */}
                      {batchMode && (
                        <input
                          type="checkbox"
                          checked={selected.has(signup.id)}
                          onChange={() => toggleSelect(signup.id)}
                          className="absolute top-3 right-3 w-4 h-4 accent-stage-500"
                        />
                      )}

                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => {
                          if (batchMode) {
                            toggleSelect(signup.id);
                          } else {
                            openActorPanel(signup.actorId, signup.showId);
                          }
                        }}
                      >
                        <Avatar name={signup.actorName} imageUrl={signup.actorAvatarUrl} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-curtain-900 truncate group-hover:text-curtain-700">
                            {signup.actorName}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {signup.rolesInterested.slice(0, 2).map((roleId) => (
                              <span key={roleId} className="text-[11px] text-clay-500">
                                {roleMap[roleId] ?? "Role"}
                              </span>
                            ))}
                            {signup.openToOther && (
                              <span className="text-[11px] text-stage-600">+Any</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={SIGNUP_STATUS_BADGE[signup.status] as "default"} size="sm">
                          {SIGNUP_STATUS_LABELS[signup.status]}
                        </Badge>
                      </div>

                      {/* ── Action Menu (not in batch mode) ── */}
                      {!batchMode && (
                        <div className="relative mt-2 pt-2 border-t border-cream-100 flex items-center gap-1">
                          {signup.status === "signed_up" && (
                            <button
                              onClick={() => statusMutation.mutate({ signupId: signup.id, status: "checked_in" })}
                              className="flex items-center gap-1 text-[11px] text-clay-500 hover:text-forest-600 transition px-2 py-1 rounded-lg hover:bg-cream-100"
                              title="Check In"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                              Check In
                            </button>
                          )}
                          {signup.status === "checked_in" && (
                            <button
                              onClick={() => statusMutation.mutate({ signupId: signup.id, status: "auditioned" })}
                              className="flex items-center gap-1 text-[11px] text-clay-500 hover:text-forest-600 transition px-2 py-1 rounded-lg hover:bg-cream-100"
                              title="Mark Auditioned"
                            >
                              <ClipboardText className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                              Auditioned
                            </button>
                          )}
                          {(signup.status === "auditioned" || signup.status === "checked_in" || signup.status === "signed_up") && (
                            <button
                              onClick={() => statusMutation.mutate({ signupId: signup.id, status: "shortlisted" })}
                              className="flex items-center gap-1 text-[11px] text-clay-500 hover:text-stage-600 transition px-2 py-1 rounded-lg hover:bg-cream-100"
                              title="Shortlist"
                            >
                              <Star className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                              Shortlist
                            </button>
                          )}
                          {(signup.status === "auditioned" || signup.status === "shortlisted") && (
                            <button
                              onClick={() => openCallbackModal(signup)}
                              className="flex items-center gap-1 text-[11px] text-clay-500 hover:text-stage-600 transition px-2 py-1 rounded-lg hover:bg-cream-100"
                              title="Send to Callback"
                            >
                              <ArrowBendUpRight className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                              Callback
                            </button>
                          )}
                          {signup.status !== "released" && signup.status !== "withdrawn" && signup.status !== "callback" && (
                            <button
                              onClick={() => statusMutation.mutate({ signupId: signup.id, status: "released" })}
                              className="flex items-center gap-1 text-[11px] text-clay-500 hover:text-ruby-500 transition px-2 py-1 rounded-lg hover:bg-cream-100 ml-auto"
                              title="Release"
                            >
                              <UserMinus className="w-3.5 h-3.5" weight="duotone" />
                              Release
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Empty slot placeholders */}
                  {Array.from({
                    length: Math.max(0, group.slotCount - totalInGroup),
                  }).map((_, i) => (
                    <div
                      key={`empty-${group.id}-${i}`}
                      className="border-2 border-dashed border-cream-300 rounded-2xl p-3 flex items-center justify-center text-sm text-clay-400 min-h-[60px]"
                    >
                      Open Slot
                    </div>
                  ))}
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon={<Users className="w-12 h-12" weight="duotone" />}
            title="No time slots defined"
            description="Add audition time slots from the Setup page."
          />
        )}
      </div>

      {/* ── Callback Role Selection Modal (Checkboxes) ── */}
      <Modal
        open={callbackModalOpen}
        onClose={() => {
          setCallbackModalOpen(false);
          setCallbackTarget(null);
          setCallbackRoleIds(new Set());
        }}
        title="Send to Callback"
      >
        {callbackTarget && roles && (
          <div className="py-4">
            <p className="text-sm text-curtain-800 mb-4">
              Select roles to call back <strong>{callbackTarget.actorName}</strong> for:
            </p>
            {callbackTarget.openToOther && (
              <p className="text-xs text-stage-600 mb-3">
                This actor indicated they are open to any role.
              </p>
            )}
            <div className="flex flex-col gap-2 mb-6">
              {roles.map((role) => {
                const existingCb = cbs.find(
                  (c) => c.actorId === callbackTarget.actorId && c.roleId === role.id
                );
                const isChecked = callbackRoleIds.has(role.id);
                const isActorInterested = callbackTarget.rolesInterested.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      isChecked
                        ? "border-stage-400 bg-stage-50"
                        : "border-cream-200 hover:border-stage-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCallbackRole(role.id)}
                      className="accent-stage-500 w-4 h-4"
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-semibold text-curtain-900">{role.name}</span>
                      <Badge variant="default" size="sm">{role.roleType}</Badge>
                      {isActorInterested && (
                        <span className="text-[10px] text-stage-600 font-medium">Requested</span>
                      )}
                      {existingCb && isChecked && (
                        <span className="text-[10px] text-forest-600 font-medium">Active</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            {/* Prep notes for the actor */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
                Prep Notes <span className="font-normal text-clay-400">(optional)</span>
              </label>
              <textarea
                value={callbackPrepNotes}
                onChange={(e) => setCallbackPrepNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Prepare 16 bars of an uptempo song, bring sides for Act 2"
                className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900 placeholder:text-clay-400 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCallbackModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitCallbacks}
                disabled={(() => {
                  if (!callbackTarget) return true;
                  const existingRoleIds = new Set(
                    cbs.filter((c) => c.actorId === callbackTarget.actorId).map((c) => c.roleId)
                  );
                  // Disabled only if nothing changed
                  const hasAdds = [...callbackRoleIds].some((rid) => !existingRoleIds.has(rid));
                  const hasRemoves = [...existingRoleIds].some((rid) => !callbackRoleIds.has(rid));
                  return !hasAdds && !hasRemoves;
                })()}
              >
                Save Callbacks
              </Button>
            </div>
          </div>
        )}
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
                {selectedActor.profile?.isAvailable && (
                  <Badge variant="success" size="sm" className="mt-1">
                    Available for Projects
                  </Badge>
                )}
              </div>
            </div>

            {/* Signup info */}
            {panelSignup && (
              <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Signup Details
                </h4>
                <Card variant="flat" padding="compact">
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-clay-500">Status</span>
                      <Badge variant={SIGNUP_STATUS_BADGE[panelSignup.status] as "default"} size="sm">
                        {SIGNUP_STATUS_LABELS[panelSignup.status]}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-clay-500">Roles Interested</span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {panelSignup.rolesInterested.map((roleId) => (
                          <Pill key={roleId} variant="role">
                            {roleMap[roleId] ?? "Role"}
                          </Pill>
                        ))}
                        {panelSignup.openToOther && <Pill variant="status">+Any</Pill>}
                      </div>
                    </div>
                    {panelSignup.willCrew && (
                      <div className="flex justify-between">
                        <span className="text-clay-500">Will Crew</span>
                        <span className="text-forest-600 font-medium">Yes</span>
                      </div>
                    )}
                    {panelSignup.conflicts && (
                      <div className="flex justify-between">
                        <span className="text-clay-500">Conflicts</span>
                        <span className="text-curtain-800">{panelSignup.conflicts}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Panel actions */}
            {panelSignup && (
              <div className="flex flex-wrap gap-2 animate-fade-up" style={{ animationDelay: "100ms" }}>
                {panelSignup.status === "signed_up" && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<CheckCircle className="w-4 h-4 text-stage-500" weight="duotone" />}
                    onClick={() => statusMutation.mutate({ signupId: panelSignup.id, status: "checked_in" })}
                  >
                    Check In
                  </Button>
                )}
                {panelSignup.status === "checked_in" && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ClipboardText className="w-4 h-4 text-stage-500" weight="duotone" />}
                    onClick={() => statusMutation.mutate({ signupId: panelSignup.id, status: "auditioned" })}
                  >
                    Mark Auditioned
                  </Button>
                )}
                {(panelSignup.status === "auditioned" || panelSignup.status === "shortlisted") && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ArrowBendUpRight className="w-4 h-4 text-stage-500" weight="duotone" />}
                    onClick={() => openCallbackModal(panelSignup)}
                  >
                    Send to Callback
                  </Button>
                )}
                {panelSignup.status !== "shortlisted" && panelSignup.status !== "callback" && panelSignup.status !== "released" && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Star className="w-4 h-4 text-stage-500" weight="duotone" />}
                    onClick={() => statusMutation.mutate({ signupId: panelSignup.id, status: "shortlisted" })}
                  >
                    Shortlist
                  </Button>
                )}
              </div>
            )}

            {/* Callback roles for this actor (removable) */}
            {panelActorCallbacks.length > 0 && (
              <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Callback Roles
                </h4>
                <div className="flex flex-wrap gap-2">
                  {panelActorCallbacks.map((cb) => (
                    <div
                      key={cb.id}
                      className="flex items-center gap-1.5 bg-cream-50 border border-cream-200 rounded-full pl-3 pr-1.5 py-1"
                    >
                      <span className="text-xs font-semibold text-curtain-800">{cb.roleName}</span>
                      <button
                        onClick={() => deleteCallbackMutation.mutate(cb.id)}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-clay-400 hover:text-ruby-500 hover:bg-ruby-50 transition"
                        title={`Remove ${cb.roleName} callback`}
                      >
                        <X className="w-3 h-3" weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team notes */}
            <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
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
            <div className="animate-fade-up" style={{ animationDelay: "250ms" }}>
              <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                Vitals
              </h4>
              {selectedActor.profile && (selectedActor.profile.heightInches || selectedActor.profile.vocalRange || selectedActor.profile.danceStyles.length > 0) ? (
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
              ) : (
                <p className="text-xs text-clay-400 italic">Actor hasn&apos;t completed their profile yet.</p>
              )}
            </div>

            {/* Production history */}
            {selectedActor.credits.length > 0 && (
              <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Production History
                </h4>
                <div className="flex flex-col gap-0">
                  {selectedActor.credits.map((credit) => (
                    <div key={credit.id} className="flex items-center justify-between text-sm py-2 border-b border-cream-100 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-curtain-900">{credit.showTitle}</span>
                        {credit.verified && <VerifiedBadge />}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-curtain-800">{credit.roleName}</span>
                        <span className="text-clay-500">{credit.theatreName}</span>
                        <span className="text-stage-600 font-medium">{credit.year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {selectedActor.profile?.specialSkills && selectedActor.profile.specialSkills.length > 0 && (
              <div className="animate-fade-up" style={{ animationDelay: "350ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Special Skills
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedActor.profile.specialSkills.map((skill) => (
                    <Pill key={skill} variant="status">{skill}</Pill>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SlidePanel>

      {/* ── Advance Phase Confirmation ── */}
      <Modal open={advanceConfirmOpen} onClose={() => setAdvanceConfirmOpen(false)} title="Close Auditions">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-4">
            Close auditions? No new signups will be accepted.
          </p>
          {totalSignups === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No actors have signed up yet.</p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setAdvanceConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => advanceShowMutation.mutate("auditions_closed")} loading={advanceShowMutation.isPending}>
              Close Auditions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
