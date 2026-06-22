"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getOrg,
  getShows,
  getVenues,
  getOrgLeadership,
  getOrgPhotos,
  getOrgPastProductions,
} from "@/lib/api/client";
import { ShowCard } from "@/components/shows/ShowCard";
import {
  Avatar,
  Card,
  SectionHeader,
  PageSkeleton,
  EmptyState,
  Markdown,
  Lightbox,
  type LightboxPhoto,
} from "@/components/ui";
import type { SpaceType } from "@/types";
import {
  MapPin,
  Globe,
  MaskHappy,
  Buildings,
  Scroll,
  FacebookLogo,
  InstagramLogo,
  Ticket,
  Wheelchair,
  Car,
  UsersThree,
  Armchair,
  CalendarStar,
} from "@phosphor-icons/react";
import type { Show } from "@/types";

/* ============================================================
   Public theatre page — the REPUTATION surface.
   Answers "Should I audition / work HERE?" for actors AND
   directors/designers/crew evaluating the company. Empty
   sections are omitted entirely (no visitor-facing prompts).
   ============================================================ */

const mapSearchUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export default function TheatrePage() {
  const { orgId } = useParams<{ orgId: string }>();

  const { data: org, isLoading } = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => getOrg(orgId),
  });

  const { data: shows } = useQuery({
    queryKey: ["orgShows", orgId],
    queryFn: () => getShows({ orgId }),
    enabled: !!org,
  });

  const { data: venues } = useQuery({
    queryKey: ["venues", orgId],
    queryFn: () => getVenues(orgId),
    enabled: !!org,
  });

  const { data: leadership } = useQuery({
    queryKey: ["orgLeadership", orgId],
    queryFn: () => getOrgLeadership(orgId),
    enabled: !!org,
  });

  const { data: photos } = useQuery({
    queryKey: ["orgPhotos", orgId],
    queryFn: () => getOrgPhotos(orgId),
    enabled: !!org,
  });

  const { data: manualPast } = useQuery({
    queryKey: ["orgPastProductions", orgId],
    queryFn: () => getOrgPastProductions(orgId),
    enabled: !!org,
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (isLoading) return <PageSkeleton />;

  if (!org) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <EmptyState
          icon={<Buildings className="w-12 h-12" weight="duotone" />}
          title="Theatre not found"
          description="This company page doesn't exist or has been removed."
        />
      </div>
    );
  }

  const allShows = shows ?? [];
  const openCalls = allShows.filter((s) => s.status === "auditions_open");
  // Upcoming season: anything public and not yet closed — not just open calls.
  const upcoming = allShows
    .filter((s) => !["setup", "archived"].includes(s.status))
    .sort((a, b) => (a.showOpen ?? a.auditionStart ?? "").localeCompare(b.showOpen ?? b.auditionStart ?? ""));
  // Past productions: auto-derived (cast/archived shows) MERGED with manual
  // history entries, sorted by year (newest first).
  const yearOf = (s: string | null) => (s ? Number(s.slice(0, 4)) || null : null);
  const autoPast = allShows
    .filter((s) => s.status === "cast" || s.status === "archived")
    .map((s) => ({
      key: `show-${s.id}`,
      title: s.title,
      year: yearOf(s.showOpen) ?? yearOf(s.auditionStart),
      detail: s.season ?? null,
    }));
  const manualPastEntries = (manualPast ?? []).map((p) => ({
    key: `manual-${p.id}`,
    title: p.title,
    year: p.year,
    detail: p.notes,
  }));
  const pastProductions = [...autoPast, ...manualPastEntries].sort(
    (a, b) => (b.year ?? 0) - (a.year ?? 0)
  );

  const productionCount = allShows.filter((s) =>
    ["auditions_open", "auditions_closed", "callbacks", "casting", "cast", "archived"].includes(s.status)
  ).length;

  // Spaces grouped by type: Main Stage (performance) first, then Rehearsal, then Other.
  const venueList = venues ?? [];
  const SPACE_GROUPS: { type: SpaceType; label: string }[] = [
    { type: "performance", label: "Main Stage" },
    { type: "rehearsal", label: "Rehearsal" },
    { type: "other", label: "Other" },
  ];
  const SPACE_TYPE_LABEL: Record<SpaceType, string> = {
    performance: "Performance",
    rehearsal: "Rehearsal",
    other: "Other",
  };
  const groupedSpaces = SPACE_GROUPS.map((g) => ({
    ...g,
    venues: venueList.filter((v) => v.spaceType === g.type),
  })).filter((g) => g.venues.length > 0);

  const leaders = leadership ?? [];
  const gallery = photos ?? [];
  const lightboxPhotos: LightboxPhoto[] = gallery.map((p) => ({
    url: p.publicUrl,
    caption: p.caption,
    label: p.kind === "venue" ? "Venue" : "Production",
  }));

  const mission = org.mission ?? org.description;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* ===== Hero ===== */}
      <div className="flex items-center gap-4 mb-4">
        <Avatar
          name={org.name}
          imageUrl={org.logoUrl}
          variant="org"
          size="xl"
          className="bg-stage-100 text-stage-700"
        />
        <div className="min-w-0">
          <h1 className="text-3xl font-display text-curtain-900">{org.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-clay-500">
            {(org.city || org.state) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {[org.city, org.state].filter(Boolean).join(", ")}
              </span>
            )}
            {org.foundedYear && (
              <span className="flex items-center gap-1.5">
                <CalendarStar className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                Est. {org.foundedYear}
              </span>
            )}
            {productionCount > 0 && (
              <span className="flex items-center gap-1.5">
                <MaskHappy className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                {productionCount} production{productionCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Links row — website + socials + ticketing as icon buttons */}
      {(org.websiteUrl || org.facebookUrl || org.instagramUrl || org.ticketingUrl) && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {org.websiteUrl && (
            <LinkButton href={org.websiteUrl} label="Website">
              <Globe className="w-4 h-4 text-stage-500" weight="duotone" />
            </LinkButton>
          )}
          {org.facebookUrl && (
            <LinkButton href={org.facebookUrl} label="Facebook">
              <FacebookLogo className="w-4 h-4 text-stage-500" weight="duotone" />
            </LinkButton>
          )}
          {org.instagramUrl && (
            <LinkButton href={org.instagramUrl} label="Instagram">
              <InstagramLogo className="w-4 h-4 text-stage-500" weight="duotone" />
            </LinkButton>
          )}
          {org.ticketingUrl && (
            <LinkButton href={org.ticketingUrl} label="Buy Tickets">
              <Ticket className="w-4 h-4 text-stage-500" weight="duotone" />
            </LinkButton>
          )}
        </div>
      )}

      {/* ===== Mission / About ===== */}
      {mission && (
        <div className="mb-6">
          <SectionHeader>About</SectionHeader>
          <Card variant="flat">
            <Markdown>{mission}</Markdown>
          </Card>
        </div>
      )}

      <hr className="gold-line" />

      {/* ===== Key People ===== */}
      {leaders.length > 0 && (
        <div className="mb-6">
          <SectionHeader>Key People</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {leaders.map((leader) => (
              <Card key={leader.id} variant="flat" padding="compact" className="text-center">
                <div className="flex justify-center mb-2">
                  <Avatar name={leader.name} imageUrl={leader.photoUrl} size="lg" />
                </div>
                <p className="text-sm font-semibold text-curtain-900 truncate">{leader.name}</p>
                {leader.title && (
                  <p className="text-xs text-clay-500 truncate">{leader.title}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===== Spaces (grouped by type) ===== */}
      {groupedSpaces.length > 0 && (
        <div className="mb-6">
          <SectionHeader>Spaces</SectionHeader>
          <div className="flex flex-col gap-5">
            {groupedSpaces.map((group) => (
              <div key={group.type}>
                <p className="text-[11px] font-semibold text-clay-400 tracking-wide uppercase mb-2">
                  {group.label}
                </p>
                <div className="flex flex-col gap-3">
                  {group.venues.map((venue) => (
                    <Card key={venue.id} variant="flat">
                      <div className="flex items-start gap-3">
                        <Buildings className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-display text-curtain-900">{venue.name}</p>
                            {venue.isPrimary && (
                              <span className="text-[10px] font-semibold text-stage-600 tracking-wide uppercase">
                                Main Stage
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                              {SPACE_TYPE_LABEL[venue.spaceType]}
                            </span>
                          </div>
                          {venue.address && (
                            <a
                              href={mapSearchUrl(venue.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-clay-500 hover:text-curtain-800 transition mt-0.5"
                            >
                              <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                              {venue.address}
                              <span className="text-stage-600 whitespace-nowrap">· View on map</span>
                            </a>
                          )}

                          <div className="flex flex-col gap-1.5 mt-3">
                            {venue.capacity != null && (
                              <p className="flex items-center gap-2 text-sm text-curtain-800">
                                <Armchair className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                                Seats {venue.capacity}
                              </p>
                            )}
                            {venue.accessibilityNotes && (
                              <p className="flex items-start gap-2 text-sm text-curtain-800">
                                <Wheelchair className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                                <span>{venue.accessibilityNotes}</span>
                              </p>
                            )}
                            {venue.parkingNotes && (
                              <p className="flex items-start gap-2 text-sm text-curtain-800">
                                <Car className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                                <span>{venue.parkingNotes}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Upcoming Season ===== */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <SectionHeader>Upcoming Season</SectionHeader>
          <div className="flex flex-col gap-2">
            {upcoming.map((show) => (
              <SeasonRow key={show.id} show={show} />
            ))}
          </div>
        </div>
      )}

      {/* ===== Open Auditions ===== */}
      {openCalls.length > 0 && (
        <div className="mb-6">
          <SectionHeader>Open Auditions</SectionHeader>
          <div className="flex flex-col gap-4">
            {openCalls.map((show) => (
              <ShowCard key={show.id} show={show} linkTo={`/auditions/${show.id}`} />
            ))}
          </div>
        </div>
      )}

      {/* ===== Photo gallery ===== */}
      {gallery.length > 0 && (
        <div className="mb-6">
          <SectionHeader>Photos</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gallery.map((photo, i) => (
              <figure key={photo.id} className="overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="block w-full focus:outline-none focus:ring-2 focus:ring-stage-300 rounded-xl overflow-hidden"
                  aria-label={`View ${photo.caption ?? photo.kind} photo`}
                >
                  <img
                    src={photo.publicUrl}
                    alt={photo.caption ?? `${org.name} ${photo.kind} photo`}
                    className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
                <figcaption className="flex items-center gap-1.5 mt-1 px-0.5">
                  <span className="text-[10px] font-semibold text-stage-600 tracking-wide uppercase">
                    {photo.kind === "venue" ? "Venue" : "Production"}
                  </span>
                  {photo.caption && (
                    <span className="text-[11px] text-clay-500 truncate">{photo.caption}</span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* ===== Past Productions ===== */}
      {pastProductions.length > 0 && (
        <div className="mb-6">
          <SectionHeader>Past Productions</SectionHeader>
          <div className="flex flex-col gap-2">
            {pastProductions.map((p) => (
              <div key={p.key} className="flex items-start gap-2.5">
                <MaskHappy className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                <p className="text-sm text-curtain-800">
                  <span className="font-display">{p.title}</span>
                  {p.year && <span className="text-clay-500"> — {p.year}</span>}
                  {p.detail && <span className="text-clay-500 block text-xs mt-0.5">{p.detail}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Code of Conduct ===== */}
      {org.codeOfConduct && (
        <div className="mb-6">
          <SectionHeader>Code of Conduct</SectionHeader>
          <Card variant="flat">
            <div className="flex items-start gap-3">
              <Scroll className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
              <Markdown className="flex-1">{org.codeOfConduct}</Markdown>
            </div>
          </Card>
        </div>
      )}

      {/* If a brand-new theatre has nothing yet, a quiet single line. */}
      {!mission &&
        leaders.length === 0 &&
        venueList.length === 0 &&
        upcoming.length === 0 &&
        openCalls.length === 0 &&
        pastProductions.length === 0 &&
        !org.codeOfConduct && (
          <Card variant="sunken" className="text-center py-10">
            <UsersThree className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
            <p className="text-sm text-clay-500">
              This theatre is just getting started. Check back soon.
            </p>
          </Card>
        )}

      {/* Photo lightbox */}
      <Lightbox
        photos={lightboxPhotos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

function LinkButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cream-300 bg-white text-sm font-semibold text-curtain-700 hover:border-stage-400 hover:bg-stage-50 transition-colors"
    >
      {children}
      {label}
    </a>
  );
}

function SeasonRow({ show }: { show: Show }) {
  const isOpen = show.status === "auditions_open";
  const content = (
    <Card variant="flat" padding="compact" interactive={isOpen}>
      <div className="flex items-center gap-3">
        {show.posterUrl ? (
          <img
            src={show.posterUrl}
            alt={`${show.title} poster`}
            className="w-10 h-14 rounded-lg object-cover flex-shrink-0 bg-cream-100"
          />
        ) : (
          <div className="w-10 h-14 rounded-lg bg-stage-100 flex items-center justify-center flex-shrink-0">
            <MaskHappy className="w-5 h-5 text-stage-500" weight="duotone" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display text-curtain-900 truncate">{show.title}</p>
          <p className="text-xs text-clay-500">
            {show.showType === "musical" ? "Musical" : show.showType === "play" ? "Play" : "Revue"}
            {show.season && ` · ${show.season}`}
          </p>
        </div>
        {isOpen && (
          <span className="text-[10px] font-semibold text-stage-600 tracking-wide uppercase flex-shrink-0">
            Auditioning
          </span>
        )}
      </div>
    </Card>
  );
  if (isOpen) {
    // Link to the audition page when there's an open call.
    return (
      <a href={`/auditions/${show.id}`} className="block">
        {content}
      </a>
    );
  }
  return content;
}
