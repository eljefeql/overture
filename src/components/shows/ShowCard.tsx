"use client";

import Link from "next/link";
import { Card, Badge, Avatar } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Calendar, MapPin, Star } from "@phosphor-icons/react";
import type { Show } from "@/types";

type Props = {
  show: Show;
  linkTo?: string;
};

const statusLabels: Record<string, { text: string; variant: "success" | "gold" | "default" | "muted" }> = {
  setup: { text: "Setup", variant: "muted" },
  auditions_open: { text: "Auditions Open", variant: "success" },
  auditions_closed: { text: "Auditions Closed", variant: "default" },
  callbacks: { text: "Callbacks", variant: "gold" },
  casting: { text: "Casting", variant: "gold" },
  cast: { text: "Cast", variant: "success" },
  archived: { text: "Archived", variant: "muted" },
};

export function ShowCard({ show, linkTo }: Props) {
  const status = statusLabels[show.status] ?? statusLabels.setup;

  const content = (
    <Card interactive={!!linkTo} padding="standard" className={show.isPromoted ? "ring-1 ring-stage-300" : undefined}>
      {show.isPromoted && (
        <div className="flex items-center gap-1 mb-2">
          <Star className="w-3.5 h-3.5 text-stage-500" weight="fill" />
          <span className="text-[10px] font-semibold text-stage-600 tracking-wide uppercase">Promoted</span>
        </div>
      )}
      <div className="flex items-start gap-4">
        <Avatar name={show.orgName} variant="org" size="lg" className="bg-stage-100 text-stage-700" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-display text-curtain-900 truncate">
              {show.title}
            </h3>
            <Badge variant={status.variant} size="sm">
              {status.text}
            </Badge>
          </div>
          <p className="text-sm text-clay-500 mb-1">{show.orgName}</p>
          <div className="flex items-center gap-3 text-xs text-clay-500 mb-1">
            {show.auditionStart && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                Auditions {formatDate(show.auditionStart)}
              </span>
            )}
            {show.distanceMiles != null && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {show.distanceMiles} mi · {show.city}
              </span>
            )}
          </div>
          <p className="text-[11px] text-clay-400">
            {show.showType === "musical" ? "Musical" : show.showType === "play" ? "Play" : "Revue"}
            {show.authorInfo && ` · ${show.authorInfo}`}
          </p>
        </div>
      </div>
    </Card>
  );

  if (linkTo) {
    return <Link href={linkTo}>{content}</Link>;
  }
  return content;
}
