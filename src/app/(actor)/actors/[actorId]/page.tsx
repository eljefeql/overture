"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getActor } from "@/lib/api/client";
import { getProfilePhotos } from "@/lib/api/photos";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  Avatar,
  Card,
  Badge,
  Pill,
  VerifiedBadge,
  PageSkeleton,
  EmptyState,
  StatBlock,
  SectionHeader,
  Lightbox,
  type LightboxPhoto,
} from "@/components/ui";
import { formatHeight } from "@/lib/utils";
import {
  ArrowLeft,
  MaskHappy,
  GraduationCap,
  Trophy,
  Quotes,
  Star,
  Heart,
  FilmSlate,
} from "@phosphor-icons/react";

/* ============================================================
   Viewable actor profile — /actors/[actorId] (QC item 21).

   PUBLIC TIER ONLY, available to any SIGNED-IN user (the route
   lives in the (actor) group behind AuthGuard — never anonymous).
   Rendered: headshot, name, pronouns, vitals (height / vocal
   range / age range / dance styles), acting + crew credits,
   special skills, training, awards, bucket list, endorsements,
   and the public production photo gallery.

   DELIBERATELY EXCLUDED (owner privacy line): contact info,
   measurements & sizing, location / travel radius, dealbreakers,
   accessibility needs, guardian details, resume. The Minor badge
   IS shown — it's safety-relevant context, not private data.

   Read-only — no edit affordances anywhere. Display patterns
   mirror /profile so the two stay visually identical.
   ============================================================ */

