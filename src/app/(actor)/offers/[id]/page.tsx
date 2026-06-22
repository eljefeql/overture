"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCastAssignment,
  getShow,
  getShowTeam,
  getShowRoles,
  getOrg,
  getActor,
  acceptCastOffer,
  declineCastOffer,
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
  SectionHeader,
} from "@/components/ui";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
import { formatDate, formatTeamRole } from "@/lib/utils";
import {
  Trophy,
  Calendar,
  MapPin,
  Buildings,
  ArrowLeft,
  CheckCircle,
  Phone,
  Envelope,
  MusicNotes,
  Confetti,
  ShieldCheck,
  Star,
} from "@phosphor-icons/react";

export default function CastOfferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showConfetti, setShowConfetti] = useState(false);
  const [rehearsalChecked, setRehearsalChecked] = useState(false);
  const [performanceChecked, setPerformanceChecked] = useState(false);
  const [conductChecked, setConductChecked] = useState(false);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [mediaChecked, setMediaChecked] = useState(false);

  // ── Queries ──────────────────────────────────────────
  const { data: assignment, isLoading: loadingAssignment } = useQuery({
    queryKey: ["castAssignment", id],
    queryFn: () => getCastAssignment(id),
  });

  const { data: show, isLoading: loadingShow } = useQuery({
    queryKey: ["show", assignment?.showId],
    queryFn: () => getShow(assignment!.showId),
    enabled: !!assignment?.showId,
  });

  const { data: org } = useQuery({
    queryKey: ["org", show?.orgId],
    queryFn: () => getOrg(show!.orgId),
    enabled: !!show?.orgId,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["showTeam", assignment?.showId],
    queryFn: () => getShowTeam(assignment!.showId),
    enabled: !!assignment?.showId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["showRoles", assignment?.showId],
    queryFn: () => getShowRoles(assignment!.showId),
    enabled: !!assignment?.showId,
  });

  // Needed for guardian consent — minors' agreements are made by their guardian
  const { data: actorRecord } = useQuery({
    queryKey: ["actor", user?.id],
    queryFn: () => getActor(user!.id),
    enabled: !!user,
  });

  // ── Mutations ────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: () => acceptCastOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["castAssignment", id] });
      queryClient.invalidateQueries({ queryKey: ["actorCastAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["my-shows"] });
      setShowConfetti(true);
      toast("success", "Congratulations! Role accepted.");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Something went wrong.");
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => declineCastOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["castAssignment", id] });
      queryClient.invalidateQueries({ queryKey: ["actorCastAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["my-shows"] });
      toast("info", "Offer declined.");
      router.push("/my-shows");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Something went wrong.");
    },
  });

  // ── Loading / Error ──────────────────────────────────
  if (loadingAssignment || loadingShow) return <PageSkeleton />;
  if (!assignment || !show) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 text-center">
        <p className="text-clay-500">Offer not found.</p>
        <Link href="/my-shows" className="text-curtain-600 underline mt-2 inline-block">
          Back to My Shows
        </Link>
      </div>
    );
  }

  const director = team.find((t) => t.role === "director");
  const stageManager = team.find((t) => t.role === "stage_manager");
  const offeredRole = roles.find((r) => r.id === assignment.roleId);
  const isAccepted = assignment.status === "accepted";
  const isSent = assignment.status === "sent";
  const allChecked = rehearsalChecked && performanceChecked && conductChecked && membershipChecked && mediaChecked;

  // Guardian consent: a minor's agreements are made by their guardian
  const minorProfile = actorRecord?.profile?.isMinor ? actorRecord.profile : null;
  const guardianName = minorProfile?.guardianName ?? null;

  // ── Render ───────────────────────────────────────────
  return (
    <>
    <ConfettiBurst trigger={showConfetti} />
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href="/my-shows"
        className="inline-flex items-center gap-1.5 text-sm text-curtain-600 hover:text-curtain-900 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" weight="bold" />
        Back to My Shows
      </Link>

      {/* ════════════════════════════════════════════════
          CELEBRATORY HEADER
          ════════════════════════════════════════════════ */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-stage-100 mb-4">
          {isAccepted ? (
            <CheckCircle className="w-10 h-10 text-forest-500" weight="fill" />
          ) : (
            <Trophy className="w-10 h-10 text-stage-600" weight="duotone" />
          )}
        </div>
        <h1 className="text-3xl font-display text-curtain-900 mb-1">
          {isAccepted ? "Congratulations!" : "You\u2019ve Been Cast!"}
        </h1>
        <p className="text-sm text-clay-500">
          {isAccepted
            ? `You accepted the role of ${assignment.roleName}`
            : `${show.orgName} would like to offer you a role`}
        </p>
        {isSent && (
          <Badge variant="warning" size="sm" className="mt-3">
            Action Needed
          </Badge>
        )}
        {isAccepted && (
          <Badge variant="success" size="sm" className="mt-3">
            Accepted
          </Badge>
        )}
      </div>

      {/* ════════════════════════════════════════════════
          ROLE CARD
          ════════════════════════════════════════════════ */}
      <Card variant="highlighted" className="mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-stage-100 flex items-center justify-center flex-shrink-0">
            <Star className="w-6 h-6 text-stage-600" weight="duotone" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold text-curtain-700 tracking-wide uppercase">
              Your Role
            </p>
            <p className="text-xl font-display text-curtain-900 mt-0.5">
              {assignment.roleName}
            </p>
            {assignment.assignmentType !== "primary" && (
              <Badge variant="muted" size="sm" className="mt-1">
                {assignment.assignmentType === "understudy" ? "Understudy" : "Alternate"}
              </Badge>
            )}
          </div>
        </div>

        {/* Role description from the roles data */}
        {offeredRole?.description && (
          <p className="text-sm text-clay-500 mt-4 leading-relaxed">
            {offeredRole.description}
          </p>
        )}

        {/* Role details */}
        {offeredRole && (offeredRole.ageRange || offeredRole.vocalRange) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {offeredRole.vocalRange && (
              <Pill variant="role" className="cursor-default">
                <MusicNotes className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {offeredRole.vocalRange}
              </Pill>
            )}
            {offeredRole.ageRange && (
              <Pill variant="role" className="cursor-default">
                {offeredRole.ageRange}
              </Pill>
            )}
          </div>
        )}
      </Card>

      {/* ════════════════════════════════════════════════
          SHOW OVERVIEW
          ════════════════════════════════════════════════ */}
      <Card variant="flat" className="mb-6">
        <SectionHeader>About the Production</SectionHeader>
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            name={show.orgName}
            variant="org"
            size="md"
          />
          <div>
            <p className="text-lg font-display text-curtain-900">{show.title}</p>
            <p className="text-xs text-clay-500 flex items-center gap-1.5">
              <Buildings className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
              {show.orgName}
            </p>
          </div>
        </div>

        {show.authorInfo && (
          <p className="text-xs text-clay-400 mb-4">{show.authorInfo}</p>
        )}

        {org?.description && (
          <p className="text-sm text-clay-500 leading-relaxed mb-4">
            {org.description}
          </p>
        )}

        {/* Production schedule */}
        {(show.rehearsalStart || show.showOpen) && (
          <div className="p-4 bg-cream-50 rounded-xl">
            <p className="text-[10px] font-semibold text-curtain-700 tracking-wide uppercase mb-3">
              Production Schedule
            </p>
            <div className="flex flex-col gap-2">
              {show.rehearsalStart && (
                <p className="text-sm text-curtain-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                  Rehearsals begin {formatDate(show.rehearsalStart)}
                </p>
              )}
              {show.showOpen && (
                <p className="text-sm text-curtain-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                  Show opens {formatDate(show.showOpen)}
                  {show.showClose && ` – ${formatDate(show.showClose)}`}
                </p>
              )}
              {show.callbackLocation && (
                <p className="text-sm text-curtain-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                  {show.callbackLocation.split(",")[0]}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Creative team */}
        {team.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-curtain-700 tracking-wide uppercase mb-3">
              Creative Team
            </p>
            <div className="flex flex-col gap-2">
              {team
                .filter((t) => ["director", "music_director", "choreographer"].includes(t.role))
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5">
                    <Avatar name={t.userName} size="xs" />
                    <span className="text-sm text-curtain-800">{t.userName}</span>
                    <span className="text-xs text-clay-400">{formatTeamRole(t.role)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Card>

      {/* ════════════════════════════════════════════════
          COMMITMENTS & TERMS (only for pending offers)
          ════════════════════════════════════════════════ */}
      {isSent && (
        <Card variant="flat" className="mb-6">
          <SectionHeader>Commitments &amp; Terms</SectionHeader>

          {/* Guardian consent — minors don't sign for themselves */}
          {minorProfile && (
            <div className="flex items-start gap-2.5 p-3 mb-4 rounded-xl bg-stage-50 border border-stage-200">
              <ShieldCheck className="w-5 h-5 text-stage-600 flex-shrink-0 mt-0.5" weight="duotone" />
              <p className="text-xs text-curtain-800 leading-relaxed">
                <span className="font-semibold">Guardian consent required.</span>{" "}
                {guardianName ? (
                  <>
                    These agreements are made by{" "}
                    <span className="font-semibold">{guardianName}</span>
                    {minorProfile.guardianEmail && ` (${minorProfile.guardianEmail})`} on
                    behalf of {actorRecord?.displayName}. By checking the boxes below,
                    you confirm you are {actorRecord?.displayName}&apos;s guardian.
                  </>
                ) : (
                  <>
                    This account belongs to a minor and a guardian must accept these
                    agreements. Add guardian details on the profile before accepting.
                  </>
                )}
              </p>
            </div>
          )}

          <p className="text-sm text-clay-500 mb-5">
            Please review and acknowledge each item to accept{" "}
            {minorProfile ? "this role on your child's behalf" : "your role"}.
          </p>

          {/* 1. Rehearsal Attendance */}
          <label className="flex items-start gap-3 cursor-pointer group mb-1">
            <input
              type="checkbox"
              checked={rehearsalChecked}
              onChange={(e) => setRehearsalChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-cream-300 text-curtain-600 focus:ring-curtain-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-curtain-900 group-hover:text-curtain-700 transition">
                Rehearsal Attendance
              </p>
              <p className="text-xs text-clay-500 mt-1 leading-relaxed">
                I understand that I may miss a{" "}
                <strong className="text-curtain-800">maximum of 3 rehearsals</strong>{" "}
                during the production. Additional absences may result in being recast.
                I have shared my known conflicts with the production team.
              </p>
            </div>
          </label>

          <hr className="border-cream-200 my-4" />

          {/* 2. Performance Commitment */}
          <label className="flex items-start gap-3 cursor-pointer group mb-1">
            <input
              type="checkbox"
              checked={performanceChecked}
              onChange={(e) => setPerformanceChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-cream-300 text-curtain-600 focus:ring-curtain-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-curtain-900 group-hover:text-curtain-700 transition">
                Performance Commitment
              </p>
              <p className="text-xs text-clay-500 mt-1 leading-relaxed">
                I commit to being available for{" "}
                <strong className="text-curtain-800">all scheduled performances</strong>
                {show.showOpen && (
                  <> ({formatDate(show.showOpen)}{show.showClose && ` – ${formatDate(show.showClose)}`})</>
                )}.
                I understand that missing a performance is only permitted in cases of emergency or illness.
              </p>
            </div>
          </label>

          <hr className="border-cream-200 my-4" />

          {/* 3. Code of Conduct */}
          <label className="flex items-start gap-3 cursor-pointer group mb-1">
            <input
              type="checkbox"
              checked={conductChecked}
              onChange={(e) => setConductChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-cream-300 text-curtain-600 focus:ring-curtain-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-curtain-900 group-hover:text-curtain-700 transition">
                Code of Conduct
              </p>
              <p className="text-xs text-clay-500 mt-1 leading-relaxed">
                I have read and agree to abide by{" "}
                <span className="text-curtain-600 underline decoration-curtain-300 cursor-pointer hover:text-curtain-800 transition">
                  {show.orgName}&apos;s Safe Space &amp; Conduct Policy
                </span>
                , which includes guidelines on respectful behavior, anti-harassment,
                and creating an inclusive environment for all cast and crew.
              </p>
            </div>
          </label>

          <hr className="border-cream-200 my-4" />

          {/* 4. Membership & Participation */}
          <label className="flex items-start gap-3 cursor-pointer group mb-1">
            <input
              type="checkbox"
              checked={membershipChecked}
              onChange={(e) => setMembershipChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-cream-300 text-curtain-600 focus:ring-curtain-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-curtain-900 group-hover:text-curtain-700 transition">
                Membership &amp; Participation
              </p>
              <p className="text-xs text-clay-500 mt-1 leading-relaxed">
                I understand that participation requires an active {show.orgName} membership
                {" "}(<strong className="text-curtain-800">$35/year</strong>) and a minimum of{" "}
                <strong className="text-curtain-800">4 volunteer hours</strong>{" "}
                during the production (set build, strike, concessions, etc.).
                Membership can be paid online or at the first rehearsal.
              </p>
            </div>
          </label>

          <hr className="border-cream-200 my-4" />

          {/* 5. Photo & Media Release */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={mediaChecked}
              onChange={(e) => setMediaChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-cream-300 text-curtain-600 focus:ring-curtain-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-curtain-900 group-hover:text-curtain-700 transition">
                Photo &amp; Media Release
              </p>
              <p className="text-xs text-clay-500 mt-1 leading-relaxed">
                I grant {show.orgName}{" "}permission to use production photos and video for
                promotional purposes, including social media, the theatre&apos;s website,
                and printed materials.
              </p>
            </div>
          </label>
        </Card>
      )}

      {/* ════════════════════════════════════════════════
          ACCEPT / DECLINE BUTTONS
          ════════════════════════════════════════════════ */}
      {isSent && (
        <div className="flex flex-col gap-3 mb-8">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!allChecked || (!!minorProfile && !guardianName)}
            loading={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
          >
            <Confetti className="w-5 h-5" weight="duotone" />
            {minorProfile ? "Accept as Guardian" : "Accept Role"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            loading={declineMutation.isPending}
            onClick={() => {
              if (window.confirm("Are you sure you want to decline this offer? This can't be undone.")) {
                declineMutation.mutate();
              }
            }}
          >
            Decline Offer
          </Button>
          {!allChecked && (
            <p className="text-xs text-clay-400 text-center">
              Please review and check all agreements above to accept.
            </p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          POST-ACCEPTANCE STATE
          ════════════════════════════════════════════════ */}
      {isAccepted && (
        <>
          <Card variant="flat" className="mb-6 border-forest-200 bg-forest-50/30">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-forest-500" weight="fill" />
              <div>
                <p className="text-sm font-semibold text-curtain-900">
                  You&apos;re in the cast!
                </p>
                <p className="text-xs text-clay-500">
                  Get ready for an incredible experience.
                </p>
              </div>
            </div>

            {(show.rehearsalStart || show.showOpen) && (
              <div className="p-3 bg-white/60 rounded-xl">
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

          {/* Contact block */}
          <Card variant="flat" className="mb-6">
            <SectionHeader>Questions About Your Role?</SectionHeader>

            {director && (
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={director.userName} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-curtain-900">{director.userName}</p>
                  <p className="text-xs text-clay-400">{formatTeamRole(director.role)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {director.email && (
                    <a
                      href={`mailto:${director.email}`}
                      className="p-2.5 rounded-xl bg-white border border-cream-200 text-stage-600 hover:bg-cream-50 transition"
                      title={`Email ${director.userName}`}
                    >
                      <Envelope className="w-5 h-5" weight="duotone" />
                    </a>
                  )}
                  {director.phone && (
                    <a
                      href={`tel:${director.phone.replace(/\D/g, "")}`}
                      className="p-2.5 rounded-xl bg-white border border-cream-200 text-stage-600 hover:bg-cream-50 transition"
                      title="Call"
                    >
                      <Phone className="w-5 h-5" weight="duotone" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {director && stageManager && <hr className="border-cream-200 my-3" />}

            {stageManager && (
              <div className="flex items-center gap-3">
                <Avatar name={stageManager.userName} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-curtain-900">{stageManager.userName}</p>
                  <p className="text-xs text-clay-400">{formatTeamRole(stageManager.role)}</p>
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
                      title="Call"
                    >
                      <Phone className="w-5 h-5" weight="duotone" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
    </>
  );
}
