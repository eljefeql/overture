"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useOrg } from "@/features/auth/useOrg";
import { getShows, getOrgDashboard } from "@/lib/api/client";
import type { OrgDashboard, ShowDashboardStats } from "@/lib/api/client";
import {
  Card,
  Badge,
  Pill,
  Button,
  PageSkeleton,
  EmptyState,
  Skeleton,
  SectionHeader,
  DateBlock,
} from "@/components/ui";
import {
  Plus,
  Ticket,
  Calendar,
  MapPin,
  EnvelopeSimple,
  BellRinging,
  UsersThree,
  Wrench,
  CaretRight,
  CaretDown,
  CaretUp,
  WarningCircle,
  ClipboardText,
} from "@phosphor-icons/react";
import { formatDate } from "@/lib/utils";
import {
  SHOW_STATUS_LABELS,
  SHOW_STATUS_BADGE,
  SHOW_TYPE_LABELS,
} from "@/lib/constants";
import type { Show, ShowStatus } from "@/types";

/* ============================================================
   Shows List — Production team's command center
   The shows grid (cards, filters, statuses, links) is LOCKED;
   the dashboard sections below enrich AROUND it and never
   block it — aggregation loads in its own query.
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

/* ============================================================
   "Needs your attention" — aggregated action items
   ============================================================ */

type AttentionItem = {
  key: string;
  icon: React.ReactNode;
  text: string;
  href: string;
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function buildAttentionItems(
  dashboard: OrgDashboard,
  showById: Map<string, Show>
): AttentionItem[] {
  const offers: AttentionItem[] = [];
  const callbackItems: AttentionItem[] = [];
  const filling: AttentionItem[] = [];
  const setup: AttentionItem[] = [];

  for (const s of dashboard.stats) {
    const show = showById.get(s.showId);
    if (!show) continue;

    if (s.offersSent > 0) {
      offers.push({
        key: `offers-${s.showId}`,
        icon: <EnvelopeSimple className="w-5 h-5 text-stage-500" weight="duotone" />,
        text: `${plural(s.offersSent, "offer")} awaiting response on ${show.title}`,
        href: `/shows/${s.showId}/casting`,
      });
    }
    if (s.callbacksPending > 0) {
      callbackItems.push({
        key: `callbacks-${s.showId}`,
        icon: <BellRinging className="w-5 h-5 text-stage-500" weight="duotone" />,
        text: `${plural(s.callbacksPending, "callback")} ready to send on ${show.title}`,
        href: `/shows/${s.showId}/callbacks`,
      });
    }
    if (show.status === "auditions_open" && s.slotsTotal > 0) {
      const slotsLeft = Math.max(0, s.slotsTotal - s.signupCount);
      const parts = [
        `${s.signupCount} signed up`,
        `${plural(slotsLeft, "slot")} left`,
      ];
      if (s.daysUntilAuditions != null) {
        parts.push(
          s.daysUntilAuditions === 0
            ? "auditions today"
            : `auditions in ${plural(s.daysUntilAuditions, "day")}`
        );
      }
      filling.push({
        key: `filling-${s.showId}`,
        icon: <UsersThree className="w-5 h-5 text-stage-500" weight="duotone" />,
        text: `${show.title}: ${parts.join(" · ")}`,
        href: `/shows/${s.showId}/auditions`,
      });
    }
    if (show.status === "setup" && (!s.hasRoles || !s.hasSchedule)) {
      setup.push({
        key: `setup-${s.showId}`,
        icon: <Wrench className="w-5 h-5 text-stage-500" weight="duotone" />,
        text: `Finish setting up ${show.title}`,
        href: `/shows/${s.showId}/setup`,
      });
    }
  }

  // Urgency order: offers > callbacks > filling > setup
  return [...offers, ...callbackItems, ...filling, ...setup];
}

function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <Card variant="highlighted" padding="standard" className="mb-6 animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <WarningCircle className="w-5 h-5 text-stage-500" weight="duotone" />
        <SectionHeader className="mb-0">Needs your attention</SectionHeader>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-cream-50 transition-colors"
          >
            {item.icon}
            <span className="flex-1 text-sm text-curtain-800">{item.text}</span>
            <CaretRight className="w-4 h-4 text-clay-400 flex-shrink-0" weight="bold" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   Per-card status strip (additive — under existing content)
   ============================================================ */

function getStatusStrip(show: Show, stats: ShowDashboardStats | undefined): string | null {
  if (!stats) return null;
  switch (show.status) {
    case "auditions_open": {
      const parts = [`${stats.signupCount} signed up`];
      if (stats.slotsTotal > 0) {
        parts.push(`${plural(Math.max(0, stats.slotsTotal - stats.signupCount), "slot")} left`);
      }
      if (stats.daysUntilAuditions != null) {
        parts.push(
          stats.daysUntilAuditions === 0
            ? "auditions today"
            : `auditions in ${plural(stats.daysUntilAuditions, "day")}`
        );
      }
      return parts.join(" · ");
    }
    case "auditions_closed":
      return `${stats.signupCount} signed up · ready for callbacks`;
    case "callbacks": {
      if (stats.callbacksTotal === 0) return "No callbacks yet";
      const sent = stats.callbacksTotal - stats.callbacksPending;
      return `${sent} of ${stats.callbacksTotal} callbacks sent · ${stats.callbacksAccepted} accepted`;
    }
    case "casting": {
      const out = stats.offersSent + stats.offersAccepted + stats.offersDeclined;
      if (out === 0) {
        return stats.offersDraft > 0
          ? `${plural(stats.offersDraft, "offer")} drafted · none sent yet`
          : "No offers yet";
      }
      const responded = stats.offersAccepted + stats.offersDeclined;
      return `${responded} of ${out} responded · ${stats.offersAccepted} accepted`;
    }
    default:
      return null; // setup / cast / archived — no strip
  }
}

/* ============================================================
   Offer tracker (collapsible)
   ============================================================ */

const OFFER_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  sent: { label: "Pending", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "danger" },
};

