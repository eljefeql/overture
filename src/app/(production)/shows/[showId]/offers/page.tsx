"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  getShow,
  getCastAssignments,
  sendOfferReminder,
} from "@/lib/api/client";
import {
  Card,
  Badge,
  Button,
  Avatar,
  Pill,
  StatBlock,
  PageSkeleton,
  EmptyState,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import {
  PaperPlaneTilt,
  Warning,
  BellRinging,
  CheckCircle,
  ArrowLeft,
} from "@phosphor-icons/react";
import type { CastAssignment, OfferStatus } from "@/types";

/* ============================================================
   Offers Tracker — the home for sent cast offers (QA finding 14)

   Who has an offer out, who has responded, and a "Send reminder"
   nudge (existing notification pipeline) for anyone still pending.
   ============================================================ */

const STATUS_ORDER: Record<OfferStatus, number> = {
  sent: 0,
  declined: 1,
  accepted: 2,
  draft: 3,
  withdrawn: 4,
};

export default function OffersTrackerPage() {
  const { showId } = useParams<{ showId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Reminders sent this session — simple UI rate-limit, no new tables.
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["offersTracker", showId],
    queryFn: async () => {
      const [show, assignments] = await Promise.all([
        getShow(showId),
        getCastAssignments(showId),
      ]);
      return { show, assignments };
    },
  });

  const remindMutation = useMutation({
    mutationFn: (assignment: CastAssignment) =>
      sendOfferReminder(assignment.id),
    onSuccess: (_res, assignment) => {
      setRemindedIds((prev) => new Set(prev).add(assignment.id));
      toast("success", `Reminder sent to ${assignment.actorName}.`);
      queryClient.invalidateQueries({ queryKey: ["offersTracker", showId] });
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.show) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <EmptyState
          icon={<Warning className="w-12 h-12" weight="duotone" />}
          title="Unable to load offers"
          description="Something went wrong. Please try again."
          action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
        />
      </div>
    );
  }

  const { show, assignments } = data;
  const active = assignments.filter((a) => a.status !== "withdrawn");
  const drafts = active.filter((a) => a.status === "draft");
  const offers = active
    .filter((a) => a.status === "sent" || a.status === "accepted" || a.status === "declined")
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.actorName.localeCompare(b.actorName)
    );
  const pending = offers.filter((a) => a.status === "sent");
  const accepted = offers.filter((a) => a.status === "accepted");
  const declined = offers.filter((a) => a.status === "declined");

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display text-curtain-900">Offers</h1>
          <p className="text-sm text-clay-500 mt-1">
            Every cast offer for <strong>{show.title}</strong> — see who has
            responded and nudge anyone who hasn&apos;t.
          </p>
        </div>
        <Link href={`/shows/${showId}/casting`}>
          <Button
            variant="outline"
            icon={<ArrowLeft className="w-4 h-4" weight="bold" />}
          >
            Casting Board
          </Button>
        </Link>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          icon={<PaperPlaneTilt className="w-12 h-12" weight="duotone" />}
          title="No offers sent yet"
          description={
            drafts.length > 0
              ? `You have ${drafts.length} draft assignment${drafts.length !== 1 ? "s" : ""} waiting — send offers from the Casting Board and track responses here.`
              : "Assign actors on the Casting Board, send offers, then track responses here."
          }
          action={
            <Link href={`/shows/${showId}/casting`}>
              <Button>Go to Casting Board</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* ── Summary counts ── */}
          <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
            <StatBlock label="Accepted" value={String(accepted.length)} />
            <StatBlock label="Awaiting Response" value={String(pending.length)} />
            <StatBlock label="Declined" value={String(declined.length)} />
          </div>

          {/* ── Drafts not yet sent ── */}
          {drafts.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-stage-50 border border-stage-200 rounded-xl mb-6 animate-fade-up" style={{ animationDelay: "75ms" }}>
              <Warning className="w-5 h-5 text-stage-600" weight="duotone" />
              <p className="text-sm text-curtain-800">
                <strong>{drafts.length}</strong> draft assignment{drafts.length !== 1 ? "s" : ""} ha
                {drafts.length !== 1 ? "ve" : "s"}n&apos;t been sent yet —{" "}
                <Link href={`/shows/${showId}/casting`} className="font-semibold underline hover:text-curtain-900">
                  send offers from the Casting Board
                </Link>
                .
              </p>
            </div>
          )}

          {/* ── Offers list ── */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "100ms" }}>
            <div className="flex flex-col">
              {offers.map((offer) => {
                const reminded = remindedIds.has(offer.id);
                return (
                  <div
                    key={offer.id}
                    className="flex flex-wrap items-center gap-3 py-3 border-b border-cream-100 last:border-0"
                  >
                    <Avatar name={offer.actorName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-curtain-900">
                          {offer.actorName}
                        </span>
                        <Pill variant="role">{offer.roleName}</Pill>
                      </div>
                      <p className="text-[11px] text-clay-400 mt-0.5">
                        {offer.status === "sent"
                          ? offer.updatedAt
                            ? `Sent ${formatDate(offer.updatedAt)}`
                            : "Sent — awaiting response"
                          : offer.updatedAt
                            ? `Responded ${formatDate(offer.updatedAt)}`
                            : "Responded"}
                      </p>
                    </div>
                    {offer.status === "accepted" && (
                      <Badge variant="success" size="sm">Accepted</Badge>
                    )}
                    {offer.status === "declined" && (
                      <Badge variant="danger" size="sm">Declined</Badge>
                    )}
                    {offer.status === "sent" && (
                      <>
                        <Badge variant="warning" size="sm">Pending</Badge>
                        {reminded ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest-700">
                            <CheckCircle className="w-3.5 h-3.5" weight="duotone" />
                            Reminder sent
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => remindMutation.mutate(offer)}
                            loading={
                              remindMutation.isPending &&
                              remindMutation.variables?.id === offer.id
                            }
                            disabled={remindMutation.isPending}
                            icon={<BellRinging className="w-4 h-4" weight="duotone" />}
                          >
                            Send reminder
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {declined.length > 0 && (
            <p className="text-xs text-clay-500 mt-4 text-center animate-fade-up" style={{ animationDelay: "150ms" }}>
              Declined a role? Remove that assignment on the Casting Board and
              offer it to someone else.
            </p>
          )}
        </>
      )}
    </div>
  );
}
