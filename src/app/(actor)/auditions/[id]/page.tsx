"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  getShow,
  getShowRoles,
  getShowTeam,
  getAuditionGroups,
  getSlotAvailability,
  getActorSignup,
  getActorCallbacks,
  getActorCastAssignments,
  signUpForAudition,
  withdrawSignup,
  acceptCallback,
  declineCallback,
} from "@/lib/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  Card,
  Badge,
  Button,
  Pill,
  Avatar,
  PageSkeleton,
  DateBlock,
  SectionHeader,
} from "@/components/ui";
import { formatDate, formatTime, formatTeamRole } from "@/lib/utils";
import {
  Calendar,
  MapPin,
  MusicNotes,
  Clock,
  ArrowLeft,
  CheckCircle,
  Phone,
  Envelope,
  Buildings,
  ShareNetwork,
  BookmarkSimple,
  CalendarPlus,
  CaretDown,
  CaretUp,
  Megaphone,
  NoteBlank,
  Warning,
  Trophy,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { ShowRole, Callback, CastAssignment } from "@/types";
import {
  AuditionSignupModal,
  type SignupFormData,
} from "@/components/auditions/AuditionSignupModal";

/* ============================================================
   Phase logic — what stage is this actor at for this show?
   ============================================================ */

type ActorPhase = "browsing" | "signed-up" | "callback-pending" | "callback-confirmed" | "cast-offered" | "cast-accepted";

function determinePhase(
  isSignedUp: boolean,
  callbacks: Callback[],
  castAssignments: CastAssignment[]
): ActorPhase {
  // Cast supersedes everything
  const acceptedOffers = castAssignments.filter((a) => a.status === "accepted");
  const sentOffers = castAssignments.filter((a) => a.status === "sent");
  if (acceptedOffers.length > 0) return "cast-accepted";
  if (sentOffers.length > 0) return "cast-offered";
  if (!isSignedUp) return "browsing";
  const pending = callbacks.filter((c) => c.status === "pending");
  const accepted = callbacks.filter((c) => c.status === "accepted");
  if (pending.length > 0) return "callback-pending";
  if (accepted.length > 0) return "callback-confirmed";
  return "signed-up";
}

/* ============================================================
   Page
   ============================================================ */

export default function AuditionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data: show, isLoading: showLoading } = useQuery({
    queryKey: ["show", id],
    queryFn: () => getShow(id),
  });

  const { data: roles } = useQuery({
    queryKey: ["showRoles", id],
    queryFn: () => getShowRoles(id),
    enabled: !!show,
  });

  const { data: team } = useQuery({
    queryKey: ["showTeam", id],
    queryFn: () => getShowTeam(id),
    enabled: !!show,
  });

  const { data: groups } = useQuery({
    queryKey: ["auditionGroups", id],
    queryFn: () => getAuditionGroups(id),
    enabled: !!show,
  });

  const { data: slotAvailability } = useQuery({
    queryKey: ["slotAvailability", id],
    queryFn: () => getSlotAvailability(id),
    enabled: !!show,
  });

  const { data: existingSignup } = useQuery({
    queryKey: ["actorSignup", id, user?.id],
    queryFn: () => getActorSignup(id, user?.id ?? ""),
    enabled: !!user && !!show,
  });

  // Fetch actor's callbacks for THIS show
  const { data: allActorCallbacks } = useQuery({
    queryKey: ["actorCallbacks", user?.id],
    queryFn: () => getActorCallbacks(user!.id),
    enabled: !!user && !!show,
  });

  const showCallbacks = allActorCallbacks?.filter((c) => c.showId === id) ?? [];
  const pendingCallbacks = showCallbacks.filter((c) => c.status === "pending");
  const acceptedCallbacks = showCallbacks.filter((c) => c.status === "accepted");

  // Fetch actor's cast assignments
  const { data: allCastAssignments } = useQuery({
    queryKey: ["actorCastAssignments", user?.id],
    queryFn: () => getActorCastAssignments(user!.id),
    enabled: !!user && !!show,
  });
  const showCastAssignments = allCastAssignments?.filter((a) => a.showId === id) ?? [];
  const sentOffers = showCastAssignments.filter((a) => a.status === "sent");
  const acceptedOffers = showCastAssignments.filter((a) => a.status === "accepted");

  const signupMutation = useMutation({
    mutationFn: (data: SignupFormData) =>
      signUpForAudition({
        showId: id,
        actorId: user!.id,
        actorName: user!.displayName,
        groupId: data.groupId,
        rolesInterested: data.rolesInterested,
        openToOther: data.openToOther,
        willCrew: data.willCrew,
        conflicts: data.conflicts
          .map((c) =>
            c.startDate === c.endDate
              ? c.startDate
              : `${c.startDate} to ${c.endDate}`
          )
          .join(", "),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actorSignup", id] });
      queryClient.invalidateQueries({ queryKey: ["slotAvailability", id] });
      toast("success", "You're signed up! Break a leg.");
      setShowModal(false);
    },
    onError: (err: Error) => {
      toast("error", err.message);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawSignup(id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actorSignup", id] });
      queryClient.invalidateQueries({ queryKey: ["slotAvailability", id] });
      toast("info", "Signup withdrawn.");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (callbackId: string) => acceptCallback(callbackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actorCallbacks"] });
      queryClient.invalidateQueries({ queryKey: ["my-shows"] });
      toast("success", "Callback accepted!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const declineMutation = useMutation({
    mutationFn: (callbackId: string) => declineCallback(callbackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actorCallbacks"] });
      queryClient.invalidateQueries({ queryKey: ["my-shows"] });
      toast("info", "Callback declined.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (showLoading || !show) return <PageSkeleton />;

  const isSignedUp = !!existingSignup;
  const phase = determinePhase(isSignedUp, showCallbacks, showCastAssignments);

  const roleMap: Record<string, string> =
    roles?.reduce(
      (acc, r) => ({ ...acc, [r.id]: r.name }),
      {} as Record<string, string>
    ) ?? {};

  const stageManager = team?.find((t) => t.role === "stage_manager");

  // Find the group the actor signed up for
  const signedUpGroup =
    isSignedUp && existingSignup.groupId
      ? groups?.find((g) => g.id === existingSignup.groupId)
      : null;

  // Status badge for the show header
  const statusBadge = (() => {
    switch (phase) {
      case "cast-accepted":
        return <Badge variant="success" size="md">Cast</Badge>;
      case "cast-offered":
        return <Badge variant="warning" size="md">Offer Received</Badge>;
      case "callback-confirmed":
        return <Badge variant="success" size="md">Callbacks Confirmed</Badge>;
      case "callback-pending":
        return <Badge variant="warning" size="md">Callback Received</Badge>;
      case "signed-up":
        return <Badge variant="success" size="md">Signed Up</Badge>;
      default:
        return <Badge variant="success" size="md">Auditions Open</Badge>;
    }
  })();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href={phase === "browsing" ? "/discover" : "/my-shows"}
        className="inline-flex items-center gap-1.5 text-sm text-curtain-600 hover:text-curtain-900 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" weight="bold" />
        {phase === "browsing" ? "Back to auditions" : "Back to My Shows"}
      </Link>

      {/* Show header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-display text-curtain-900">
            {show.title}
          </h1>
          {statusBadge}
        </div>
        <p className="inline-flex items-center gap-1.5 text-sm text-curtain-600">
          <Buildings className="w-4 h-4 text-stage-500" weight="duotone" />
          {show.orgName}
        </p>
        {show.authorInfo && (
          <p className="text-xs text-clay-400 mt-1">{show.authorInfo}</p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => toast("info", "Coming soon!")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition">
          <BookmarkSimple className="w-4 h-4" weight="bold" />
          Save
        </button>
        <button onClick={() => toast("info", "Coming soon!")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition">
          <ShareNetwork className="w-4 h-4" weight="bold" />
          Share
        </button>
        {isSignedUp && (
          <button onClick={() => toast("info", "Coming soon!")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition">
            <CalendarPlus className="w-4 h-4" weight="bold" />
            Add to Calendar
          </button>
        )}
      </div>

      {/* ============================================================
         CAST ACCEPTED — congratulations!
         ============================================================ */}
      {phase === "cast-accepted" && (
        <>
          <Card variant="highlighted" className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Trophy
                className="w-8 h-8 text-stage-500 flex-shrink-0 mt-0.5"
                weight="duotone"
              />
              <div className="flex-1">
                <p className="text-lg font-display text-curtain-900">
                  Congratulations!
                </p>
                <p className="text-xs text-clay-500 mt-0.5">
                  {acceptedOffers.length === 1
                    ? `You've accepted the role of ${acceptedOffers[0].roleName}`
                    : `You've been cast in ${acceptedOffers.length} roles`}
                </p>
              </div>
              <CheckCircle className="w-6 h-6 text-forest-500" weight="fill" />
            </div>

            {/* Roles accepted */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {acceptedOffers.map((a) => (
                <Pill key={a.id} variant="endorsement" className="cursor-default">
                  {a.roleName}
                  {a.assignmentType !== "primary" && (
                    <span className="text-clay-400 ml-1">
                      ({a.assignmentType})
                    </span>
                  )}
                </Pill>
              ))}
            </div>

            {/* Production dates */}
            {(show.rehearsalStart || show.showOpen) && (
              <div className="mt-4 p-3 bg-cream-50 rounded-xl">
                <p className="text-[10px] font-semibold text-curtain-700 tracking-wide uppercase mb-2">
                  What&apos;s Next
                </p>
                {show.rehearsalStart && (
                  <p className="text-sm text-curtain-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                    Rehearsals begin {formatDate(show.rehearsalStart)}
                  </p>
                )}
                {show.showOpen && (
                  <p className="text-sm text-curtain-800 flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                    Show opens {formatDate(show.showOpen)}
                    {show.showClose && ` – ${formatDate(show.showClose)}`}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Contact */}
          <ContactBlock
            show={show}
            stageManager={stageManager}
            phase={phase}
          />

          {/* Collapsible full show details */}
          <ToggleShowDetails
            showDetails={showDetails}
            onToggle={() => setShowDetails(!showDetails)}
          />
          {showDetails && (
            <div className="animate-fade-up">
              <EventInfoBlocks show={show} />
              <RolesList roles={roles} />
            </div>
          )}
        </>
      )}

      {/* ============================================================
         CAST OFFERED — link to dedicated offer page
         ============================================================ */}
      {phase === "cast-offered" && (
        <>
          {sentOffers.map((offer) => (
            <Link key={offer.id} href={`/offers/${offer.id}`}>
              <Card variant="highlighted" className="mb-4" interactive>
                <div className="flex items-start gap-3">
                  <Trophy
                    className="w-8 h-8 text-stage-500 flex-shrink-0 mt-0.5"
                    weight="duotone"
                  />
                  <div className="flex-1">
                    <p className="text-lg font-display text-curtain-900">
                      You&apos;ve Been Cast!
                    </p>
                    <p className="text-xs text-clay-500 mt-0.5">
                      {offer.roleName}
                      {offer.assignmentType !== "primary" && ` (${offer.assignmentType})`}
                    </p>
                    <p className="text-xs text-curtain-600 mt-2 font-medium">
                      View offer &amp; accept →
                    </p>
                  </div>
                  <Badge variant="warning" size="sm">
                    Action Needed
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}

          {/* Show any already-accepted offers too */}
          {acceptedOffers.length > 0 && (
            <Card variant="flat" className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-forest-500" weight="fill" />
                <p className="text-sm font-semibold text-curtain-900">
                  Already Accepted
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {acceptedOffers.map((a) => (
                  <Pill key={a.id} variant="endorsement" className="cursor-default">
                    {a.roleName}
                  </Pill>
                ))}
              </div>
            </Card>
          )}

          {/* Audition recap */}
          {existingSignup && (
            <AuditionRecapCollapsible
              existingSignup={existingSignup}
              signedUpGroup={signedUpGroup}
              show={show}
              roleMap={roleMap}
            />
          )}

          {/* Contact */}
          <ContactBlock
            show={show}
            stageManager={stageManager}
            phase={phase}
          />

          {/* Collapsible full show details */}
          <ToggleShowDetails
            showDetails={showDetails}
            onToggle={() => setShowDetails(!showDetails)}
          />
          {showDetails && (
            <div className="animate-fade-up">
              <EventInfoBlocks show={show} />
              <RolesList roles={roles} />
            </div>
          )}
        </>
      )}

      {/* ============================================================
         CALLBACK CONFIRMED — the big moment
         ============================================================ */}
      {phase === "callback-confirmed" && (
        <>
          <Card variant="highlighted" className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Megaphone
                className="w-8 h-8 text-stage-500 flex-shrink-0 mt-0.5"
                weight="duotone"
              />
              <div className="flex-1">
                <p className="text-lg font-display text-curtain-900">
                  You&apos;ve been called back!
                </p>
                <p className="text-xs text-clay-500 mt-0.5">
                  {acceptedCallbacks.length === 1
                    ? `For the role of ${acceptedCallbacks[0].roleName}`
                    : `For ${acceptedCallbacks.length} roles`}
                </p>
              </div>
            </div>

            {/* Callback details — the stuff an actor actually needs */}
            <CallbackDetailBlock show={show} />

            {/* Role pills */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {acceptedCallbacks.map((cb) => (
                <Pill key={cb.id} variant="endorsement" className="cursor-default">
                  {cb.roleName}
                </Pill>
              ))}
            </div>

            {/* Prep notes */}
            {(acceptedCallbacks.some((cb) => cb.prepNotes) || show.callbackNotes) && (
              <div className="mt-4 p-3 bg-cream-50 rounded-xl">
                <p className="text-[10px] font-semibold text-curtain-700 tracking-wide uppercase mb-2">
                  What to Prepare
                </p>
                {acceptedCallbacks
                  .filter((cb) => cb.prepNotes)
                  .map((cb) => (
                    <p key={cb.id} className="text-sm text-curtain-800 leading-relaxed flex items-start gap-2">
                      <NoteBlank className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                      <span>
                        <span className="font-semibold">{cb.roleName}:</span>{" "}
                        {cb.prepNotes}
                      </span>
                    </p>
                  ))}
                {show.callbackNotes && (
                  <p className="text-sm text-curtain-800 leading-relaxed flex items-start gap-2 mt-1">
                    <NoteBlank className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                    {show.callbackNotes}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Audition recap — collapsed, you've passed this stage */}
          <AuditionRecapCollapsible
            existingSignup={existingSignup!}
            signedUpGroup={signedUpGroup}
            show={show}
            roleMap={roleMap}
          />

          {/* Contact */}
          <ContactBlock
            show={show}
            stageManager={stageManager}
            phase={phase}
          />

          {/* Collapsible full show details */}
          <ToggleShowDetails
            showDetails={showDetails}
            onToggle={() => setShowDetails(!showDetails)}
          />
          {showDetails && (
            <div className="animate-fade-up">
              <EventInfoBlocks show={show} />
              <RolesList roles={roles} />
            </div>
          )}
        </>
      )}

      {/* ============================================================
         CALLBACK PENDING — action needed
         ============================================================ */}
      {phase === "callback-pending" && (
        <>
          {pendingCallbacks.map((cb) => (
            <Card key={cb.id} variant="highlighted" className="mb-4">
              <div className="flex items-start gap-3 mb-4">
                <Warning
                  className="w-8 h-8 text-stage-500 flex-shrink-0 mt-0.5"
                  weight="duotone"
                />
                <div className="flex-1">
                  <p className="text-lg font-display text-curtain-900">
                    Callback: {cb.roleName}
                  </p>
                  <p className="text-xs text-clay-500 mt-0.5">
                    Respond to confirm your spot
                  </p>
                </div>
                <Badge variant="warning" size="sm">
                  Action Needed
                </Badge>
              </div>

              {/* Full callback details */}
              <CallbackDetailBlock show={show} />

              {/* Prep notes for this role */}
              {(cb.prepNotes || show.callbackNotes) && (
                <div className="mt-4 p-3 bg-cream-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-curtain-700 tracking-wide uppercase mb-2">
                    What to Prepare
                  </p>
                  {cb.prepNotes && (
                    <p className="text-sm text-curtain-800 leading-relaxed flex items-start gap-2">
                      <NoteBlank className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                      {cb.prepNotes}
                    </p>
                  )}
                  {show.callbackNotes && (
                    <p className="text-sm text-curtain-800 leading-relaxed flex items-start gap-2 mt-1">
                      <NoteBlank className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                      {show.callbackNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Accept / Decline */}
              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => acceptMutation.mutate(cb.id)}
                  loading={
                    acceptMutation.isPending &&
                    (acceptMutation.variables as string) === cb.id
                  }
                >
                  Accept Callback
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => declineMutation.mutate(cb.id)}
                  loading={
                    declineMutation.isPending &&
                    (declineMutation.variables as string) === cb.id
                  }
                >
                  Decline
                </Button>
              </div>
            </Card>
          ))}

          {/* Show any already-accepted callbacks too */}
          {acceptedCallbacks.length > 0 && (
            <Card variant="flat" className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-forest-500" weight="fill" />
                <p className="text-sm font-semibold text-curtain-900">
                  Already Confirmed
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {acceptedCallbacks.map((cb) => (
                  <Pill key={cb.id} variant="endorsement" className="cursor-default">
                    {cb.roleName}
                  </Pill>
                ))}
              </div>
            </Card>
          )}

          {/* Audition recap */}
          <AuditionRecapCollapsible
            existingSignup={existingSignup!}
            signedUpGroup={signedUpGroup}
            show={show}
            roleMap={roleMap}
          />

          {/* Contact */}
          <ContactBlock
            show={show}
            stageManager={stageManager}
            phase={phase}
          />

          {/* Collapsible full show details */}
          <ToggleShowDetails
            showDetails={showDetails}
            onToggle={() => setShowDetails(!showDetails)}
          />
          {showDetails && (
            <div className="animate-fade-up">
              <EventInfoBlocks show={show} />
              <RolesList roles={roles} />
            </div>
          )}
        </>
      )}

      {/* ============================================================
         SIGNED UP — no callbacks yet
         ============================================================ */}
      {phase === "signed-up" && (
        <>
          <Card variant="highlighted" className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle
                className="w-8 h-8 text-forest-600 flex-shrink-0 mt-0.5"
                weight="duotone"
              />
              <div className="flex-1">
                <p className="text-lg font-display text-curtain-900">
                  You&apos;re signed up!
                </p>
                <p className="text-xs text-clay-500 mt-0.5">
                  Interested in:{" "}
                  {existingSignup!.rolesInterested
                    .map((rid) => roleMap[rid] ?? "Role")
                    .join(", ")}
                  {existingSignup!.openToOther && " + open to other roles"}
                </p>
              </div>
            </div>

            {signedUpGroup && (
              <div className="bg-white rounded-xl border border-cream-200 p-4 mb-4">
                <div className="flex items-center gap-4">
                  <DateBlock date={signedUpGroup.startTime} />
                  <div>
                    <p className="text-sm font-semibold text-curtain-900">
                      {new Date(signedUpGroup.startTime).toLocaleDateString(
                        "en-US",
                        { weekday: "long", month: "long", day: "numeric" }
                      )}
                    </p>
                    <p className="text-sm text-curtain-700 flex items-center gap-1.5 mt-0.5">
                      <Clock
                        className="w-4 h-4 text-stage-500"
                        weight="duotone"
                      />
                      {formatTime(signedUpGroup.startTime)}
                      {" – "}
                      {formatTime(signedUpGroup.endTime)}
                    </p>
                    <p className="text-sm text-curtain-700 flex items-center gap-1.5 mt-0.5">
                      <MapPin
                        className="w-4 h-4 text-stage-500"
                        weight="duotone"
                      />
                      {show.auditionLocation ?? "TBD"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {existingSignup!.conflicts && (
              <p className="text-xs text-stage-600 mb-3">
                Conflicts noted: {existingSignup!.conflicts}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to withdraw? This cannot be undone."
                    )
                  ) {
                    withdrawMutation.mutate();
                  }
                }}
                loading={withdrawMutation.isPending}
              >
                Withdraw
              </Button>
            </div>
          </Card>

          {show.auditionNotes && (
            <Card variant="sunken" className="mb-6">
              <SectionHeader>What to Prepare</SectionHeader>
              <p className="text-sm text-curtain-800 leading-relaxed">
                {show.auditionNotes}
              </p>
            </Card>
          )}

          <ContactBlock
            show={show}
            stageManager={stageManager}
            phase={phase}
          />

          <ToggleShowDetails
            showDetails={showDetails}
            onToggle={() => setShowDetails(!showDetails)}
          />
          {showDetails && (
            <div className="animate-fade-up">
              <EventInfoBlocks show={show} />
              <RolesList roles={roles} />
            </div>
          )}
        </>
      )}

      {/* ============================================================
         BROWSING — not signed up
         ============================================================ */}
      {phase === "browsing" && (
        <>
          <EventInfoBlocks show={show} />

          {show.auditionNotes && (
            <Card variant="sunken" className="mb-8">
              <SectionHeader>Audition Instructions</SectionHeader>
              <p className="text-sm text-curtain-800 leading-relaxed">
                {show.auditionNotes}
              </p>
            </Card>
          )}

          <RolesList roles={roles} />

          <ContactBlock
            show={show}
            stageManager={stageManager}
            phase={phase}
          />
        </>
      )}

      {/* Sign Up modal */}
      {roles && groups && slotAvailability && (
        <AuditionSignupModal
          open={showModal}
          onClose={() => setShowModal(false)}
          roles={roles}
          groups={groups}
          slotAvailability={slotAvailability}
          showTitle={show.title}
          orgName={show.orgName}
          rehearsalStart={show.rehearsalStart ?? undefined}
          showClose={show.showClose ?? undefined}
          onSubmit={(data) => signupMutation.mutate(data)}
          isSubmitting={signupMutation.isPending}
        />
      )}

      {/* Sticky CTA (pre-signup only) */}
      {phase === "browsing" && (
        <div className="sticky bottom-0 bg-cream-50/95 backdrop-blur-sm py-4 -mx-6 px-6 border-t border-cream-200">
          <Button
            size="lg"
            className="w-full"
            onClick={() => setShowModal(true)}
          >
            Sign Up to Audition
          </Button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Callback Detail Block — date, time, location, contact
   Reused in both pending and confirmed states
   ============================================================ */

function CallbackDetailBlock({
  show,
}: {
  show: NonNullable<Awaited<ReturnType<typeof getShow>>>;
}) {
  if (!show.callbackDate) return null;

  return (
    <div className="bg-white rounded-xl border border-cream-200 p-4">
      <div className="flex items-center gap-4">
        <DateBlock date={show.callbackDate} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-curtain-900">
            {new Date(show.callbackDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          {show.callbackStartTime && (
            <p className="text-sm text-curtain-700 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-4 h-4 text-stage-500" weight="duotone" />
              {formatTime(show.callbackStartTime)}
              {show.callbackEndTime &&
                ` – ${formatTime(show.callbackEndTime)}`}
            </p>
          )}
          {show.callbackLocation && (
            <p className="text-sm text-curtain-700 flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-4 h-4 text-stage-500" weight="duotone" />
              <span className="truncate">{show.callbackLocation}</span>
            </p>
          )}
          {show.callbackContactName && (
            <p className="text-sm text-curtain-700 flex items-center gap-1.5 mt-0.5">
              <Phone className="w-4 h-4 text-stage-500" weight="duotone" />
              {show.callbackContactName}
              {show.callbackContactPhone &&
                ` · ${show.callbackContactPhone}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Audition Recap — collapsible summary of the audition step
   Shown once the actor advances past audition phase
   ============================================================ */

function AuditionRecapCollapsible({
  existingSignup,
  signedUpGroup,
  show,
  roleMap,
}: {
  existingSignup: NonNullable<
    Awaited<ReturnType<typeof getActorSignup>>
  >;
  signedUpGroup: import("@/types").AuditionGroup | null | undefined;
  show: NonNullable<Awaited<ReturnType<typeof getShow>>>;
  roleMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-curtain-600 hover:text-curtain-900 transition mb-2"
      >
        {open ? (
          <CaretUp className="w-4 h-4" weight="bold" />
        ) : (
          <CaretDown className="w-4 h-4" weight="bold" />
        )}
        <CheckCircle className="w-4 h-4 text-forest-500" weight="fill" />
        Audition completed
        {signedUpGroup && (
          <span className="text-clay-400 font-normal">
            · {formatDate(signedUpGroup.startTime)}
          </span>
        )}
      </button>

      {open && (
        <Card variant="flat" className="animate-fade-up">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-xs text-clay-500 mb-1">
                Interested in:{" "}
                {existingSignup.rolesInterested
                  .map((rid) => roleMap[rid] ?? "Role")
                  .join(", ")}
                {existingSignup.openToOther && " + open to other roles"}
              </p>
              {signedUpGroup && (
                <>
                  <p className="text-xs text-curtain-700 flex items-center gap-1.5">
                    <Calendar
                      className="w-3.5 h-3.5 text-stage-500"
                      weight="duotone"
                    />
                    {formatDate(signedUpGroup.startTime)} ·{" "}
                    {formatTime(signedUpGroup.startTime)} –{" "}
                    {formatTime(signedUpGroup.endTime)}
                  </p>
                  {show.auditionLocation && (
                    <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-0.5">
                      <MapPin
                        className="w-3.5 h-3.5 text-stage-500"
                        weight="duotone"
                      />
                      {show.auditionLocation}
                    </p>
                  )}
                </>
              )}
              {existingSignup.conflicts && (
                <p className="text-xs text-stage-600 mt-1">
                  Conflicts noted: {existingSignup.conflicts}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   Contact Block — SM or callback contact depending on phase
   ============================================================ */

function ContactBlock({
  show,
  stageManager,
  phase,
}: {
  show: NonNullable<Awaited<ReturnType<typeof getShow>>>;
  stageManager:
    | NonNullable<Awaited<ReturnType<typeof getShowTeam>>>[number]
    | undefined;
  phase: ActorPhase;
}) {
  // In callback/cast phases, show callback contact if available, plus SM
  const isPostAudition = phase === "callback-pending" || phase === "callback-confirmed" || phase === "cast-offered" || phase === "cast-accepted";
  const showCallbackContact = isPostAudition && show.callbackContactName;

  return (
    <Card variant="flat" className="mb-6">
      <SectionHeader>
        {phase === "cast-offered" || phase === "cast-accepted"
          ? "Questions About Your Role?"
          : isPostAudition
            ? "Questions About Your Callback?"
            : "Questions or Last-Minute Issues?"}
      </SectionHeader>

      {showCallbackContact && (
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={show.callbackContactName ?? ""} size="md" />
          <div className="flex-1">
            <p className="text-sm font-medium text-curtain-900">
              {show.callbackContactName}
            </p>
            {show.callbackContactPhone && (
              <p className="text-xs text-clay-500">
                {show.callbackContactPhone}
              </p>
            )}
          </div>
          {show.callbackContactPhone && (
            <a
              href={`tel:${show.callbackContactPhone.replace(/\D/g, "")}`}
              className="p-2.5 rounded-xl bg-white border border-cream-200 text-stage-600 hover:bg-cream-50 transition"
              title="Call"
            >
              <Phone className="w-5 h-5" weight="duotone" />
            </a>
          )}
        </div>
      )}

      {showCallbackContact && stageManager && (
        <hr className="border-cream-200 my-3" />
      )}

      {stageManager && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-curtain-100 flex items-center justify-center">
            <span className="text-sm font-bold text-curtain-700">
              {stageManager.userName
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-curtain-900">
              {stageManager.userName}
            </p>
            <p className="text-xs text-clay-400">
              {formatTeamRole(stageManager.role)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stageManager.email && (
              <a
                href={`mailto:${stageManager.email}`}
                className="p-2.5 rounded-xl bg-white border border-cream-200 text-stage-600 hover:bg-cream-50 transition"
                title={`Email ${stageManager.userName}`}
              >
                <Envelope className="w-5 h-5" weight="duotone" />
              </a>
            )}
            {stageManager.phone && (
              <a
                href={`tel:${stageManager.phone.replace(/\D/g, "")}`}
                className="p-2.5 rounded-xl bg-white border border-cream-200 text-stage-600 hover:bg-cream-50 transition"
                title={`Call ${stageManager.userName}`}
              >
                <Phone className="w-5 h-5" weight="duotone" />
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   Toggle Show Details button
   ============================================================ */

function ToggleShowDetails({
  showDetails,
  onToggle,
}: {
  showDetails: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-sm font-medium text-curtain-600 hover:text-curtain-900 transition mb-4"
    >
      {showDetails ? (
        <CaretUp className="w-4 h-4" weight="bold" />
      ) : (
        <CaretDown className="w-4 h-4" weight="bold" />
      )}
      {showDetails ? "Hide" : "Show"} full audition details
    </button>
  );
}

/* ============================================================
   Event info blocks — grouped by event type
   ============================================================ */

function EventInfoBlocks({
  show,
}: {
  show: NonNullable<Awaited<ReturnType<typeof getShow>>>;
}) {
  return (
    <div className="space-y-4 mb-8">
      {/* Auditions */}
      <Card padding="compact" variant="flat">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
          <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase">
            Auditions
          </h4>
        </div>
        <div className="pl-6 space-y-1">
          <p className="text-sm font-semibold text-curtain-900">
            {formatDate(show.auditionStart)}
            {show.auditionEnd && show.auditionEnd !== show.auditionStart
              ? ` – ${formatDate(show.auditionEnd)}`
              : ""}
          </p>
          {show.auditionLocation && (
            <p className="text-sm text-clay-500 flex items-center gap-1.5">
              <MapPin
                className="w-3.5 h-3.5 text-stage-500"
                weight="duotone"
              />
              {show.auditionLocation}
            </p>
          )}
        </div>
      </Card>

      {/* Callbacks */}
      {show.callbackDate && (
        <Card padding="compact" variant="flat">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-stage-500" weight="duotone" />
            <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase">
              Callbacks
            </h4>
          </div>
          <div className="pl-6 space-y-1">
            <p className="text-sm font-semibold text-curtain-900">
              {formatDate(show.callbackDate)}
              {show.callbackStartTime && (
                <>
                  {" · "}
                  {formatTime(show.callbackStartTime)}
                  {show.callbackEndTime &&
                    ` – ${formatTime(show.callbackEndTime)}`}
                </>
              )}
            </p>
            {show.callbackLocation && (
              <p className="text-sm text-clay-500 flex items-center gap-1.5">
                <MapPin
                  className="w-3.5 h-3.5 text-stage-500"
                  weight="duotone"
                />
                {show.callbackLocation}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Performances */}
      {show.showOpen && (
        <Card padding="compact" variant="flat">
          <div className="flex items-center gap-2 mb-2">
            <MusicNotes className="w-4 h-4 text-stage-500" weight="duotone" />
            <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase">
              Performances
            </h4>
          </div>
          <div className="pl-6 space-y-1">
            <p className="text-sm font-semibold text-curtain-900">
              {formatDate(show.showOpen)} – {formatDate(show.showClose)}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   Roles list
   ============================================================ */

function RolesList({ roles }: { roles: ShowRole[] | undefined }) {
  if (!roles || roles.length === 0) return null;

  return (
    <div className="mb-8">
      <SectionHeader>Roles Being Cast</SectionHeader>
      <div className="space-y-3">
        {roles.map((role) => (
          <Card key={role.id} padding="compact" variant="flat">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-curtain-900">
                    {role.name}
                  </span>
                  <Badge
                    variant={role.roleType === "lead" ? "gold" : "default"}
                    size="sm"
                  >
                    {role.roleType.replace("_", " ")}
                  </Badge>
                </div>
                {role.description && (
                  <p className="text-xs text-clay-500 mb-2 max-w-md">
                    {role.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-clay-400">
                  {role.gender && role.gender !== "any" && (
                    <span className="capitalize">{role.gender}</span>
                  )}
                  {role.ageRange && <span>Ages {role.ageRange}</span>}
                  {role.vocalRange && <span>{role.vocalRange}</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
