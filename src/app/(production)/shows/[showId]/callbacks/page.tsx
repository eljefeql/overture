"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShow,
  getShowRoles,
  getCallbacks,
  getAuditionSignups,
  getActor,
  getTeamNotes,
  createCallback,
  notifyCallbacks,
  updateShow,
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
import { formatDate, formatHeight } from "@/lib/utils";
import {
  PaperPlaneTilt,
  Plus,
  Warning,
  Calendar,
  UserCirclePlus,
  Users,
} from "@phosphor-icons/react";
import { CALLBACK_STATUS_LABELS, CALLBACK_STATUS_BADGE } from "@/lib/constants";
import type { Callback, AuditionSignup, ShowRole } from "@/types";

/* ============================================================
   Callbacks Page — Manage callback invitations by role
   Real "Add Actor" + "Send Notifications" + uncalled actors
   ============================================================ */

export default function CallbacksPage() {
  const { showId } = useParams<{ showId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const panel = useUIStore((s) => s.panel);
  const openActorPanel = useUIStore((s) => s.openActorPanel);
  const closePanel = useUIStore((s) => s.closePanel);

  const [addActorModalOpen, setAddActorModalOpen] = useState(false);
  const [addActorRoleId, setAddActorRoleId] = useState<string | null>(null);
  const [selectedActorForCallback, setSelectedActorForCallback] = useState<string | null>(null);
  const [notifyConfirmOpen, setNotifyConfirmOpen] = useState(false);
  const [advanceConfirmOpen, setAdvanceConfirmOpen] = useState(false);

  // ── Data fetching ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["callbacks", showId],
    queryFn: async () => {
      const [show, roles, cbs, signups] = await Promise.all([
        getShow(showId),
        getShowRoles(showId),
        getCallbacks(showId),
        getAuditionSignups(showId),
      ]);
      return { show, roles, callbacks: cbs, signups };
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

  // ── Mutations ──
  const callbackMutation = useMutation({
    mutationFn: createCallback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callbacks", showId] });
      toast("success", "Actor added to callbacks!");
      setAddActorModalOpen(false);
      setSelectedActorForCallback(null);
      setAddActorRoleId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const notifyMutation = useMutation({
    mutationFn: () => notifyCallbacks(showId),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["callbacks", showId] });
      toast("success", `Notified ${count} actor${count !== 1 ? "s" : ""}!`);
      setNotifyConfirmOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const advanceShowMutation = useMutation({
    mutationFn: () => updateShow(showId, { status: "casting" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callbacks", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Moved to casting phase!");
      setAdvanceConfirmOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
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

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.show) return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <EmptyState
        icon={<Warning className="w-12 h-12" weight="duotone" />}
        title="Unable to load callbacks"
        description="Something went wrong. Please try again."
        action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
      />
    </div>
  );

  const { show, roles, callbacks: cbs, signups } = data;

  // Group callbacks by role
  const callbacksByRole: Record<string, Callback[]> = {};
  cbs.forEach((cb) => {
    if (!callbacksByRole[cb.roleId]) callbacksByRole[cb.roleId] = [];
    callbacksByRole[cb.roleId].push(cb);
  });

  // Stats
  const uniqueActors = new Set(cbs.map((c) => c.actorId)).size;
  const accepted = cbs.filter((c) => c.status === "accepted").length;
  const awaiting = cbs.filter((c) => c.status === "pending" || c.status === "notified").length;
  const declined = cbs.filter((c) => c.status === "declined").length;

  // Uncalled actors — auditioned or shortlisted but not yet in callbacks
  const calledActorIds = new Set(cbs.map((c) => c.actorId));
  const uncalledActors = signups.filter(
    (s) =>
      (s.status === "auditioned" || s.status === "shortlisted") &&
      !calledActorIds.has(s.actorId)
  );

  // Eligible actors for "Add Actor" modal (auditioned/shortlisted + not already called for this role)
  const getEligibleActors = (roleId: string) => {
    const alreadyCalled = cbs
      .filter((c) => c.roleId === roleId)
      .map((c) => c.actorId);
    const alreadyCalledSet = new Set(alreadyCalled);
    return signups.filter(
      (s) =>
        ["auditioned", "shortlisted", "callback"].includes(s.status) &&
        !alreadyCalledSet.has(s.actorId)
    );
  };

  const eligibleActors = addActorRoleId ? getEligibleActors(addActorRoleId) : [];

  const openAddActorModal = (roleId: string) => {
    setAddActorRoleId(roleId);
    setSelectedActorForCallback(null);
    setAddActorModalOpen(true);
  };

  const submitAddActor = () => {
    if (!addActorRoleId || !selectedActorForCallback) return;
    const role = roles?.find((r) => r.id === addActorRoleId);
    const signup = signups.find((s) => s.actorId === selectedActorForCallback);
    if (!role || !signup) return;
    callbackMutation.mutate({
      showId,
      actorId: signup.actorId,
      actorName: signup.actorName,
      roleId: addActorRoleId,
      roleName: role.name,
    });
  };

  // Panel actor callback roles
  const panelActorCallbacks = selectedPanelActorId
    ? cbs.filter((c) => c.actorId === selectedPanelActorId)
    : [];

  // Pending count for notify button
  const pendingCount = cbs.filter((c) => c.status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display text-curtain-900">Callbacks</h1>
          <p className="text-sm text-clay-500 mt-1">
            {show.callbackDate ? formatDate(show.callbackDate) : "Date TBD"}
            {show.callbackLocation && ` · ${show.callbackLocation}`}
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => setNotifyConfirmOpen(true)}
              icon={<PaperPlaneTilt className="w-4 h-4" weight="bold" />}
            >
              Send Notifications ({pendingCount})
            </Button>
          )}
          {show.status === "callbacks" && (
            <Button
              variant="primary"
              onClick={() => setAdvanceConfirmOpen(true)}
            >
              Move to Casting
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
        <StatBlock label="Called Back" value={String(uniqueActors)} />
        <StatBlock label="Accepted" value={String(accepted)} />
        <StatBlock label="Awaiting" value={String(awaiting)} />
        <StatBlock label="Declined" value={String(declined)} />
      </div>

      {/* ── Two-panel layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Roles with callbacks */}
        <div className="lg:col-span-2 flex flex-col gap-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
          {roles && roles.length > 0 ? (
            roles.map((role) => {
              const roleCbs = callbacksByRole[role.id] ?? [];
              return (
                <Card key={role.id} variant="elevated">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <CardTitle>{role.name}</CardTitle>
                      <Badge variant="default" size="sm">{role.roleType}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-clay-400">
                        {roleCbs.length} actor{roleCbs.length !== 1 ? "s" : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAddActorModal(role.id)}
                        icon={<Plus className="w-3.5 h-3.5" weight="bold" />}
                      >
                        Add
                      </Button>
                    </div>
                  </CardHeader>

                  {roleCbs.length > 0 ? (
                    <div className="flex flex-col gap-0">
                      {roleCbs.map((cb) => {
                        return (
                          <div
                            key={cb.id}
                            className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-cream-50 cursor-pointer transition border-b border-cream-100 last:border-0"
                            onClick={() => openActorPanel(cb.actorId, showId)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar name={cb.actorName} size="sm" />
                              <span className="text-sm font-semibold text-curtain-900">
                                {cb.actorName}
                              </span>
                            </div>
                            <Badge variant={(CALLBACK_STATUS_BADGE[cb.status] ?? "warning") as "default"} size="sm">
                              {CALLBACK_STATUS_LABELS[cb.status] ?? "Pending"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-clay-500 py-2">
                      No actors called back for this role yet.
                    </p>
                  )}
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon={<Users className="w-12 h-12" weight="duotone" />}
              title="No roles defined"
              description="Add roles from the Setup page before managing callbacks."
            />
          )}
        </div>

        {/* Right column — Uncalled actors */}
        <div className="flex flex-col gap-6 animate-fade-up" style={{ animationDelay: "150ms" }}>
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Uncalled Actors</CardTitle>
            </CardHeader>
            {uncalledActors.length > 0 ? (
              <div className="flex flex-col gap-0">
                {uncalledActors.map((signup) => (
                  <div
                    key={signup.id}
                    className="flex items-center justify-between py-2 px-1 border-b border-cream-100 last:border-0"
                  >
                    <div
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
                      onClick={() => openActorPanel(signup.actorId, showId)}
                    >
                      <Avatar name={signup.actorName} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-curtain-900">{signup.actorName}</p>
                        <p className="text-[11px] text-clay-400">
                          {signup.status === "shortlisted" ? "Shortlisted" : "Auditioned"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay-500">
                All auditioned actors have been called back.
              </p>
            )}
          </Card>

          {/* Callback Quick Stats */}
          <Card variant="flat">
            <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
              At a Glance
            </h4>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-clay-500">Total signups</span>
                <span className="font-semibold text-curtain-900">{signups.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-clay-500">Called back</span>
                <span className="font-semibold text-curtain-900">{uniqueActors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-clay-500">Not called</span>
                <span className="font-semibold text-curtain-900">{uncalledActors.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-clay-500">Response rate</span>
                <span className="font-semibold text-curtain-900">
                  {cbs.length > 0
                    ? `${Math.round(((accepted + declined) / cbs.length) * 100)}%`
                    : "—"}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Add Actor to Callback Modal ── */}
      <Modal
        open={addActorModalOpen}
        onClose={() => {
          setAddActorModalOpen(false);
          setAddActorRoleId(null);
          setSelectedActorForCallback(null);
        }}
        title={`Add Actor — ${roles?.find((r) => r.id === addActorRoleId)?.name ?? "Role"}`}
      >
        <div className="py-4">
          {eligibleActors.length > 0 ? (
            <>
              <p className="text-sm text-clay-500 mb-4">
                Select an actor to call back for this role. All auditioned and shortlisted actors are eligible.
              </p>
              <div className="flex flex-col gap-2 mb-6 max-h-72 overflow-y-auto">
                {/* Sort: actors who requested this role first, then others */}
                {[...eligibleActors]
                  .sort((a, b) => {
                    const aRequested = addActorRoleId && a.rolesInterested.includes(addActorRoleId) ? 0 : 1;
                    const bRequested = addActorRoleId && b.rolesInterested.includes(addActorRoleId) ? 0 : 1;
                    return aRequested - bRequested;
                  })
                  .map((signup) => {
                    const requestedThisRole = addActorRoleId && signup.rolesInterested.includes(addActorRoleId);
                    const roleNames = signup.rolesInterested
                      .map((rid) => roles?.find((r) => r.id === rid)?.name)
                      .filter(Boolean);
                    return (
                      <label
                        key={signup.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                          selectedActorForCallback === signup.actorId
                            ? "border-stage-400 bg-stage-50"
                            : "border-cream-200 hover:border-stage-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="callbackActor"
                          value={signup.actorId}
                          checked={selectedActorForCallback === signup.actorId}
                          onChange={() => setSelectedActorForCallback(signup.actorId)}
                          className="accent-stage-500"
                        />
                        <Avatar name={signup.actorName} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-curtain-900">{signup.actorName}</span>
                            {requestedThisRole && (
                              <span className="text-[10px] text-stage-600 font-medium">Requested</span>
                            )}
                          </div>
                          <p className="text-[11px] text-clay-400 truncate">
                            Interested in: {roleNames.length > 0 ? roleNames.join(", ") : "—"}
                            {signup.openToOther && " (+Any)"}
                          </p>
                        </div>
                        <Badge variant={signup.status === "shortlisted" ? "gold" : signup.status === "callback" ? "gold" : "success"} size="sm">
                          {signup.status === "shortlisted" ? "Shortlisted" : signup.status === "callback" ? "Callback" : "Auditioned"}
                        </Badge>
                      </label>
                    );
                  })}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setAddActorModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitAddActor}
                  loading={callbackMutation.isPending}
                  disabled={!selectedActorForCallback}
                >
                  Add to Callback
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-clay-500 mb-4">
                No eligible actors available. Actors must be auditioned or shortlisted first.
              </p>
              <Button variant="ghost" onClick={() => setAddActorModalOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Send Notifications Confirmation ── */}
      <Modal open={notifyConfirmOpen} onClose={() => setNotifyConfirmOpen(false)} title="Send Callback Notifications">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-2">
            This will notify <strong>{pendingCount}</strong> actor{pendingCount !== 1 ? "s" : ""} about their callback invitation.
          </p>
          <p className="text-xs text-clay-500 mb-6">
            They will receive a notification and can accept or decline.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setNotifyConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => notifyMutation.mutate()}
              loading={notifyMutation.isPending}
              icon={<PaperPlaneTilt className="w-4 h-4" weight="bold" />}
            >
              Send Notifications
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

            {/* Callback roles for this actor */}
            {panelActorCallbacks.length > 0 && (
              <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
                <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                  Called Back For
                </h4>
                <div className="flex flex-col gap-2">
                  {panelActorCallbacks.map((cb) => {
                    return (
                      <div key={cb.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                        <Pill variant="role">{cb.roleName}</Pill>
                        <Badge variant={(CALLBACK_STATUS_BADGE[cb.status] ?? "warning") as "default"} size="sm">{CALLBACK_STATUS_LABELS[cb.status] ?? "Pending"}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Team notes */}
            <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
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
              <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
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
              <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
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

      {/* ── Advance to Casting Confirmation ── */}
      <Modal open={advanceConfirmOpen} onClose={() => setAdvanceConfirmOpen(false)} title="Move to Casting">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-4">
            Move to casting? Make sure all callbacks have been sent.
          </p>
          {awaiting > 0 && (
            <p className="text-xs text-ruby-500 mb-2">{awaiting} callback{awaiting !== 1 ? "s" : ""} still awaiting a response.</p>
          )}
          {uniqueActors === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No callbacks have been created yet.</p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setAdvanceConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => advanceShowMutation.mutate()} loading={advanceShowMutation.isPending}>
              Move to Casting
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
