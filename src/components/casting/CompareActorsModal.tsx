"use client";

import { useQuery } from "@tanstack/react-query";
import { getActor } from "@/lib/api/client";
import { Modal, Avatar, Button, Pill } from "@/components/ui";
import { formatHeight } from "@/lib/utils";
import { vocalMismatch, ageMismatch } from "@/lib/castingFit";
import { CalendarX, Info } from "@phosphor-icons/react";
import type { ShowRole, AuditionSignup } from "@/types";

/* ============================================================
   CompareActorsModal — Week 4 casting-board upgrade (additive).

   Read-only side-by-side of 2–3 candidates for the role being
   assigned: headshot, vitals, conflict days, roles interested,
   endorsement labels, past-credit count. One "Cast this actor"
   button per column hands back to the existing assign flow.
   ============================================================ */

type Props = {
  open: boolean;
  onClose: () => void;
  actorIds: string[];
  /** The role being assigned (for the title + soft fit notes). */
  role: ShowRole | null;
  /** All roles on the show — to name each actor's interested roles. */
  roles: ShowRole[];
  signups: AuditionSignup[];
  /** actorId → distinct conflict-day count. */
  conflictDays: Map<string, number>;
  onCast: (actorId: string) => void;
  castPending: boolean;
};

function VitalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1.5 border-b border-cream-100 last:border-0">
      <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
        {label}
      </p>
      <p className="text-sm font-semibold text-curtain-900 text-center">{value}</p>
    </div>
  );
}

export function CompareActorsModal({
  open,
  onClose,
  actorIds,
  role,
  roles,
  signups,
  conflictDays,
  onCast,
  castPending,
}: Props) {
  const { data: actorsData, isLoading } = useQuery({
    queryKey: ["compareActors", actorIds],
    queryFn: () => Promise.all(actorIds.map((id) => getActor(id))),
    enabled: open && actorIds.length > 0,
  });

  const roleNameById = new Map(roles.map((r) => [r.id, r.name]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={role ? `Compare — ${role.name}` : "Compare Actors"}
      className="md:max-w-3xl"
    >
      <div className="py-4">
        {isLoading || !actorsData ? (
          <p className="text-sm text-clay-500 text-center py-8">
            Pulling up their profiles…
          </p>
        ) : (
          <div
            className={`grid gap-3 ${
              actorIds.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"
            } grid-cols-1`}
          >
            {actorsData.map((actor, i) => {
              if (!actor) return null;
              const actorId = actorIds[i];
              const signup = signups.find((s) => s.actorId === actorId);
              const days = conflictDays.get(actorId) ?? 0;
              const interested = (signup?.rolesInterested ?? [])
                .map((id) => roleNameById.get(id))
                .filter((n): n is string => !!n);
              const endorsementLabels = [
                ...new Set(actor.endorsements.map((e) => e.label)),
              ];
              const profile = actor.profile;
              const vocalFlag = vocalMismatch(
                role?.vocalRange ?? null,
                profile?.vocalRange ?? null
              );
              const ageFlag = ageMismatch(
                role?.ageRange ?? null,
                profile?.ageRangeLow ?? null,
                profile?.ageRangeHigh ?? null
              );

              return (
                <div
                  key={actorId}
                  className="rounded-xl border border-cream-200 bg-white p-4 flex flex-col"
                >
                  {/* Header */}
                  <div className="flex flex-col items-center text-center mb-3">
                    <Avatar
                      name={actor.displayName}
                      imageUrl={actor.avatarUrl}
                      size="lg"
                    />
                    <p className="text-base font-display text-curtain-900 mt-2">
                      {actor.displayName}
                    </p>
                    {actor.pronouns && (
                      <p className="text-xs text-clay-500">{actor.pronouns}</p>
                    )}
                  </div>

                  {/* Vitals */}
                  <div className="flex flex-col mb-3">
                    <VitalRow
                      label="Playing Age"
                      value={
                        profile?.ageRangeLow || profile?.ageRangeHigh
                          ? `${profile?.ageRangeLow ?? "?"}–${profile?.ageRangeHigh ?? "?"}`
                          : "—"
                      }
                    />
                    <VitalRow
                      label="Height"
                      value={
                        profile?.heightInches
                          ? formatHeight(profile.heightInches)
                          : "—"
                      }
                    />
                    <VitalRow
                      label="Vocal Range"
                      value={profile?.vocalRange ?? "—"}
                    />
                    <VitalRow
                      label="Past Credits"
                      value={String(actor.credits.length)}
                    />
                  </div>

                  {/* Conflict days */}
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <CalendarX
                      className={`w-4 h-4 ${days > 0 ? "text-stage-600" : "text-forest-500"}`}
                      weight="duotone"
                    />
                    <span className="text-xs font-semibold text-curtain-800">
                      {days === 0
                        ? "No conflicts"
                        : `${days} conflict day${days !== 1 ? "s" : ""}`}
                    </span>
                  </div>

                  {/* Roles interested */}
                  {interested.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase text-center mb-1.5">
                        Interested In
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {interested.map((name) => (
                          <Pill key={name} variant="role" className="px-2 py-0.5">
                            {name}
                          </Pill>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Endorsements */}
                  {endorsementLabels.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase text-center mb-1.5">
                        Endorsed For
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {endorsementLabels.map((label) => (
                          <Pill key={label} variant="endorsement" className="px-2 py-0.5">
                            {label}
                          </Pill>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Soft fit notes — heads up only, never blocking */}
                  {(vocalFlag || ageFlag) && role && (
                    <div className="flex items-start gap-1.5 p-2 bg-stage-50 border border-stage-200 rounded-lg mb-3">
                      <Info className="w-3.5 h-3.5 text-stage-600 mt-0.5 flex-shrink-0" weight="duotone" />
                      <p className="text-[11px] text-stage-700 leading-snug">
                        {vocalFlag &&
                          `Role calls for ${role.vocalRange}; lists ${profile?.vocalRange}. `}
                        {ageFlag &&
                          `Role plays ${role.ageRange}; lists ${profile?.ageRangeLow ?? "?"}–${profile?.ageRangeHigh ?? "?"}. `}
                        Not a dealbreaker.
                      </p>
                    </div>
                  )}

                  {/* Cast button — hands off to the existing assign flow */}
                  <div className="mt-auto pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => onCast(actorId)}
                      loading={castPending}
                    >
                      Cast This Actor
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
