"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import {
  getActorSignups,
  getActorCallbacks,
  getActorCastAssignments,
  getShow,
  getAuditionGroups,
  getShowRoles,
  getActor,
  acceptCallback,
  declineCallback,
} from "@/lib/api/client";
import {
  Card,
  Badge,
  Button,
  EmptyState,
  PageSkeleton,
  DateBlock,
  Pill,
  VerifiedBadge,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  MaskHappy,
  MapPin,
  CheckCircle,
  Microphone,
  Megaphone,
  Calendar,
  Ticket,
  Star,
  Warning,
  Phone,
  NoteBlank,
  Trophy,
  House,
} from "@phosphor-icons/react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import type {
  Show,
  AuditionGroup,
  ShowRole,
  AuditionSignup,
  Callback,
  CastAssignment,
  ProductionCredit,
} from "@/types";

/* ============================================================
   Types
   ============================================================ */

type ShowJourney = {
  showId: string;
  show: Show | null;
  signup: AuditionSignup | null;
  callbacks: Callback[];
  castAssignments: CastAssignment[];
  group: AuditionGroup | null;
  rolesInterested: string[];
  phase: "audition" | "callback" | "cast" | "past";
};

/* ============================================================
   Page
   ============================================================ */

export default function MyShowsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: actor } = useQuery({
    queryKey: ["actor", user?.id],
    queryFn: () => getActor(user?.id ?? ""),
    enabled: !!user,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["my-shows", user?.id],
    queryFn: async () => {
      const [signups, cbs, castOffers] = await Promise.all([
        getActorSignups(user!.id),
        getActorCallbacks(user!.id),
        getActorCastAssignments(user!.id),
      ]);
      const showIds = [
        ...new Set([
          ...signups.map((s) => s.showId),
          ...cbs.map((c) => c.showId),
          ...castOffers.map((a) => a.showId),
        ]),
      ];
      const [showsList, groupsList, rolesList] = await Promise.all([
        Promise.all(showIds.map((id) => getShow(id))),
        Promise.all(showIds.map((id) => getAuditionGroups(id))),
        Promise.all(showIds.map((id) => getShowRoles(id))),
      ]);
      return {
        signups,
        callbacks: cbs,
        castAssignments: castOffers,
        shows: Object.fromEntries(
          showIds.map((id, i) => [id, showsList[i]])
        ) as Record<string, Show | null>,
        groups: Object.fromEntries(
          showIds.map((id, i) => [id, groupsList[i]])
        ) as Record<string, AuditionGroup[]>,
        roles: Object.fromEntries(
          showIds.map((id, i) => [id, rolesList[i]])
        ) as Record<string, ShowRole[]>,
      };
    },
    enabled: !!user,
  });

  const acceptMutation = useMutation({
    mutationFn: (callbackId: string) => acceptCallback(callbackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shows"] });
      queryClient.invalidateQueries({ queryKey: ["actorCallbacks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast("success", "Callback accepted!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const declineMutation = useMutation({
    mutationFn: (callbackId: string) => declineCallback(callbackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shows"] });
      queryClient.invalidateQueries({ queryKey: ["actorCallbacks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast("info", "Callback declined.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (isLoading) return <PageSkeleton />;

  // Build per-show journeys
  const journeys: ShowJourney[] = [];
  const processedShowIds = new Set<string>();

  if (data) {
    // Group signups and callbacks by show
    const signupsByShow = data.signups.reduce<Record<string, AuditionSignup>>(
      (acc, s) => {
        acc[s.showId] = s;
        return acc;
      },
      {}
    );
    const callbacksByShow = data.callbacks.reduce<Record<string, Callback[]>>(
      (acc, cb) => {
        (acc[cb.showId] ??= []).push(cb);
        return acc;
      },
      {}
    );
    const castByShow = (data.castAssignments ?? []).reduce<Record<string, CastAssignment[]>>(
      (acc, a) => {
        (acc[a.showId] ??= []).push(a);
        return acc;
      },
      {}
    );

    // Merge into journeys
    const allShowIds = new Set([
      ...Object.keys(signupsByShow),
      ...Object.keys(callbacksByShow),
      ...Object.keys(castByShow),
    ]);

    for (const showId of allShowIds) {
      const show = data.shows[showId] ?? null;
      const signup = signupsByShow[showId] ?? null;
      const cbs = callbacksByShow[showId] ?? [];
      const cas = castByShow[showId] ?? [];
      const groupList = data.groups[showId] ?? [];
      const roleList = data.roles[showId] ?? [];
      const group = signup?.groupId
        ? groupList.find((g) => g.id === signup.groupId) ?? null
        : null;
      const roleNames = (signup?.rolesInterested ?? [])
        .map((rid) => roleList.find((r) => r.id === rid)?.name)
        .filter(Boolean) as string[];

      // Determine phase — cast supersedes callback
      const hasCastOffers = cas.some((a) => a.status === "sent" || a.status === "accepted");
      const hasAcceptedCallbacks = cbs.some((c) => c.status === "accepted");
      const hasPendingCallbacks = cbs.some((c) => c.status === "pending");
      let phase: ShowJourney["phase"] = "audition";
      if (hasCastOffers) phase = "cast";
      else if (hasAcceptedCallbacks || hasPendingCallbacks) phase = "callback";

      journeys.push({
        showId,
        show,
        signup,
        callbacks: cbs,
        castAssignments: cas,
        group,
        rolesInterested: roleNames,
        phase,
      });
      processedShowIds.add(showId);
    }
  }

  // Past shows from credits (not already in active journeys)
  const pastCredits: ProductionCredit[] =
    actor?.credits.filter((c) => !processedShowIds.has(c.id)) ?? [];

  // Sort: pending callbacks first, then by audition date
  const activeJourneys = journeys.sort((a, b) => {
    const aPending = a.callbacks.some((c) => c.status === "pending") ? 0 : 1;
    const bPending = b.callbacks.some((c) => c.status === "pending") ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return 0;
  });

  const hasActive = activeJourneys.length > 0;
  const hasPast = pastCredits.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-display text-curtain-900 mb-1">
        My Shows
      </h1>
      <p className="text-sm text-clay-500 mb-8">
        Your auditions, callbacks, and production history.
      </p>

      {/* Active show journeys */}
      {hasActive && (
        <div className="mb-8">
          <div className="flex flex-col gap-5">
            {activeJourneys.map((j) => (
              <ShowJourneyCard
                key={j.showId}
                journey={j}
                onAccept={(id) => acceptMutation.mutate(id)}
                onDecline={(id) => declineMutation.mutate(id)}
                acceptPending={acceptMutation.isPending}
                declinePending={declineMutation.isPending}
                pendingId={
                  (acceptMutation.variables as string) ??
                  (declineMutation.variables as string)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Shows */}
      {hasPast && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
            Past Shows
          </h2>
          <div className="flex flex-col gap-3">
            {pastCredits.map((credit) => (
              <Card key={credit.id} variant="elevated" padding="compact">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Ticket
                      className="w-5 h-5 text-stage-500"
                      weight="duotone"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-display text-curtain-900">
                          {credit.showTitle}
                        </p>
                        {credit.verified && <VerifiedBadge />}
                      </div>
                      <p className="text-xs text-clay-500">
                        {credit.roleName} · {credit.theatreName}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-stage-600">
                    {credit.year}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasActive && !hasPast && (
        <EmptyState
          icon={<MaskHappy className="w-12 h-12" weight="duotone" />}
          title="No shows yet"
          description="Browse open auditions to find your first role."
          action={
            <Link href="/discover">
              <Button>Discover Auditions</Button>
            </Link>
          }
          className="mt-8"
        />
      )}
    </div>
  );
}

/* ============================================================
   Show Journey Card — one card per show, full timeline
   ============================================================ */

function ShowJourneyCard({
  journey,
  onAccept,
  onDecline,
  acceptPending,
  declinePending,
  pendingId,
}: {
  journey: ShowJourney;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  acceptPending: boolean;
  declinePending: boolean;
  pendingId: string | undefined;
}) {
  const { show, signup, callbacks, castAssignments: cas, group, rolesInterested } = journey;
  const pendingCallbacks = callbacks.filter((c) => c.status === "pending");
  const acceptedCallbacks = callbacks.filter((c) => c.status === "accepted");
  const sentOffers = cas.filter((a) => a.status === "sent");
  const acceptedOffers = cas.filter((a) => a.status === "accepted");
  const hasPending = pendingCallbacks.length > 0;
  const hasPendingOffers = sentOffers.length > 0;
  const needsAction = hasPending || hasPendingOffers;

  return (
    <Card
      variant={needsAction ? "highlighted" : "elevated"}
      padding="standard"
    >
      {/* Show header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <Link
            href={`/auditions/${journey.showId}`}
            className="text-lg font-display text-curtain-900 hover:text-curtain-700 transition"
          >
            {show?.title ?? "Show"}
          </Link>
          <p className="text-sm text-clay-500">{show?.orgName}</p>
        </div>
        {needsAction && (
          <Badge variant="warning" size="sm">
            Action Needed
          </Badge>
        )}
      </div>

      {/* Timeline items */}
      <div className="flex flex-col gap-3 relative">
        {/* Vertical connector line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-cream-200" />

        {/* 1. Audition step */}
        {signup && (
          <TimelineStep
            icon={
              <Microphone
                className="w-4 h-4 text-stage-500"
                weight="duotone"
              />
            }
            completed={journey.phase !== "audition"}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-curtain-900">
                  Audition
                </p>
                {group && (
                  <p className="text-xs text-curtain-700 flex items-center gap-1.5 mt-0.5">
                    <Calendar
                      className="w-3.5 h-3.5 text-stage-500"
                      weight="duotone"
                    />
                    {formatDate(group.startTime)} ·{" "}
                    {formatTime(group.startTime)} –{" "}
                    {formatTime(group.endTime)}
                  </p>
                )}
                {show?.auditionLocation && (
                  <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-0.5">
                    <MapPin
                      className="w-3.5 h-3.5 text-stage-500"
                      weight="duotone"
                    />
                    <span className="truncate">{show.auditionLocation}</span>
                  </p>
                )}
                {rolesInterested.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rolesInterested.map((name) => (
                      <Pill key={name} variant="role" className="cursor-default">
                        {name}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
              {journey.phase !== "audition" && (
                <CheckCircle
                  className="w-5 h-5 text-forest-500 flex-shrink-0"
                  weight="fill"
                />
              )}
            </div>
          </TimelineStep>
        )}

        {/* 2. Callback step — pending */}
        {pendingCallbacks.map((cb) => (
          <TimelineStep
            key={cb.id}
            icon={
              <Warning
                className="w-4 h-4 text-stage-500"
                weight="duotone"
              />
            }
            active
          >
            <div>
              <p className="text-sm font-semibold text-curtain-900">
                Callback: {cb.roleName}
              </p>
              {show?.callbackDate && (
                <p className="text-xs text-curtain-700 flex items-center gap-1.5 mt-0.5">
                  <Calendar
                    className="w-3.5 h-3.5 text-stage-500"
                    weight="duotone"
                  />
                  {formatDate(show.callbackDate)}
                  {show.callbackStartTime && (
                    <>
                      {" · "}
                      {formatTime(show.callbackStartTime)}
                      {show.callbackEndTime && ` – ${formatTime(show.callbackEndTime)}`}
                    </>
                  )}
                </p>
              )}
              {show?.callbackLocation && (
                <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-0.5">
                  <MapPin
                    className="w-3.5 h-3.5 text-stage-500"
                    weight="duotone"
                  />
                  {show.callbackLocation}
                </p>
              )}
              {show?.callbackContactName && (
                <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-0.5">
                  <Phone
                    className="w-3.5 h-3.5 text-stage-500"
                    weight="duotone"
                  />
                  {show.callbackContactName}
                  {show.callbackContactPhone && ` · ${show.callbackContactPhone}`}
                </p>
              )}
              {(cb.prepNotes || show?.callbackNotes) && (
                <div className="mt-2 p-2 bg-cream-50 rounded-lg">
                  {cb.prepNotes && (
                    <p className="text-xs text-curtain-700 leading-relaxed flex items-start gap-1.5">
                      <NoteBlank className="w-3.5 h-3.5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                      {cb.prepNotes}
                    </p>
                  )}
                  {show?.callbackNotes && (
                    <p className="text-xs text-curtain-700 leading-relaxed flex items-start gap-1.5 mt-1">
                      <NoteBlank className="w-3.5 h-3.5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                      {show.callbackNotes}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onAccept(cb.id)}
                  loading={acceptPending && pendingId === cb.id}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDecline(cb.id)}
                  loading={declinePending && pendingId === cb.id}
                >
                  Decline
                </Button>
              </div>
            </div>
          </TimelineStep>
        ))}

        {/* 3. Callback step — accepted */}
        {acceptedCallbacks.length > 0 && (
          <TimelineStep
            icon={
              <Megaphone
                className="w-4 h-4 text-stage-500"
                weight="duotone"
              />
            }
            completed
          >
            <div>
              <p className="text-sm font-semibold text-curtain-900">
                Callbacks Confirmed
              </p>
              {show?.callbackDate && (
                <p className="text-xs text-curtain-700 flex items-center gap-1.5 mt-0.5">
                  <Calendar
                    className="w-3.5 h-3.5 text-stage-500"
                    weight="duotone"
                  />
                  {formatDate(show.callbackDate)}
                  {show.callbackStartTime && (
                    <>
                      {" · "}
                      {formatTime(show.callbackStartTime)}
                      {show.callbackEndTime && ` – ${formatTime(show.callbackEndTime)}`}
                    </>
                  )}
                </p>
              )}
              {show?.callbackLocation && (
                <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-0.5">
                  <MapPin
                    className="w-3.5 h-3.5 text-stage-500"
                    weight="duotone"
                  />
                  {show.callbackLocation}
                </p>
              )}
              {show?.callbackContactName && (
                <p className="text-xs text-clay-500 flex items-center gap-1.5 mt-0.5">
                  <Phone
                    className="w-3.5 h-3.5 text-stage-500"
                    weight="duotone"
                  />
                  {show.callbackContactName}
                  {show.callbackContactPhone && ` · ${show.callbackContactPhone}`}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {acceptedCallbacks.map((cb) => (
                  <Pill key={cb.id} variant="endorsement" className="cursor-default">
                    {cb.roleName}
                  </Pill>
                ))}
              </div>
              {(acceptedCallbacks[0]?.prepNotes || show?.callbackNotes) && (
                <div className="mt-2 p-2 bg-cream-50 rounded-lg">
                  {acceptedCallbacks[0]?.prepNotes && (
                    <p className="text-xs text-curtain-700 leading-relaxed flex items-start gap-1.5">
                      <NoteBlank className="w-3.5 h-3.5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                      {acceptedCallbacks[0].prepNotes}
                    </p>
                  )}
                  {show?.callbackNotes && (
                    <p className="text-xs text-curtain-700 leading-relaxed flex items-start gap-1.5 mt-1">
                      <NoteBlank className="w-3.5 h-3.5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                      {show.callbackNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </TimelineStep>
        )}

        {/* 4. Cast step — pending offer (links to offer page) */}
        {sentOffers.map((offer) => (
          <TimelineStep
            key={offer.id}
            icon={
              <Trophy
                className="w-4 h-4 text-stage-500"
                weight="duotone"
              />
            }
            active
          >
            <Link href={`/offers/${offer.id}`} className="block group">
              <p className="text-sm font-semibold text-curtain-900">
                Cast: {offer.roleName}
                {offer.assignmentType !== "primary" && (
                  <span className="text-clay-400 font-normal ml-1">({offer.assignmentType})</span>
                )}
              </p>
              {show?.rehearsalStart && (
                <p className="text-xs text-curtain-700 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                  Rehearsals begin {formatDate(show.rehearsalStart)}
                </p>
              )}
              <p className="text-xs text-curtain-600 font-medium mt-2 group-hover:text-curtain-900 transition">
                View offer &amp; accept →
              </p>
            </Link>
          </TimelineStep>
        ))}

        {/* 5. Cast step — accepted */}
        {acceptedOffers.length > 0 && (
          <TimelineStep
            icon={
              <Trophy
                className="w-4 h-4 text-stage-500"
                weight="duotone"
              />
            }
            completed
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-curtain-900">
                  Cast
                </p>
                <CheckCircle className="w-4 h-4 text-forest-500" weight="fill" />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {acceptedOffers.map((a) => (
                  <Pill key={a.id} variant="endorsement" className="cursor-default">
                    {a.roleName}
                    {a.assignmentType !== "primary" && (
                      <span className="text-clay-400 ml-1">({a.assignmentType})</span>
                    )}
                  </Pill>
                ))}
              </div>
              {show?.rehearsalStart && (
                <p className="text-xs text-curtain-700 flex items-center gap-1.5 mt-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                  Rehearsals begin {formatDate(show.rehearsalStart)}
                </p>
              )}
              {/* You're in the company — the hub is your home base now */}
              <Link href={`/shows/${journey.showId}/hub`} className="inline-block mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<House className="w-4 h-4 text-stage-500" weight="duotone" />}
                >
                  Show Hub
                </Button>
              </Link>
            </div>
          </TimelineStep>
        )}
      </div>
    </Card>
  );
}

/* ============================================================
   Timeline Step — reusable row in the journey
   ============================================================ */

function TimelineStep({
  icon,
  completed,
  active,
  children,
}: {
  icon: React.ReactNode;
  completed?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 relative z-10">
      {/* Step indicator */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          active
            ? "bg-stage-100 ring-2 ring-stage-300"
            : completed
              ? "bg-stage-50"
              : "bg-white border border-cream-200"
        }`}
      >
        {icon}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">{children}</div>
    </div>
  );
}
