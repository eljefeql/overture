"use client";

import type { ReactNode } from "react";
import { Card, Badge } from "@/components/ui";
import { formatTime } from "@/lib/utils";
import { Calendar, Clock, MapPin, PencilSimple } from "@phosphor-icons/react";
import type {
  GroupedVolunteerEvent,
  VolunteerRoleLike,
} from "@/lib/api/hub";

/* ============================================================
   One grouped card per volunteer EVENT (migration 027, QC #14):
   title · date · location · notes, then each SHIFT as a
   sub-section with its time range, then ROLES as rows. The role
   row itself is rendered by the caller (`renderRole`) because the
   hub shows signer names + one-tap claim while the anonymous
   public page shows counts only + the guest form. Shared by both
   so the two views never drift.
   ============================================================ */

/** "Sat, Mar 6" */
export function eventDateLabel(ymd: string | null): string | null {
  if (!ymd) return null;
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "9:00 AM – 12:00 PM" (or "Any time" when the shift has no times). */
export function shiftTimeLabel(shift: {
  startTime: string | null;
  endTime: string | null;
}): string {
  if (!shift.startTime) return "Any time";
  return `${formatTime(shift.startTime)}${shift.endTime ? ` – ${formatTime(shift.endTime)}` : ""}`;
}

type Props<N extends VolunteerRoleLike> = {
  group: GroupedVolunteerEvent<N>;
  /** Hub passes real fill counts via `filledFor`; public passes `filled`. */
  filledFor: (role: N) => number;
  renderRole: (role: N, ctx: { isPast: boolean }) => ReactNode;
  /** Team-only pencil (hub). */
  onEdit?: () => void;
};

export function VolunteerEventCard<N extends VolunteerRoleLike>({
  group,
  filledFor,
  renderRole,
  onEdit,
}: Props<N>) {
  const { event, shifts, unshifted, roles, isPast } = group;
  const totalSlots = roles.reduce((sum, r) => sum + r.slots, 0);
  const totalFilled = roles.reduce((sum, r) => sum + filledFor(r), 0);
  const allFull = totalSlots > 0 && totalFilled >= totalSlots;
  const dateLabel = eventDateLabel(event.eventDate);

  return (
    <Card variant="elevated" padding="standard">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-lg font-display text-curtain-900">{event.title}</h4>
            {isPast ? (
              <Badge size="sm">Past</Badge>
            ) : allFull ? (
              <Badge variant="success" size="sm">Full</Badge>
            ) : (
              <Badge variant="warning" size="sm">
                {totalSlots - totalFilled} open
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            {dateLabel && (
              <p className="text-xs text-clay-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {dateLabel}
              </p>
            )}
            {event.location && (
              <p className="text-xs text-clay-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {event.location}
              </p>
            )}
          </div>
          {event.notes && <p className="text-xs text-clay-500 mt-1.5">{event.notes}</p>}
          {totalSlots > 0 && (
            <p className="text-xs font-medium text-curtain-700 mt-2">
              {totalFilled} of {totalSlots} spots filled
            </p>
          )}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-clay-300 hover:text-stage-500 transition p-1 flex-shrink-0"
            aria-label={`Edit ${event.title}`}
          >
            <PencilSimple className="w-4 h-4" weight="bold" />
          </button>
        )}
      </div>

      {/* Shifts */}
      <div className="flex flex-col gap-3 mt-4">
        {shifts.map(({ shift, roles: shiftRoles, isPast: shiftPast }) => (
          <Card key={shift.id} variant="flat" padding="compact">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="w-4 h-4 text-stage-500" weight="duotone" />
              <p className="text-sm font-semibold text-curtain-900">
                {shiftTimeLabel(shift)}
              </p>
              {shift.label && (
                <span className="text-xs text-clay-500">· {shift.label}</span>
              )}
              {shiftPast && !isPast && <Badge size="sm">Past</Badge>}
            </div>
            {shiftRoles.length === 0 ? (
              <p className="text-xs text-clay-400 mt-2">No roles on this shift yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-cream-200 mt-2">
                {shiftRoles.map((role) => (
                  <div key={role.id} className="py-2.5 first:pt-1 last:pb-0">
                    {renderRole(role, { isPast: shiftPast || isPast })}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
        {unshifted.length > 0 && (
          <Card variant="flat" padding="compact">
            <p className="text-sm font-semibold text-curtain-900">Any time</p>
            <div className="flex flex-col divide-y divide-cream-200 mt-2">
              {unshifted.map((role) => (
                <div key={role.id} className="py-2.5 first:pt-1 last:pb-0">
                  {renderRole(role, { isPast })}
                </div>
              ))}
            </div>
          </Card>
        )}
        {shifts.length === 0 && unshifted.length === 0 && (
          <p className="text-xs text-clay-400">No shifts on this event yet.</p>
        )}
      </div>
    </Card>
  );
}
