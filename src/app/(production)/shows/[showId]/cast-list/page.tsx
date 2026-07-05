"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShow,
  getShowRoles,
  getCastAssignments,
  getOrg,
  getActor,
  getTeamNotes,
  postTeamNote,
  updateTeamNote,
  deleteTeamNote,
  publishCastList,
  unpublishCastList,
} from "@/lib/api/client";
import { track } from "@/lib/analytics";
import {
  Card,
  Badge,
  Button,
  Avatar,
  Modal,
  Pill,
  SlidePanel,
  PageSkeleton,
  EmptyState,
} from "@/components/ui";
import { TeamNotesFeed } from "@/components/casting/TeamNotesFeed";
import { useToast } from "@/components/ui/Toast";
import { useUIStore } from "@/stores/useUIStore";
import { useAuth } from "@/features/auth/AuthContext";
import { formatHeight } from "@/lib/utils";
import {
  Confetti,
  ArrowLeft,
  ArrowSquareOut,
  Warning,
  Printer,
  Megaphone,
  Trophy,
  Link as LinkIcon,
  Envelope,
} from "@phosphor-icons/react";
import { formatDate } from "@/lib/utils";
import type { CastAssignment, AssignmentType } from "@/types";

/* ============================================================
   Cast List — Published or draft view
   Clean, presentation-ready display of casting decisions
   ============================================================ */

const ASSIGNMENT_LABEL: Record<AssignmentType, string> = {
  primary: "",
  alternate: "Alternate",
  understudy: "Understudy",
};