export default function ActorPublicProfilePage() {
  const { actorId } = useParams<{ actorId: string }>();
  const router = useRouter();

  const { data: actor, isLoading } = useQuery({
    queryKey: ["actor", actorId],
    queryFn: () => getActor(actorId),
    enabled: !!actorId,
  });

  // Public production gallery (cloud-only; profile_photos is authenticated-
  // readable). Errors degrade to an empty gallery, never a crash.
  const { data: photos = [] } = useQuery({
    queryKey: ["profilePhotos", actorId],
    queryFn: async () => {
      try {
        return await getProfilePhotos(actorId);
      } catch {
        return [];
      }
    },
    enabled: !!actorId && isSupabaseConfigured,
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (isLoading) return <PageSkeleton />;

  if (!actor) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <EmptyState
          icon={<MaskHappy className="w-12 h-12" weight="duotone" />}
          title="Profile not found"
          description="This profile doesn't exist or has been removed."
        />
      </div>
    );
  }

  const profile = actor.profile;

  // Public-tier vitals only — no location, no travel radius.
  const vitals: { label: string; value: string }[] = [];
  if (profile?.ageRangeLow && profile?.ageRangeHigh) {
    vitals.push({ label: "Age Range", value: `${profile.ageRangeLow}–${profile.ageRangeHigh}` });
  }
  if (profile?.heightInches) {
    vitals.push({ label: "Height", value: formatHeight(profile.heightInches) });
  }
  if (profile?.vocalRange) {
    vitals.push({ label: "Vocal Range", value: profile.vocalRange });
  }
  if (profile?.danceStyles && profile.danceStyles.length > 0) {
    vitals.push({ label: "Dance", value: profile.danceStyles.join(", ") });
  }

  const galleryPhotos = photos.filter((p) => p.kind === "production");
  const lightboxPhotos: LightboxPhoto[] = galleryPhotos.map((p) => ({
    url: p.publicUrl,
    caption: p.caption,
    label: p.showTitle,
  }));

  const totalCredits = actor.credits.length;
  const verifiedCount = actor.credits.filter((c) => c.verified).length;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-curtain-600 hover:text-curtain-900 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" weight="bold" />
        Back
      </button>

      {/* ===== HERO ===== */}
      <div className="mb-6 animate-fade-up">
        <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left md:gap-5">
          <div className="flex-shrink-0 mb-4 md:mb-0">
            <div className="ring-4 ring-stage-200 rounded-full">
              <Avatar name={actor.displayName} imageUrl={actor.avatarUrl} size="xl" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h1 className="text-3xl font-display text-curtain-900">
                {actor.displayName}
              </h1>
              {profile?.isMinor && (
                <Badge variant="warning" size="sm">Minor</Badge>
              )}
            </div>
            {actor.pronouns && (
              <p className="text-sm text-clay-500">{actor.pronouns}</p>
            )}
            {profile?.ageRangeLow && profile?.ageRangeHigh && (
              <p className="text-sm text-clay-600 mt-1">
                Age range: {profile.ageRangeLow}–{profile.ageRangeHigh}
              </p>
            )}
          </div>
        </div>
      </div>

      <hr className="gold-line" />

      {/* ===== BIO ===== */}
      {profile?.bio && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
          <Card variant="flat">
            <p className="text-sm text-curtain-800 leading-relaxed">{profile.bio}</p>
          </Card>
        </div>
      )}

      {/* ===== BUCKET LIST ===== */}
      {profile && profile.bucketListShows.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "75ms" }}>
          <SectionHeader>Bucket List</SectionHeader>
          <div className="flex flex-col gap-2">
            {profile.bucketListShows.map((show, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Star className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                <p className="text-sm text-curtain-800">
                  <span className="font-display">{show.title}</span>
                  {show.role && <span className="text-clay-500"> — {show.role}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== AT A GLANCE ===== */}
      {vitals.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <SectionHeader>At a Glance</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {vitals.map((v) => (
              <StatBlock key={v.label} label={v.label} value={v.value} />
            ))}
          </div>
        </div>
      )}

      {/* ===== ENDORSEMENTS ===== */}
      {actor.endorsements.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "150ms" }}>
          <SectionHeader>Endorsements</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {actor.endorsements.map((e) => (
              <span key={e.id} title={`From ${e.endorserName} — ${e.showTitle}`}>
                <Pill variant="endorsement" className="cursor-default">
                  {e.label}
                </Pill>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== PRODUCTION HISTORY ===== */}
      {actor.credits.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <SectionHeader>Production History</SectionHeader>
          <p className="text-xs text-clay-500 mb-3">
            {totalCredits} production{totalCredits !== 1 ? "s" : ""}
            {verifiedCount > 0 && ` · ${verifiedCount} verified`}
          </p>
          <div className="flex flex-col gap-3">
            {actor.credits.map((credit) => (
              <Card key={credit.id} variant="elevated" padding="compact">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-display text-curtain-900 truncate">
                        {credit.showTitle}
                      </p>
                      {credit.verified && <VerifiedBadge />}
                    </div>
                    <p className="text-sm text-curtain-700 mt-0.5">
                      {credit.roleName}
                      <span className="text-clay-400 mx-1.5">·</span>
                      <span className="text-clay-500">{credit.theatreName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {credit.likeCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-clay-400">
                        <Heart className="w-4 h-4 text-ruby-400" weight="duotone" />
                        {credit.likeCount}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-stage-600">
                      {credit.year}
                    </span>
                  </div>
                </div>

                {credit.kudos && (
                  <div className="mt-3 pt-3 border-t border-cream-200">
                    <div className="flex gap-2">
                      <Quotes
                        className="w-4 h-4 text-stage-400 flex-shrink-0 mt-0.5"
                        weight="fill"
                      />
                      <div>
                        <p className="text-xs text-curtain-700 leading-relaxed italic">
                          {credit.kudos.quote}
                        </p>
                        <p className="text-[11px] text-clay-400 mt-1">
                          — {credit.kudos.authorName}, {credit.kudos.authorRole}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===== PRODUCTION WORK (crew credits) ===== */}
      {actor.crewCredits.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "250ms" }}>
          <SectionHeader>Production Work</SectionHeader>
          <div className="flex flex-col gap-3">
            {actor.crewCredits.map((credit) => (
              <Card key={credit.id} variant="flat" padding="compact">
                <div className="flex items-start gap-3">
                  <FilmSlate
                    className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5"
                    weight="duotone"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-curtain-900">
                        {credit.position}
                      </p>
                      {credit.verified && <VerifiedBadge />}
                    </div>
                    <p className="text-sm text-curtain-700">
                      <span className="font-display">{credit.showTitle}</span>
                      <span className="text-clay-400 mx-1.5">·</span>
                      <span className="text-clay-500">{credit.theatreName}</span>
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-stage-600 flex-shrink-0">
                    {credit.year}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===== TRAINING & EDUCATION ===== */}
      {profile && profile.training.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <SectionHeader>Training & Education</SectionHeader>
          <div className="flex flex-col gap-3">
            {profile.training.map((t) => (
              <Card key={t.id} variant="flat" padding="compact">
                <div className="flex items-start gap-3">
                  <GraduationCap
                    className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5"
                    weight="duotone"
                  />
                  <div>
                    <p className="text-sm font-semibold text-curtain-900">
                      {t.institution}
                    </p>
                    <p className="text-sm text-curtain-700">{t.description}</p>
                    {t.years && (
                      <p className="text-xs text-clay-400 mt-0.5">{t.years}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===== AWARDS ===== */}
      {profile && profile.awards.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "350ms" }}>
          <SectionHeader>Awards & Recognition</SectionHeader>
          <div className="flex flex-col gap-3">
            {profile.awards.map((a) => (
              <Card key={a.id} variant="flat" padding="compact">
                <div className="flex items-start gap-3">
                  <Trophy
                    className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5"
                    weight="duotone"
                  />
                  <div>
                    <p className="text-sm font-semibold text-curtain-900">{a.title}</p>
                    <p className="text-xs text-clay-500">
                      {a.organization} · {a.year}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===== SPECIAL SKILLS ===== */}
      {profile && profile.specialSkills.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "400ms" }}>
          <SectionHeader>Special Skills</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {profile.specialSkills.map((skill) => (
              <Pill key={skill} variant="role" className="cursor-default">
                {skill}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* ===== PRODUCTION PHOTOS (public gallery, cloud-only) ===== */}
      {galleryPhotos.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "450ms" }}>
          <SectionHeader>Production Photos</SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            {galleryPhotos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setLightboxIndex(i)}
                className="relative aspect-square rounded-xl overflow-hidden bg-cream-100 group"
                aria-label={p.caption ? `View photo: ${p.caption}` : "View photo"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.publicUrl}
                  alt={p.caption ?? "Production photo"}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
              </button>
            ))}
          </div>
          <Lightbox
            photos={lightboxPhotos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        </div>
      )}

      {/* Quiet note about what ISN'T here, so viewers don't go hunting */}
      <p className="text-[11px] text-clay-400 text-center mt-8">
        This is {actor.displayName}&apos;s public profile. Contact details and
        private info are only shared with production teams of shows they join.
      </p>
    </div>
  );
}