function OfferTracker({ offers }: { offers: OrgDashboard["offers"] }) {
  const [open, setOpen] = useState(true);

  // Group by show, pending offers first within each show
  const byShow = new Map<string, OrgDashboard["offers"]>();
  for (const offer of offers) {
    const list = byShow.get(offer.showId) ?? [];
    list.push(offer);
    byShow.set(offer.showId, list);
  }
  const statusRank: Record<string, number> = { sent: 0, accepted: 1, declined: 2 };

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-stage-300"
      >
        <div className="flex items-center gap-2">
          <ClipboardText className="w-4 h-4 text-stage-500" weight="duotone" />
          <SectionHeader className="mb-0">
            Offer tracker · {offers.length}
          </SectionHeader>
        </div>
        {open ? (
          <CaretUp className="w-4 h-4 text-clay-400" weight="bold" />
        ) : (
          <CaretDown className="w-4 h-4 text-clay-400" weight="bold" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-3 mt-3">
          {Array.from(byShow.entries()).map(([showId, showOffers]) => (
            <Card key={showId} variant="flat" padding="standard">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-display text-curtain-900">
                  {showOffers[0].showTitle}
                </h4>
                <Link
                  href={`/shows/${showId}/casting`}
                  className="text-xs font-semibold text-stage-600 hover:text-stage-700 flex items-center gap-0.5"
                >
                  Casting board
                  <CaretRight className="w-3.5 h-3.5" weight="bold" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase pb-2 pr-3">Actor</th>
                      <th className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase pb-2 pr-3">Role</th>
                      <th className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase pb-2 pr-3">Status</th>
                      <th className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase pb-2">Responded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showOffers
                      .slice()
                      .sort(
                        (a, b) =>
                          (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3) ||
                          a.actorName.localeCompare(b.actorName)
                      )
                      .map((offer) => {
                        const badge = OFFER_BADGE[offer.status] ?? OFFER_BADGE.sent;
                        return (
                          <tr key={offer.id} className="border-t border-cream-100">
                            <td className="py-2 pr-3 font-medium text-curtain-900 whitespace-nowrap">
                              {offer.actorName}
                            </td>
                            <td className="py-2 pr-3 text-clay-500 whitespace-nowrap">
                              {offer.roleName}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge variant={badge.variant} size="sm">
                                {badge.label}
                              </Badge>
                            </td>
                            <td className="py-2 text-xs text-clay-500 whitespace-nowrap">
                              {offer.respondedAt ? formatDate(offer.respondedAt) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Upcoming dates timeline
   ============================================================ */

type UpcomingDate = {
  key: string;
  showTitle: string;
  label: string;
  date: string;
  href: string;
};

function isTodayOrFuture(dateStr: string): boolean {
  const target = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (isNaN(target.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target.getTime() >= today.getTime();
}

function buildUpcomingDates(activeShows: Show[]): UpcomingDate[] {
  const dates: UpcomingDate[] = [];
  for (const show of activeShows) {
    const candidates: { label: string; date: string | null; href: string }[] = [
      { label: "Auditions begin", date: show.auditionStart, href: `/shows/${show.id}/auditions` },
      { label: "Callbacks", date: show.callbackDate, href: `/shows/${show.id}/callbacks` },
      { label: "First rehearsal", date: show.rehearsalStart, href: getShowHref(show.id, show.status) },
      { label: "Opening night", date: show.showOpen, href: getShowHref(show.id, show.status) },
    ];
    for (const c of candidates) {
      if (c.date && isTodayOrFuture(c.date)) {
        dates.push({
          key: `${show.id}-${c.label}`,
          showTitle: show.title,
          label: c.label,
          date: c.date,
          href: c.href,
        });
      }
    }
  }
  return dates
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);
}

function UpcomingTimeline({ dates }: { dates: UpcomingDate[] }) {
  return (
    <div>
      <SectionHeader>Coming up</SectionHeader>
      {dates.length > 0 ? (
        <div className="flex flex-col gap-3">
          {dates.map((d) => (
            <Link key={d.key} href={d.href}>
              <Card variant="flat" padding="compact" interactive>
                <div className="flex items-center gap-3">
                  {/* Date-only strings parse as UTC — pin to local midnight */}
                  <DateBlock date={d.date.length === 10 ? `${d.date}T00:00:00` : d.date} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-curtain-900 truncate">
                      {d.label}
                    </p>
                    <p className="text-xs text-clay-500 truncate">{d.showTitle}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card variant="sunken" padding="standard">
          <p className="text-sm text-clay-500">
            No upcoming dates on the calendar — schedule auditions to see them here.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function ShowsListPage() {
  const { org, isLoading: orgLoading } = useOrg();
  const orgId = org?.id;

  const [filter, setFilter] = useState<ShowStatus | "all">("all");

  const { data: shows, isLoading } = useQuery({
    queryKey: ["shows", orgId],
    queryFn: () => getShows({ orgId: orgId! }),
    enabled: !!orgId,
  });

  // Command-center aggregation — its own query so the LOCKED shows grid
  // never waits on it. Failures degrade to an empty dashboard.
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["orgDashboard", orgId],
    queryFn: () => getOrgDashboard(orgId!),
    enabled: !!orgId,
  });

  if (orgLoading || isLoading) return <PageSkeleton />;

  const filtered = filter === "all"
    ? shows
    : shows?.filter((s) => s.status === filter);

  const showById = new Map((shows ?? []).map((s) => [s.id, s]));
  const statsByShow = new Map(
    (dashboard?.stats ?? []).map((s) => [s.showId, s])
  );
  const attentionItems = dashboard
    ? buildAttentionItems(dashboard, showById)
    : [];
  const activeShows = (shows ?? []).filter(
    (s) => s.status !== "cast" && s.status !== "archived"
  );
  const upcomingDates = buildUpcomingDates(activeShows);
  const hasShows = (shows?.length ?? 0) > 0;

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

      {/* Needs your attention — own skeleton; only rendered when non-empty */}
      {hasShows && dashboardLoading && (
        <div className="mb-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      )}
      {!dashboardLoading && attentionItems.length > 0 && (
        <AttentionPanel items={attentionItems} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
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
              {filtered.map((show) => {
                const strip = getStatusStrip(show, statsByShow.get(show.id));
                return (
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
                        {strip && (
                          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-clay-500">
                            <UsersThree className="w-3.5 h-3.5 text-stage-500 flex-shrink-0" weight="duotone" />
                            {strip}
                          </p>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
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

          {/* Offer tracker */}
          {dashboard && dashboard.offers.length > 0 && (
            <OfferTracker offers={dashboard.offers} />
          )}
        </div>

        {/* Upcoming dates — right column on desktop, below on mobile */}
        {hasShows && (
          <aside className="animate-fade-up" style={{ animationDelay: "150ms" }}>
            <UpcomingTimeline dates={upcomingDates} />
          </aside>
        )}
      </div>
    </div>
  );
}
