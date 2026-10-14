"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";
import { SHOW_STATUS_LABELS, SHOW_STATUS_BADGE } from "@/lib/constants";
import { getAuditionGroups, getCallbacks, getCastAssignments } from "@/lib/api/client";
import type { ShowStatus } from "@/types";

/* ============================================================
   ProductionSubNav — Tier 2 show-scoped navigation

   Setup · Auditions · Callbacks · Casting · Cast List
   + Show status badge on the right

   Precast shows (spec Feature 2) are module-aware: tabs for
   audition machinery the show never used are hidden — EXCEPT
   the Casting board, which stays reachable by owner decision
   (its supplemental-call card is how a precast show later
   recruits). A hidden module reappears the moment it's used
   (e.g. a casting call creates audition blocks). Non-precast
   shows render byte-identically to before.
   ============================================================ */

type Props = {
  showId: string;
  showStatus?: ShowStatus;
  /** shows.precast (migration 024) — enables module-aware tabs. */
  precast?: boolean;
};

// Status phase ordering — tabs up to and including the current phase are accessible
const STATUS_PHASE_ORDER: Record<ShowStatus, number> = {
  setup: 0,
  auditions_open: 1,
  auditions_closed: 1,
  callbacks: 2,
  casting: 3,
  cast: 4,
  archived: 4,
};

const TAB_PHASE: Record<string, number> = {
  setup: 0,
  auditions: 1,
  conflicts: 1, // conflict data exists as soon as signups do
  callbacks: 2,
  casting: 3,
  offers: 3, // offers exist as soon as casting begins
  "cast-list": 4,
  hub: 4, // the hub comes alive once the cast is published
};

export function ProductionSubNav({ showId, showStatus = "setup", precast = false }: Props) {
  const pathname = usePathname();
  const currentPhase = STATUS_PHASE_ORDER[showStatus];

  // Precast only: which audition modules has this show actually used?
  // (Disabled — and therefore zero extra fetches — for every other show.)
  const { data: modules } = useQuery({
    queryKey: ["precastModules", showId],
    queryFn: async () => {
      const [groups, cbs, assignments] = await Promise.all([
        getAuditionGroups(showId),
        getCallbacks(showId),
        getCastAssignments(showId),
      ]);
      return {
        hasAuditions: groups.length > 0,
        hasCallbacks: cbs.length > 0,
        // Offers = an actual offer dance happened (direct adds don't count).
        hasOffers: assignments.some(
          (a) => !a.addedDirectly && a.status !== "withdrawn"
        ),
      };
    },
    enabled: precast,
  });

  const allTabs = [
    { href: `/shows/${showId}/setup`, label: "Setup", segment: "setup" },
    { href: `/shows/${showId}/auditions`, label: "Auditions", segment: "auditions" },
    { href: `/shows/${showId}/conflicts`, label: "Conflicts", segment: "conflicts" },
    { href: `/shows/${showId}/callbacks`, label: "Callbacks", segment: "callbacks" },
    { href: `/shows/${showId}/casting`, label: "Casting", segment: "casting" },
    { href: `/shows/${showId}/offers`, label: "Offers", segment: "offers" },
    { href: `/shows/${showId}/cast-list`, label: "Cast List", segment: "cast-list" },
    { href: `/shows/${showId}/hub`, label: "Hub", segment: "hub" },
  ];

  // Module-aware filter — precast shows only. Setup / Casting / Cast List /
  // Hub always stay; a hidden tab also stays if it's the CURRENT page
  // (never strand the user on a tabless route).
  const tabs = precast
    ? allTabs.filter((tab) => {
        if (pathname?.includes(`/${tab.segment}`)) return true;
        switch (tab.segment) {
          case "auditions":
            return modules?.hasAuditions ?? false;
          case "conflicts":
            // Always: cast record conflicts on the Hub ("My conflicts"),
            // so the Conflict Calendar is useful without any auditions.
            return true;
          case "callbacks":
            return modules?.hasCallbacks ?? false;
          case "offers":
            return modules?.hasOffers ?? false;
          default:
            return true; // setup · casting · cast-list · hub
        }
      })
    : allTabs;

  const isActive = (segment: string) => {
    return pathname?.includes(`/${segment}`);
  };

  const isAccessible = (segment: string) => {
    return (TAB_PHASE[segment] ?? 0) <= currentPhase;
  };

  return (
    <div className="bg-curtain-800 border-t border-curtain-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-10">
          {/* Tabs — scrollable on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const accessible = isAccessible(tab.segment);
              const active = isActive(tab.segment);

              if (!accessible) {
                return (
                  <span
                    key={tab.segment}
                    className="px-3 py-2 text-sm font-medium whitespace-nowrap text-curtain-600 cursor-not-allowed"
                  >
                    {tab.label}
                  </span>
                );
              }

              return (
                <Link
                  key={tab.segment}
                  href={tab.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium whitespace-nowrap transition relative",
                    active
                      ? "text-white"
                      : "text-curtain-400 hover:text-curtain-200"
                  )}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-stage-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Status badge */}
          <Badge
            variant={SHOW_STATUS_BADGE[showStatus]}
            size="sm"
            className="flex-shrink-0 ml-4"
          >
            {SHOW_STATUS_LABELS[showStatus]}
          </Badge>
        </div>
      </div>
    </div>
  );
}
