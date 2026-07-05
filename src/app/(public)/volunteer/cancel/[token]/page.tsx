"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  getVolunteerShiftInfo,
  cancelVolunteerByToken,
} from "@/lib/api/hub";
import { Card, Button, PageSkeleton, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { formatTime } from "@/lib/utils";
import {
  Calendar,
  HandHeart,
  HeartBreak,
  CheckCircle,
} from "@phosphor-icons/react";

/* ============================================================
   Guest cancel — /volunteer/cancel/[token]. No login required:
   the secure token (from the claim / confirmation email) proves
   the spot is yours. Confirms the shift, one button to give it
   up, warm goodbye.
   ============================================================ */

function shiftWhen(info: {
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
}): string {
  const parts: string[] = [];
  if (info.eventDate) {
    parts.push(
      new Date(`${info.eventDate}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }
  if (info.startTime) {
    parts.push(
      `${formatTime(info.startTime)}${info.endTime ? ` – ${formatTime(info.endTime)}` : ""}`
    );
  }
  return parts.join(" · ");
}

export default function VolunteerCancelPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelled, setCancelled] = useState(false);

  const { data: info, isLoading } = useQuery({
    queryKey: ["volunteerShift", token],
    queryFn: () => getVolunteerShiftInfo(token),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelVolunteerByToken(token),
    onSuccess: (ok) => {
      // Freshen the public board + hub lists so the freed spot shows
      // immediately if the visitor navigates back.
      queryClient.invalidateQueries({ queryKey: ["volunteerBoard"] });
      queryClient.invalidateQueries({ queryKey: ["hubVolunteers"] });
      queryClient.invalidateQueries({ queryKey: ["volunteerShift", token] });
      if (!ok) toast("info", "This spot was already given up — you're all set.");
      setCancelled(true);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (isLoading) return <PageSkeleton />;

  if (!info) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <EmptyState
          icon={<HandHeart className="w-12 h-12" weight="duotone" />}
          title="We couldn't find that signup"
          description="The link may be out of date, or the spot may have already been removed. If you think something's off, reply to your confirmation email."
        />
      </div>
    );
  }

  const alreadyCancelled = cancelled || info.status === "cancelled";
  const when = shiftWhen(info);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {alreadyCancelled ? (
        <Card variant="elevated" padding="spacious">
          <div className="flex flex-col items-center text-center gap-3">
            <CheckCircle className="w-12 h-12 text-forest-600" weight="duotone" />
            <h1 className="text-2xl font-display text-curtain-900">
              Your spot is freed up
            </h1>
            <p className="text-sm text-clay-500 max-w-md">
              Thanks for letting {info.orgName || "the theatre"} know — it
              gives someone else the chance to step in. We hope to see you at{" "}
              {info.showTitle}!
            </p>
            <Link href="/browse" className="mt-2">
              <Button variant="outline">Browse Open Auditions</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card variant="elevated" padding="spacious">
          <div className="flex flex-col items-center text-center gap-3">
            <HeartBreak className="w-12 h-12 text-stage-500" weight="duotone" />
            <h1 className="text-2xl font-display text-curtain-900">
              Give up your volunteer spot?
            </h1>
            <div>
              <p className="text-sm font-semibold text-curtain-900">
                {info.label} — {info.showTitle}
              </p>
              {when && (
                <p className="text-sm text-clay-500 flex items-center justify-center gap-1.5 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                  {when}
                </p>
              )}
              {info.name && (
                <p className="text-xs text-clay-400 mt-1">Signed up as {info.name}</p>
              )}
            </div>
            <p className="text-sm text-clay-500 max-w-md">
              No hard feelings — life happens. Giving up your spot opens it
              for someone else in the community.
            </p>
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
            >
              Give up my spot
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
