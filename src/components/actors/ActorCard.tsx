"use client";

import { Avatar, Badge, Pill } from "@/components/ui";
import type { AuditionSignup } from "@/types";
import { useUIStore } from "@/stores/useUIStore";

type Props = {
  signup: AuditionSignup;
  showRoleNames?: Record<string, string>;
};

export function ActorCard({ signup, showRoleNames = {} }: Props) {
  const openActorPanel = useUIStore((s) => s.openActorPanel);

  const statusColors: Record<string, string> = {
    signed_up: "default",
    checked_in: "gold",
    auditioned: "success",
    shortlisted: "warning",
    callback: "gold",
    cast: "success",
    released: "muted",
    withdrawn: "danger",
  } as Record<string, string>;

  return (
    <div
      className="bg-cream-50 border border-cream-200 rounded-2xl p-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-stage-300 group"
      onClick={() => openActorPanel(signup.actorId, signup.showId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") openActorPanel(signup.actorId, signup.showId);
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={signup.actorName} imageUrl={signup.actorAvatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-curtain-900 truncate group-hover:text-curtain-700">
            {signup.actorName}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {signup.rolesInterested.slice(0, 2).map((roleId) => (
              <span key={roleId} className="text-[11px] text-clay-500">
                {showRoleNames[roleId] ?? "Role"}
              </span>
            ))}
            {signup.openToOther && (
              <span className="text-[11px] text-stage-600">+Any</span>
            )}
          </div>
        </div>
        <Badge variant={statusColors[signup.status] as "default"} size="sm">
          {signup.status.replace("_", " ")}
        </Badge>
      </div>
    </div>
  );
}
