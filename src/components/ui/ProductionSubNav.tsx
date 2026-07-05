"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";
import { SHOW_STATUS_LABELS, SHOW_STATUS_BADGE } from "@/lib/constants";
import type { ShowStatus } from "@/types";

/* ============================================================
   ProductionSubNav — Tier 2 show-scoped navigation

   Setup · Auditions · Callbacks · Casting · Cast List
   + Show status badge on the right
   ============================================================ */

type Props = {
  showId: string;
  showStatus?: ShowStatus;
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
  "cast-list": 4,
};

export function ProductionSubNav({ showId, showStatus = "setup" }: Props) {
  const pathname = usePathname();
  const currentPhase = STATUS_PHASE_ORDER[showStatus];

  const tabs = [
    { href: `/shows/${showId}/setup`, label: "Setup", segment: "setup" },
    { href: `/shows/${showId}/auditions`, label: "Auditions", segment: "auditions" },
    { href: `/shows/${showId}/conflicts`, label: "Conflicts", segment: "conflicts" },
    { href: `/shows/${showId}/callbacks`, label: "Callbacks", segment: "callbacks" },
    { href: `/shows/${showId}/casting`, label: "Casting", segment: "casting" },
    { href: `/shows/${showId}/cast-list`, label: "Cast List", segment: "cast-list" },
  ];

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