export default function CastListPage() {
  const { showId } = useParams<{ showId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const { user, activeRole } = useAuth();
  const panel = useUIStore((s) => s.panel);
  const openActorPanel = useUIStore((s) => s.openActorPanel);
  const closePanel = useUIStore((s) => s.closePanel);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["castList", showId],
    queryFn: async () => {
      const [show, roles, assignments] = await Promise.all([
        getShow(showId),
        getShowRoles(showId),
        getCastAssignments(showId),
      ]);
      const org = show ? await getOrg(show.orgId) : null;
      return { show, roles, assignments, org };
    },
  });

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

  const publishMutation = useMutation({
    mutationFn: () => publishCastList(showId),
    onSuccess: () => {
      track("cast_list_published", { showId });
      queryClient.invalidateQueries({ queryKey: ["castList", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Cast list published! Congratulations!");
      setPublishConfirmOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishCastList(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["castList", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("info", "Cast list unpublished. Sent offers reverted to draft.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.show) return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <EmptyState
        icon={<Warning className="w-12 h-12" weight="duotone" />}
        title="Unable to load cast list"
        description="Something went wrong. Please try again."
        action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
      />
    </div>
  );

  const { show, roles, assignments, org } = data;

  // Only show sent/accepted assignments (published) or draft
  const activeAssignments = assignments.filter((a) => a.status !== "withdrawn");
  const isPublished = show.status === "cast" && activeAssignments.some((a) => a.status === "sent" || a.status === "accepted" || a.status === "declined");
  const allAccepted =
    activeAssignments.length > 0 &&
    activeAssignments.every((a) => a.status === "accepted");
  const acceptedCount = activeAssignments.filter((a) => a.status === "accepted").length;
  const totalActiveCount = activeAssignments.length;

  const panelActorAssignments = selectedPanelActorId
    ? activeAssignments.filter((a) => a.actorId === selectedPanelActorId)
    : [];

  // Share helpers
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("success", "Link copied!");
    } catch {
      toast("error", "Could not copy link.");
    }
  };
  const handleEmailShare = () => {
    const subject = `Cast List — ${show.title}`;
    const body = `Congratulations to the cast of ${show.title}!\n\nView the full cast list: ${shareUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const handlePrint = () => window.print();

  // Group assignments by role
  const assignmentsByRole: Record<string, CastAssignment[]> = {};
  activeAssignments.forEach((a) => {
    if (!assignmentsByRole[a.roleId]) assignmentsByRole[a.roleId] = [];
    assignmentsByRole[a.roleId].push(a);
  });

  // Draft state — no assignments or show not in cast status
  if (!isPublished && activeAssignments.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <EmptyState
          icon={<Confetti className="w-12 h-12" weight="duotone" />}
          title="Cast list not published yet"
          description="Finalize your casting decisions on the Casting Board, then publish the cast list."
          action={
            <Button onClick={() => router.push(`/shows/${showId}/casting`)}>
              Go to Casting Board
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      {isPublished ? (
        <div className="text-center mb-8 animate-fade-up rounded-2xl bg-stage-100 px-6 py-10">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-stage-500" weight="duotone" />
          <h1 className="text-5xl font-display text-curtain-900 mb-2">{show.title}</h1>
          <p className="text-base text-curtain-700 font-display mb-3">
            Congratulations to the cast of {show.title}!
          </p>
          {show.authorInfo && (
            <p className="text-sm text-clay-500 mb-1">{show.authorInfo}</p>
          )}
          <p className="text-sm text-clay-600">
            {show.orgName}
            {show.season && ` · ${show.season}`}
          </p>
          {(show.showOpen || show.showClose) && (
            <p className="text-xs text-clay-500 mt-2">
              {show.showOpen && formatDate(show.showOpen)}
              {show.showOpen && show.showClose && " – "}
              {show.showClose && formatDate(show.showClose)}
            </p>
          )}
          <div className="flex justify-center items-center gap-2 mt-5 print:hidden flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              icon={<LinkIcon className="w-4 h-4" weight="duotone" />}
            >
              Copy Link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEmailShare}
              icon={<Envelope className="w-4 h-4" weight="duotone" />}
            >
              Email
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4" weight="duotone" />}
            >
              Print
            </Button>
          </div>
          {org?.websiteUrl && (
            <div className="mt-3 print:hidden">
              <a
                href={org.websiteUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-xs text-curtain-700 hover:text-curtain-900 underline"
              >
                Visit {show.orgName}&apos;s website
                <ArrowSquareOut className="w-3.5 h-3.5" weight="duotone" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center mb-8 animate-fade-up">
          <h1 className="text-4xl font-display text-curtain-900 mb-2">{show.title}</h1>
          {show.authorInfo && (
            <p className="text-sm text-clay-500 mb-1">{show.authorInfo}</p>
          )}
          <p className="text-sm text-clay-500">
            {show.orgName}
            {show.season && ` · ${show.season}`}
          </p>
          {(show.showOpen || show.showClose) && (
            <p className="text-xs text-clay-400 mt-2">
              {show.showOpen && formatDate(show.showOpen)}
              {show.showOpen && show.showClose && " – "}
              {show.showClose && formatDate(show.showClose)}
            </p>
          )}
          <div className="flex justify-center items-center gap-3 mt-3 flex-wrap">
            <Badge variant="warning" size="md">Draft</Badge>
            {totalActiveCount > 0 && (
              <span className="text-xs text-clay-500">
                {acceptedCount} of {totalActiveCount} role{totalActiveCount !== 1 ? "s" : ""} confirmed
              </span>
            )}
            {activeAssignments.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (!allAccepted) {
                    toast(
                      "error",
                      "All cast assignments must be accepted before publishing."
                    );
                    return;
                  }
                  setPublishConfirmOpen(true);
                }}
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
            )}
          </div>
        </div>
      )}

      <hr className="gold-line" />

      {/* ── Cast List ── */}
      <div className="flex flex-col gap-0 mt-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
        {roles?.map((role) => {
          const roleAssignments = assignmentsByRole[role.id] ?? [];
          if (roleAssignments.length === 0) return null;

          // Sort: primary first, then alternate, then understudy
          const sorted = [...roleAssignments].sort((a, b) => {
            const order: Record<AssignmentType, number> = { primary: 0, alternate: 1, understudy: 2 };
            return (order[a.assignmentType] ?? 3) - (order[b.assignmentType] ?? 3);
          });

          return (
            <div key={role.id} className="py-4 border-b border-cream-100 last:border-0">
              {sorted.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-display text-curtain-900 w-40">
                      {assignment.assignmentType === "primary" ? role.name : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => openActorPanel(assignment.actorId, showId)}
                      className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer print:cursor-auto print:hover:opacity-100"
                    >
                      <Avatar name={assignment.actorName} size="sm" />
                      <span className="text-sm font-semibold text-curtain-800 hover:text-curtain-900">
                        {assignment.actorName}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment.assignmentType !== "primary" && (
                      <span className="text-xs text-clay-400 italic">
                        {ASSIGNMENT_LABEL[assignment.assignmentType]}
                      </span>
                    )}
                    {assignment.status === "accepted" && (
                      <Badge variant="success" size="sm">Accepted</Badge>
                    )}
                    {assignment.status === "declined" && (
                      <Badge variant="danger" size="sm">Declined</Badge>
                    )}
                    {assignment.status === "sent" && (
                      <Badge variant="warning" size="sm">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Publish Confirmation ── */}
      <Modal open={publishConfirmOpen} onClose={() => setPublishConfirmOpen(false)} title="Publish Cast List">
        <div className="flex flex-col items-center text-center py-4">
          <Megaphone className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-2">
            Publish the cast list for <strong>{show.title}</strong>?
          </p>
          <p className="text-xs text-clay-500 mb-6">
            This will notify all actors of their casting decisions.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setPublishConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => publishMutation.mutate()}
              loading={publishMutation.isPending}
              icon={<Megaphone className="w-4 h-4" weight="bold" />}
              disabled={!allAccepted}
            >
              Publish
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Unpublish Confirmation ── */}
      <Modal open={unpublishConfirmOpen} onClose={() => setUnpublishConfirmOpen(false)} title="Unpublish Cast List">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-ruby-400 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-4">
            Unpublish the cast list? Actors have already been notified. This will revert the show to the Casting phase.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setUnpublishConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { unpublishMutation.mutate(); setUnpublishConfirmOpen(false); }} loading={unpublishMutation.isPending}>
              Unpublish
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Footer Actions ── */}
      <div className="mt-8 flex justify-center animate-fade-up" style={{ animationDelay: "200ms" }}>
        {isPublished && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUnpublishConfirmOpen(true)}
          >
            Unpublish Cast List
          </Button>
        )}
        {!isPublished && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/shows/${showId}/casting`)}
            icon={<ArrowLeft className="w-4 h-4" weight="bold" />}
          >
            Back to Casting Board
          </Button>
        )}
      </div>

      {/* ── Actor Slide Panel ── */}
      <SlidePanel open={panel.type === "actor"} onClose={closePanel}>
        {selectedActor && (
          <div className="flex flex-col gap-6">
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
    </div>
  );
}
