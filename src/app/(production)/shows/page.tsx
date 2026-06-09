"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { getShows, getOrg } from "@/lib/api/client";
import {
  Card,
  Badge,
  Pill,
  Button,
  PageSkeleton,
  EmptyState,
} from "@/components/ui";
import { Plus, Ticket, Calendar, MapPin } from "@phosphor-icons/react";
import { formatDate } from "@/lib/utils";
import {
  SHOW_STATUS_LABELS,
  SHOW_STATUS_BADGE,
  SHOW_TYPE_LABELS,
} from "@/lib/constants";
import type { ShowStatus } from "@/types";

/* ============================================================
   Shows List — Production team's show hub
   ============================================================ */

/** Map show status to the correct sub-page for production teams */
function getShowHref(showId: string, status: ShowStatus): string {
  switch (status) {
    case "setup":
    case "auditions_open":
    case "auditions_closed":
      return `/shows/${showId}/auditions`;
    case "callbacks":
      return `/shows/${showId}/callbacks`;
    case "casting":
      return `/shows/${showId}/casting`;
    case "cast":
    case "archived":
      return `/shows/${showId}/cast-list`;
    default:
      return `/shows/${showId}/auditions`;
  }
}

const STATUS_FILTERS: { value: ShowStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "setup", label: "Setup" },
  { value: "auditions_open", label: "Auditions Open" },
  { value: "auditions_closed", label: "Auditions Closed" },
  { value: "callbacks", label: "Callbacks" },
  { value: "casting", label: "Casting" },
  { value: "cast", label: "Cast" },
  { value: "archived", label: "Archived" },
];

export default function ShowsListPage() {
  const { activeRole } = useAuth();
  const orgId = activeRole.type === "org" ? activeRole.orgId : "org-1";

  const [filter, setFilter] = useState<ShowStatus | "all">("all");

  const { data: shows, isLoading } = useQuery({
    queryKey: ["shows", orgId],
    queryFn: () => getShows({ orgId }),
  });

  const { data: org } = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => getOrg(orgId),
  });

  if (isLoading) return <PageSkeleton />;

  const filtered = filter === "all"
    ? shows
    : shows?.filter((s) => s.status === filter);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display text-curtain-900">Shows</h1>
          {org && (
            <p className="text-sm text-clay-500 mt-1">
              {org.name} · {shows?.length ?? 0} show{(shows?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link href="/shows/new">
          <Button
            size="md"
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            New Show
          </Button>
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
        {STATUS_FILTERS.map((f) => (
          <Pill
            key={f.value}
            variant="filter"
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Pill>
        ))}
      </div>

      {/* Show cards */}
      {filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
          {filtered.map((show) => (
            <Link key={show.id} href={getShowHref(show.id, show.status)}>
              <Card variant="elevated" interactive className="h-full">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-lg font-display text-curtain-900">
                    {show.title}
                  </h2>
                  <Badge
                    variant={SHOW_STATUS_BADGE[show.status]}
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {SHOW_STATUS_LABELS[show.status]}
                  </Badge>
                </div>

                {show.authorInfo && (
                  <p className="text-xs text-clay-500 mb-3 line-clamp-1">
                    {show.authorInfo}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-clay-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                    Auditions {show.auditionStart ? formatDate(show.auditionStart) : "TBD"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                    {show.city}, {show.state}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-cream-100">
                  <Pill variant="status" className="cursor-default">
                    {SHOW_TYPE_LABELS[show.showType] ?? show.showType}
                  </Pill>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Ticket className="w-12 h-12" weight="duotone" />}
          title="No shows yet"
          description="Create your first show to start casting."
          action={
            <Link href="/shows/new">
              <Button size="sm" icon={<Plus className="w-4 h-4" weight="bold" />}>
                Create Show
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
