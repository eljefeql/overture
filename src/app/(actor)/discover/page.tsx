"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { getOpenAuditions, getActor } from "@/lib/api/client";
import type { DiscoverFilters } from "@/lib/api/client";
import type { Show } from "@/types";
import { ShowCard } from "@/components/shows/ShowCard";
import { EmptyState, PageSkeleton, SectionHeader } from "@/components/ui";
import {
  MagnifyingGlass,
  MaskHappy,
  MapPin,
  FunnelSimple,
  CaretDown,
} from "@phosphor-icons/react";

/* ============================================================
   Filter options
   ============================================================ */

const RADIUS_OPTIONS = [
  { value: 15, label: "15 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
  { value: null, label: "Anywhere" },
] as const;

const TYPE_OPTIONS = [
  { value: "all" as const, label: "All Types" },
  { value: "musical" as const, label: "Musicals" },
  { value: "play" as const, label: "Plays" },
  { value: "revue" as const, label: "Revues" },
];

const SORT_OPTIONS = [
  { value: "suggested" as const, label: "Suggested" },
  { value: "newest" as const, label: "Newest" },
  { value: "date" as const, label: "Audition Date" },
  { value: "distance" as const, label: "Distance" },
];

/* ============================================================
   Page
   ============================================================ */

export default function DiscoverPage() {
  const { user } = useAuth();

  // Get actor profile for default radius + city
  const { data: actor } = useQuery({
    queryKey: ["actor", user?.id],
    queryFn: () => getActor(user?.id ?? ""),
    enabled: !!user,
  });

  const profileRadius = actor?.profile?.travelRadius ?? 25;
  const profileCity = actor?.profile?.locationCity ?? "Riverside";
  const profileState = actor?.profile?.locationState ?? "CA";

  // Filter state (NOT tied to profile)
  const [radius, setRadius] = useState<number | null>(null); // null until profile loads
  const [showType, setShowType] = useState<DiscoverFilters["showType"]>("all");
  const [sortBy, setSortBy] = useState<DiscoverFilters["sortBy"]>("suggested");
  const [search, setSearch] = useState("");
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

  // Use profile radius as default once loaded
  const activeRadius = radius ?? profileRadius;

  const filters: DiscoverFilters = { radius: activeRadius, showType, sortBy };

  const { data: shows, isLoading } = useQuery({
    queryKey: ["openAuditions", filters],
    queryFn: () => getOpenAuditions(filters),
  });

  // Client-side search filter
  const filteredShows = shows?.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.orgName.toLowerCase().includes(q) ||
      (s.authorInfo?.toLowerCase().includes(q) ?? false)
    );
  });

  // Split into sections
  const promoted = filteredShows?.filter((s) => s.isPromoted) ?? [];
  const forYou = filteredShows?.filter((s) => !s.isPromoted && (s.distanceMiles ?? 999) <= activeRadius) ?? [];
  const nearby = filteredShows?.filter((s) => !s.isPromoted && (s.distanceMiles ?? 999) > activeRadius) ?? [];

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Search bar */}
      <div className="relative mb-4">
        <MagnifyingGlass
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-clay-400"
          weight="bold"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shows & theatres..."
          className="w-full pl-12 pr-4 py-4 text-base rounded-2xl border border-cream-200 bg-white shadow-sm placeholder:text-clay-400 focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300 outline-none"
        />
      </div>

      {/* Radius banner */}
      <div className="relative mb-4">
        <button
          onClick={() => setShowRadiusPicker(!showRadiusPicker)}
          className="flex items-center gap-1.5 text-sm text-curtain-700 hover:text-curtain-900 transition"
        >
          <MapPin className="w-4 h-4 text-stage-500" weight="duotone" />
          Auditions within{" "}
          <span className="font-semibold text-curtain-900">
            {activeRadius ? `${activeRadius} mi` : "anywhere"}
          </span>{" "}
          of {profileCity}, {profileState}
          <CaretDown className="w-3.5 h-3.5 text-clay-400" weight="bold" />
        </button>

        {/* Radius picker dropdown */}
        {showRadiusPicker && (
          <div className="absolute top-8 left-0 z-20 bg-white rounded-xl border border-cream-200 shadow-lg py-1 animate-scale-in">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  setRadius(opt.value);
                  setShowRadiusPicker(false);
                }}
                className={`block w-full px-4 py-2 text-sm text-left transition-colors ${
                  activeRadius === opt.value
                    ? "bg-stage-50 text-stage-700 font-semibold"
                    : "text-curtain-700 hover:bg-cream-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort / Filter bar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        <FunnelSimple className="w-4 h-4 text-clay-400 flex-shrink-0" weight="bold" />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as DiscoverFilters["sortBy"])}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-cream-200 bg-white text-curtain-700 outline-none focus:ring-2 focus:ring-curtain-200"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Type filter */}
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setShowType(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                showType === opt.value
                  ? "bg-stage-100 text-stage-700"
                  : "text-clay-400 hover:text-clay-600 hover:bg-cream-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filteredShows && filteredShows.length > 0 ? (
        <div className="animate-fade-up">
          {/* Promoted section */}
          {promoted.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-col gap-4">
                {promoted.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    linkTo={`/auditions/${show.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* For You section */}
          {forYou.length > 0 && (
            <div className="mb-6">
              <SectionHeader>For You</SectionHeader>
              <div className="flex flex-col gap-4">
                {forYou.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    linkTo={`/auditions/${show.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Beyond radius — shows further out the actor might still consider */}
          {nearby.length > 0 && (
            <div className="mb-6">
              <SectionHeader>Further Out</SectionHeader>
              <div className="flex flex-col gap-4">
                {nearby.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    linkTo={`/auditions/${show.id}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<MaskHappy className="w-12 h-12" weight="duotone" />}
          title="No auditions match your filters"
          description="Try widening your radius or changing your filters."
        />
      )}
    </div>
  );
}
