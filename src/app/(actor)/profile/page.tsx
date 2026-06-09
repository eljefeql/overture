"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { getActor } from "@/lib/api/client";
import {
  Avatar,
  Card,
  Badge,
  Pill,
  VerifiedBadge,
  Button,
  PageSkeleton,
  EmptyState,
  StatBlock,
  SectionHeader,
  PrivacyHeader,
} from "@/components/ui";
import { formatHeight, formatMeasurement } from "@/lib/utils";
import {
  PencilSimple,
  MapPin,
  Envelope,
  Phone,
  Camera,
  Heart,
  Images,
  GraduationCap,
  Trophy,
  Quotes,
  IdentificationBadge,
  MaskHappy,
} from "@phosphor-icons/react";
import { ProfileEditModal } from "@/components/profile/ProfileEditModal";
import type { ActorWithProfile } from "@/types";

/* ============================================================
   Union status display helper
   ============================================================ */

const UNION_LABELS: Record<string, string> = {
  non_union: "Non-Union",
  aea: "AEA",
  sag_aftra: "SAG-AFTRA",
  aea_sag: "AEA / SAG-AFTRA",
};

/* ============================================================
   Profile Page — Single scrollable actor showcase
   ============================================================ */

export default function ProfilePage() {
  const { user } = useAuth();
  const { data: actor, isLoading } = useQuery({
    queryKey: ["actor", user?.id],
    queryFn: () => getActor(user?.id ?? ""),
    enabled: !!user,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [likedCredits, setLikedCredits] = useState<Set<string>>(new Set());

  function toggleLike(creditId: string) {
    setLikedCredits((prev) => {
      const next = new Set(prev);
      if (next.has(creditId)) next.delete(creditId);
      else next.add(creditId);
      return next;
    });
  }

  if (isLoading) return <PageSkeleton />;

  if (!actor) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <EmptyState
          icon={<MaskHappy className="w-12 h-12" weight="duotone" />}
          title="Welcome to Overture"
          description="Complete your profile to start discovering auditions near you."
          action={
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Set Up Profile
            </Button>
          }
        />
      </div>
    );
  }

  const profile = actor.profile;

  // Build vitals array dynamically — skip missing fields
  const vitals: { label: string; value: string }[] = [];
  if (profile?.ageRangeLow && profile?.ageRangeHigh) {
    vitals.push({
      label: "Age Range",
      value: `${profile.ageRangeLow}–${profile.ageRangeHigh}`,
    });
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

  // Contact info
  const hasContact = actor.email || profile?.phone || profile?.addressLine1;

  // Measurements
  const m = profile?.measurements;
  const measurementGroups = m
    ? [
        {
          title: "Upper Body",
          items: [
            { label: "Head", value: formatMeasurement(m.headInches) },
            { label: "Neck", value: formatMeasurement(m.neckInches) },
            { label: "Shoulders", value: formatMeasurement(m.shouldersInches) },
            { label: "Chest", value: formatMeasurement(m.chestInches) },
            { label: "Underbust", value: formatMeasurement(m.underbustInches) },
            { label: "Sleeve", value: formatMeasurement(m.sleeveInches) },
          ].filter((item) => item.value !== "—"),
        },
        {
          title: "Lower Body",
          items: [
            { label: "Waist", value: formatMeasurement(m.waistInches) },
            { label: "Hips", value: formatMeasurement(m.hipsInches) },
            { label: "Inseam", value: formatMeasurement(m.inseamInches) },
            { label: "Outseam", value: formatMeasurement(m.outseamInches) },
            { label: "Rise", value: formatMeasurement(m.riseInches) },
          ].filter((item) => item.value !== "—"),
        },
        {
          title: "Sizing",
          items: [
            m.shoeSize ? { label: "Shoe", value: m.shoeSize } : null,
            m.hatSize ? { label: "Hat", value: m.hatSize } : null,
            m.jacketDressSize
              ? { label: "Jacket / Dress", value: m.jacketDressSize }
              : null,
          ].filter(Boolean) as { label: string; value: string }[],
        },
      ].filter((group) => group.items.length > 0)
    : [];

  // Summary stats for credits
  const totalCredits = actor.credits.length;
  const verifiedCount = actor.credits.filter((c) => c.verified).length;
  const totalKudos = actor.credits.reduce((sum, c) => sum + c.likeCount, 0);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* ===== HERO ===== */}
      <div className="mb-6 animate-fade-up">
        {/* Edit button — top right */}
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            icon={<PencilSimple className="w-4 h-4" weight="bold" />}
          >
            Edit
          </Button>
        </div>

        {/* Avatar + info — stacked on mobile, side-by-side on desktop */}
        <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left md:gap-5">
          {/* Headshot with gold ring + camera prompt */}
          <div className="relative flex-shrink-0 mb-4 md:mb-0">
            <div className="ring-4 ring-stage-200 rounded-full">
              <Avatar
                name={actor.displayName}
                imageUrl={actor.avatarUrl}
                size="xl"
              />
            </div>
            <button
              onClick={() => setEditOpen(true)}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-curtain-800 text-white flex items-center justify-center shadow-lg hover:bg-curtain-700 transition-colors"
              aria-label="Edit profile photo"
            >
              <Camera className="w-4 h-4" weight="fill" />
            </button>
          </div>

          {/* Name + details */}
          <div>
            <h1 className="text-3xl font-display text-curtain-900">
              {actor.displayName}
            </h1>
            {actor.pronouns && (
              <p className="text-sm text-clay-500">{actor.pronouns}</p>
            )}
            {profile?.ageRangeLow && profile?.ageRangeHigh && (
              <p className="text-sm text-clay-600 mt-1">
                Age range: {profile.ageRangeLow}–{profile.ageRangeHigh}
              </p>
            )}
            {profile?.locationCity && profile?.locationState && (
              <p className="text-sm text-clay-500 flex items-center justify-center md:justify-start gap-1.5 mt-1">
                <MapPin
                  className="w-3.5 h-3.5 text-stage-500"
                  weight="duotone"
                />
                {profile.locationCity}, {profile.locationState}
                {profile.travelRadius && ` · ${profile.travelRadius} mi`}
              </p>
            )}
            {profile?.isAvailable && (
              <Badge variant="success" size="md" className="mt-2">
                Available for Projects
              </Badge>
            )}
          </div>
        </div>
      </div>

      <hr className="gold-line" />

      {/* ===== BIO ===== */}
      {profile?.bio && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
          <Card variant="flat">
            <p className="text-sm text-curtain-800 leading-relaxed">
              {profile.bio}
            </p>
          </Card>
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

      {/* ===== CONTACT INFO (private) ===== */}
      {hasContact && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "150ms" }}>
          <PrivacyHeader title="Contact Info" />
          <Card variant="flat" padding="compact">
            <div className="flex flex-col gap-2">
              {actor.email && (
                <a
                  href={`mailto:${actor.email}`}
                  className="flex items-center gap-2 text-sm text-curtain-800 hover:text-curtain-900 transition"
                >
                  <Envelope
                    className="w-4 h-4 text-stage-500"
                    weight="duotone"
                  />
                  {actor.email}
                </a>
              )}
              {profile?.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-2 text-sm text-curtain-800 hover:text-curtain-900 transition"
                >
                  <Phone
                    className="w-4 h-4 text-stage-500"
                    weight="duotone"
                  />
                  {profile.phone}
                </a>
              )}
              {profile?.addressLine1 && (
                <div className="flex items-center gap-2 text-sm text-curtain-800">
                  <MapPin
                    className="w-4 h-4 text-stage-500"
                    weight="duotone"
                  />
                  {profile.addressLine1}, {profile.addressCity},{" "}
                  {profile.addressState} {profile.addressZip}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ===== ENDORSEMENTS ===== */}
      {actor.endorsements.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <SectionHeader>Endorsements</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {actor.endorsements.map((e) => (
              <span
                key={e.id}
                title={`From ${e.endorserName} — ${e.showTitle}`}
              >
                <Pill
                  variant="endorsement"
                  className="cursor-default"
                >
                  {e.label}
                </Pill>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== PRODUCTION HISTORY ===== */}
      {actor.credits.length > 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "250ms" }}>
          <SectionHeader>Production History</SectionHeader>

          {/* Summary line */}
          <p className="text-xs text-clay-500 mb-3">
            {totalCredits} production{totalCredits !== 1 ? "s" : ""}
            {verifiedCount > 0 && ` · ${verifiedCount} verified`}
            {totalKudos > 0 && ` · ${totalKudos} community kudos`}
          </p>

          <div className="flex flex-col gap-3">
            {actor.credits.map((credit) => {
              const isLiked = likedCredits.has(credit.id);
              const displayCount = credit.likeCount + (isLiked ? 1 : 0);

              return (
                <Card key={credit.id} variant="elevated" padding="compact">
                  {/* Credit header */}
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
                        <span className="text-clay-500">
                          {credit.theatreName}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => toggleLike(credit.id)}
                        className="flex items-center gap-1 text-xs transition-colors group"
                        aria-label={
                          isLiked
                            ? "Unlike this credit"
                            : "Like this credit"
                        }
                      >
                        <Heart
                          className={`w-4 h-4 transition-colors ${
                            isLiked
                              ? "text-ruby-500"
                              : "text-clay-300 group-hover:text-ruby-400"
                          }`}
                          weight={isLiked ? "fill" : "regular"}
                        />
                        <span
                          className={
                            isLiked ? "text-ruby-500" : "text-clay-400"
                          }
                        >
                          {displayCount}
                        </span>
                      </button>
                      <span className="text-sm font-semibold text-stage-600">
                        {credit.year}
                      </span>
                    </div>
                  </div>

                  {/* Kudos quote */}
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
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state for credits + endorsements */}
      {actor.credits.length === 0 && actor.endorsements.length === 0 && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "250ms" }}>
          <Card variant="sunken" className="text-center py-12">
            <p className="text-sm text-clay-500">
              No show history yet. Credits and endorsements will appear here as
              you participate in productions.
            </p>
          </Card>
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
                    <p className="text-sm font-semibold text-curtain-900">
                      {a.title}
                    </p>
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

      {/* ===== UNION STATUS ===== */}
      {profile && (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "450ms" }}>
          <SectionHeader>Union Status</SectionHeader>
          <Card variant="flat" padding="compact">
            <div className="flex items-center gap-2">
              <IdentificationBadge
                className="w-5 h-5 text-stage-500"
                weight="duotone"
              />
              <span className="text-sm text-curtain-800">
                {UNION_LABELS[profile.unionStatus] ?? profile.unionStatus}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ===== MEASUREMENTS (private) ===== */}
      {measurementGroups.length > 0 ? (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "500ms" }}>
          <PrivacyHeader title="Measurements" />
          <div className="flex flex-col gap-6">
            {measurementGroups.map((group) => (
              <div key={group.title}>
                <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase mb-2">
                  {group.title}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {group.items.map((item) => (
                    <StatBlock
                      key={item.label}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "500ms" }}>
          <PrivacyHeader title="Measurements" />
          <Card variant="sunken" className="text-center py-12">
            <p className="text-sm text-clay-500">
              No measurements on file. Adding measurements helps costume
              designers prepare for your fitting.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setEditOpen(true)}
            >
              Add Measurements
            </Button>
          </Card>
        </div>
      )}

      {/* ===== PHOTOS (coming soon) ===== */}
      <div className="mb-6 animate-fade-up" style={{ animationDelay: "550ms" }}>
        <SectionHeader>Photos</SectionHeader>
        <Card variant="sunken" className="text-center py-12">
          <Images
            className="w-12 h-12 text-clay-300 mx-auto mb-3"
            weight="duotone"
          />
          <p className="text-sm font-semibold text-curtain-900 mb-1">
            Headshots & Production Photos
          </p>
          <p className="text-xs text-clay-500 mb-4 max-w-xs mx-auto">
            Upload headshots and tag your production photos so directors can see
            your range.
          </p>
          <Badge variant="default" size="sm">
            Coming Soon
          </Badge>
        </Card>
      </div>

      {/* Edit Modal */}
      <ProfileEditModal
        actor={actor}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
