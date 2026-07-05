"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { useOrg } from "@/features/auth/useOrg";
import { createShow, getVenues } from "@/lib/api/client";
import { Card, Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { ArrowRight, MaskHappy } from "@phosphor-icons/react";
import type { ShowType } from "@/types";

/* ============================================================
   Create a Show — ONE instant screen.
   Principle: creation instant, depth progressive. Capture the
   bare minimum, create the show in 'setup' (private draft), and
   send the user to the checklist home to build it out.
   City/State + locations pre-fill from the theatre (useOrg).
   ============================================================ */

const SHOW_TYPES: { value: ShowType; label: string }[] = [
  { value: "musical", label: "Musical" },
  { value: "play", label: "Play" },
  { value: "revue", label: "Revue" },
];

export default function NewShowPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { org, isLoading: orgLoading } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [showType, setShowType] = useState<ShowType>("musical");
  const [authorInfo, setAuthorInfo] = useState("");
  const [season, setSeason] = useState("");
  const [auditionStart, setAuditionStart] = useState("");
  const [auditionEnd, setAuditionEnd] = useState("");
  // City/State pre-filled from the theatre, but editable.
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cityTouched, setCityTouched] = useState(false);
  const [stateTouched, setStateTouched] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Resolve the displayed city/state: user edits win, otherwise org defaults.
  const resolvedCity = cityTouched ? city : org?.city ?? "";
  const resolvedState = stateTouched ? state : org?.state ?? "";

  // Pull the theatre's venues so we can default locations from the primary one.
  const { data: venues } = useQuery({
    queryKey: ["venues", org?.id],
    queryFn: () => getVenues(org!.id),
    enabled: !!org,
  });
  const primaryVenue = (venues ?? []).find((v) => v.isPrimary) ?? (venues ?? [])[0] ?? null;

  const createShowMutation = useMutation({
    mutationFn: () => {
      // Default location from the theatre's primary venue (name + address);
      // otherwise fall back to org name + city. Editable later in setup.
      const defaultLocation = primaryVenue
        ? [primaryVenue.name, primaryVenue.address].filter(Boolean).join(", ")
        : org
        ? [org.name, resolvedCity].filter(Boolean).join(", ") || null
        : null;
      return createShow({
        orgId: org!.id,
        orgName: org!.name,
        title: title.trim(),
        authorInfo: authorInfo.trim() || null,
        showType,
        season: season.trim() || null,
        status: "setup",
        auditionStart: auditionStart || null,
        auditionEnd: auditionEnd || null,
        callbackDate: null,
        callbackStartTime: null,
        callbackEndTime: null,
        rehearsalStart: null,
        showOpen: null,
        showClose: null,
        auditionLocation: defaultLocation,
        auditionNotes: null,
        callbackLocation: null,
        callbackNotes: null,
        performanceLocation: defaultLocation,
        callbackContactName: user?.displayName ?? null,
        callbackContactPhone: null,
        posterUrl: null,
        city: resolvedCity,
        state: resolvedState,
        distanceMiles: null,
        isPromoted: false,
      });
    },
    onSuccess: (newShow) => {
      track("show_created", { showId: newShow.id });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Show created! Let's build it out.");
      router.push(`/shows/${newShow.id}/setup`);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const titleValid = title.trim() !== "";

  function handleCreate() {
    setHasAttemptedSubmit(true);
    if (!titleValid) return;
    if (!org) {
      toast("error", "Your theatre is still loading — try again in a moment.");
      return;
    }
    if (auditionStart && auditionEnd && auditionEnd < auditionStart) {
      toast("error", "Audition end date must be after the start date.");
      return;
    }
    createShowMutation.mutate();
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="animate-fade-up">
        <div className="w-12 h-12 rounded-xl bg-stage-100 flex items-center justify-center mb-4">
          <MaskHappy className="w-6 h-6 text-stage-500" weight="duotone" />
        </div>
        <h1 className="text-3xl font-display text-curtain-900 mb-1">
          Create a Show
        </h1>
        <p className="text-sm text-clay-500 mb-6">
          Just the basics to get started. You&apos;ll add roles, your team, and
          the audition schedule from the show&apos;s home next — nothing is
          public until you open auditions.
        </p>

        <Card variant="flat" padding="spacious">
          <div className="flex flex-col gap-4">
            <Input
              label="Show Title *"
              placeholder="Into the Woods"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={hasAttemptedSubmit && !titleValid ? "Title is required" : undefined}
              autoFocus
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-curtain-700 tracking-wide">
                  Show Type *
                </label>
                <select
                  value={showType}
                  onChange={(e) => setShowType(e.target.value as ShowType)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300"
                >
                  {SHOW_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Season"
                placeholder="2026-2027"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              />
            </div>

            <Input
              label="Author / Composer"
              placeholder="Music & Lyrics: Stephen Sondheim, Book: James Lapine"
              value={authorInfo}
              onChange={(e) => setAuthorInfo(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                placeholder="Riverside"
                value={resolvedCity}
                onChange={(e) => { setCityTouched(true); setCity(e.target.value); }}
              />
              <Input
                label="State"
                placeholder="CA"
                value={resolvedState}
                onChange={(e) => { setStateTouched(true); setState(e.target.value); }}
              />
            </div>
            {org && !cityTouched && (org.city || org.state) && (
              <p className="text-[11px] text-clay-400 -mt-2">
                Pre-filled from {org.name}. Edit if this show is elsewhere.
              </p>
            )}

            <div>
              <p className="text-xs font-semibold text-curtain-700 tracking-wide mb-1">
                Rough Audition Dates <span className="font-normal text-clay-400">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start"
                  type="date"
                  value={auditionStart}
                  onChange={(e) => setAuditionStart(e.target.value)}
                />
                <Input
                  label="End"
                  type="date"
                  value={auditionEnd}
                  onChange={(e) => setAuditionEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-between items-center mt-6">
          <Button variant="ghost" onClick={() => router.push("/shows")}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            loading={createShowMutation.isPending}
            disabled={orgLoading}
            icon={<ArrowRight className="w-4 h-4" weight="bold" />}
          >
            Create Show
          </Button>
        </div>
      </div>
    </div>
  );
}
