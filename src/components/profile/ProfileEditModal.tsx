"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Input, Textarea, Button, useToast } from "@/components/ui";
import { updateActorProfile, updateActorUser } from "@/lib/api/client";
import { FloppyDisk, Plus, X } from "@phosphor-icons/react";
import type { ActorWithProfile, ActorProfile, Pronouns, ActorMeasurements, BucketListShow } from "@/types";

type Props = {
  actor: ActorWithProfile;
  open: boolean;
  onClose: () => void;
  initialTab?: EditSection;
};

type EditSection = "basic" | "about" | "private" | "measurements";

const SECTIONS: { id: EditSection; label: string }[] = [
  { id: "basic", label: "Basic Info" },
  { id: "about", label: "About" },
  { id: "private", label: "Private" },
  { id: "measurements", label: "Measurements" },
];

const PRONOUN_OPTIONS: { value: Pronouns; label: string }[] = [
  { value: "she/her", label: "she/her" },
  { value: "he/him", label: "he/him" },
  { value: "they/them", label: "they/them" },
  { value: "she/they", label: "she/they" },
  { value: "he/they", label: "he/they" },
  { value: "any pronouns", label: "any pronouns" },
  { value: "prefer not to say", label: "Prefer not to say" },
];

export function ProfileEditModal({ actor, open, onClose, initialTab = "basic" }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = actor.profile;
  const [activeSection, setActiveSection] = useState<EditSection>(initialTab);

  useEffect(() => {
    if (open) setActiveSection(initialTab);
  }, [open, initialTab]);

  // ── Basic Info state ──
  const [displayName, setDisplayName] = useState(actor.displayName);
  const [pronouns, setPronouns] = useState<Pronouns | "">(actor.pronouns ?? "");
  const [ageRangeLow, setAgeRangeLow] = useState(profile?.ageRangeLow?.toString() ?? "");
  const [ageRangeHigh, setAgeRangeHigh] = useState(profile?.ageRangeHigh?.toString() ?? "");
  const [heightInches, setHeightInches] = useState(profile?.heightInches?.toString() ?? "");
  const [vocalRange, setVocalRange] = useState(profile?.vocalRange ?? "");
  const [danceStyles, setDanceStyles] = useState(profile?.danceStyles?.join(", ") ?? "");
  const [specialSkills, setSpecialSkills] = useState(profile?.specialSkills?.join(", ") ?? "");
  const [locationCity, setLocationCity] = useState(profile?.locationCity ?? "");
  const [locationState, setLocationState] = useState(profile?.locationState ?? "");
  const [travelRadius, setTravelRadius] = useState(profile?.travelRadius?.toString() ?? "");

  // ── About state ──
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [bucketListShows, setBucketListShows] = useState<BucketListShow[]>(
    profile?.bucketListShows ?? []
  );

  // ── Private state ──
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [appearanceDescription, setAppearanceDescription] = useState(profile?.appearanceDescription ?? "");
  const [accessibilityNeeds, setAccessibilityNeeds] = useState(profile?.accessibilityNeeds ?? "");
  const [dealbreakers, setDealbreakers] = useState(profile?.dealbreakers?.join(", ") ?? "");
  const [guardianName, setGuardianName] = useState(profile?.guardianName ?? "");
  const [guardianEmail, setGuardianEmail] = useState(profile?.guardianEmail ?? "");
  const [guardianPhone, setGuardianPhone] = useState(profile?.guardianPhone ?? "");

  // ── Measurements state ──
  const m = profile?.measurements;
  const [headInches, setHeadInches] = useState(m?.headInches?.toString() ?? "");
  const [neckInches, setNeckInches] = useState(m?.neckInches?.toString() ?? "");
  const [shouldersInches, setShouldersInches] = useState(m?.shouldersInches?.toString() ?? "");
  const [chestInches, setChestInches] = useState(m?.chestInches?.toString() ?? "");
  const [underbustInches, setUnderbustInches] = useState(m?.underbustInches?.toString() ?? "");
  const [waistInches, setWaistInches] = useState(m?.waistInches?.toString() ?? "");
  const [hipsInches, setHipsInches] = useState(m?.hipsInches?.toString() ?? "");
  const [inseamInches, setInseamInches] = useState(m?.inseamInches?.toString() ?? "");
  const [outseamInches, setOutseamInches] = useState(m?.outseamInches?.toString() ?? "");
  const [sleeveInches, setSleeveInches] = useState(m?.sleeveInches?.toString() ?? "");
  const [riseInches, setRiseInches] = useState(m?.riseInches?.toString() ?? "");
  const [shoeSize, setShoeSize] = useState(m?.shoeSize ?? "");
  const [hatSize, setHatSize] = useState(m?.hatSize ?? "");
  const [jacketDressSize, setJacketDressSize] = useState(m?.jacketDressSize ?? "");

  // Reset form when actor data changes
  useEffect(() => {
    if (!open) return;
    setDisplayName(actor.displayName);
    setPronouns(actor.pronouns as Pronouns ?? "");
    setBio(profile?.bio ?? "");
    setAgeRangeLow(profile?.ageRangeLow?.toString() ?? "");
    setAgeRangeHigh(profile?.ageRangeHigh?.toString() ?? "");
    setHeightInches(profile?.heightInches?.toString() ?? "");
    setVocalRange(profile?.vocalRange ?? "");
    setDanceStyles(profile?.danceStyles?.join(", ") ?? "");
    setSpecialSkills(profile?.specialSkills?.join(", ") ?? "");
    setLocationCity(profile?.locationCity ?? "");
    setLocationState(profile?.locationState ?? "");
    setTravelRadius(profile?.travelRadius?.toString() ?? "");
    setPhone(profile?.phone ?? "");
    setAppearanceDescription(profile?.appearanceDescription ?? "");
    setBucketListShows(profile?.bucketListShows ?? []);
    setAccessibilityNeeds(profile?.accessibilityNeeds ?? "");
    setDealbreakers(profile?.dealbreakers?.join(", ") ?? "");
    setGuardianName(profile?.guardianName ?? "");
    setGuardianEmail(profile?.guardianEmail ?? "");
    setGuardianPhone(profile?.guardianPhone ?? "");
    const ms = profile?.measurements;
    setHeadInches(ms?.headInches?.toString() ?? "");
    setNeckInches(ms?.neckInches?.toString() ?? "");
    setShouldersInches(ms?.shouldersInches?.toString() ?? "");
    setChestInches(ms?.chestInches?.toString() ?? "");
    setUnderbustInches(ms?.underbustInches?.toString() ?? "");
    setWaistInches(ms?.waistInches?.toString() ?? "");
    setHipsInches(ms?.hipsInches?.toString() ?? "");
    setInseamInches(ms?.inseamInches?.toString() ?? "");
    setOutseamInches(ms?.outseamInches?.toString() ?? "");
    setSleeveInches(ms?.sleeveInches?.toString() ?? "");
    setRiseInches(ms?.riseInches?.toString() ?? "");
    setShoeSize(ms?.shoeSize ?? "");
    setHatSize(ms?.hatSize ?? "");
    setJacketDressSize(ms?.jacketDressSize ?? "");
  }, [actor, profile, open]);

  // Bucket list helpers
  function addBucketListShow() {
    if (bucketListShows.length >= 5) return;
    setBucketListShows([...bucketListShows, { title: "", role: null }]);
  }

  function updateBucketListShow(index: number, field: "title" | "role", value: string) {
    const updated = [...bucketListShows];
    updated[index] = { ...updated[index], [field]: value || null };
    setBucketListShows(updated);
  }

  function removeBucketListShow(index: number) {
    setBucketListShows(bucketListShows.filter((_, i) => i !== index));
  }

  // Mutations
  const userMutation = useMutation({
    mutationFn: (updates: Parameters<typeof updateActorUser>[1]) =>
      updateActorUser(actor.id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actor", actor.id] }),
  });

  const profileMutation = useMutation({
    mutationFn: (updates: Partial<ActorProfile>) =>
      updateActorProfile(actor.id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actor", actor.id] }),
  });

  const isSaving = userMutation.isPending || profileMutation.isPending;

  async function handleSave() {
    try {
      const num = (v: string) => (v.trim() ? parseFloat(v) : null);
      const csvToArray = (v: string) =>
        v.split(",").map((s) => s.trim()).filter(Boolean);

      await userMutation.mutateAsync({ displayName, pronouns: (pronouns as Pronouns) || null });

      const cleanedBucketList = bucketListShows.filter((s) => s.title.trim());

      const profileUpdates: Partial<ActorProfile> = {
        ageRangeLow: num(ageRangeLow) as number | null,
        ageRangeHigh: num(ageRangeHigh) as number | null,
        heightInches: num(heightInches) as number | null,
        vocalRange: vocalRange || null,
        danceStyles: csvToArray(danceStyles),
        specialSkills: csvToArray(specialSkills),
        locationCity: locationCity || null,
        locationState: locationState || null,
        travelRadius: num(travelRadius) as number | null,
        bio,
        bucketListShows: cleanedBucketList,
        phone: phone || null,
        appearanceDescription: appearanceDescription || null,
        accessibilityNeeds: accessibilityNeeds || null,
        dealbreakers: csvToArray(dealbreakers),
        ...(profile?.isMinor
          ? {
              guardianName: guardianName || null,
              guardianEmail: guardianEmail || null,
              guardianPhone: guardianPhone || null,
            }
          : {}),
        measurements: {
          headInches: num(headInches),
          neckInches: num(neckInches),
          shouldersInches: num(shouldersInches),
          chestInches: num(chestInches),
          underbustInches: num(underbustInches),
          waistInches: num(waistInches),
          hipsInches: num(hipsInches),
          inseamInches: num(inseamInches),
          outseamInches: num(outseamInches),
          sleeveInches: num(sleeveInches),
          riseInches: num(riseInches),
          shoeSize: shoeSize || null,
          hatSize: hatSize || null,
          jacketDressSize: jacketDressSize || null,
        },
      };

      await profileMutation.mutateAsync(profileUpdates);

      toast("success", "Profile updated!");
      onClose();
    } catch {
      toast("error", "Failed to save. Please try again.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile">
      {/* Section tabs */}
      <div className="flex gap-1 mb-6 -mt-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              activeSection === s.id
                ? "bg-stage-100 text-stage-700"
                : "text-clay-400 hover:text-clay-600 hover:bg-cream-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Basic Info ── */}
      {activeSection === "basic" && (
        <div className="flex flex-col gap-4">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <div>
            <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-1">
              Pronouns
            </label>
            <select
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value as Pronouns | "")}
              className="w-full px-3 py-2.5 text-sm rounded-xl border bg-cream-50 border-cream-300 focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300 outline-none"
            >
              <option value="">Select pronouns</option>
              {PRONOUN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Age Range Low"
              type="number"
              value={ageRangeLow}
              onChange={(e) => setAgeRangeLow(e.target.value)}
            />
            <Input
              label="Age Range High"
              type="number"
              value={ageRangeHigh}
              onChange={(e) => setAgeRangeHigh(e.target.value)}
            />
          </div>
          <Input
            label="Height (inches)"
            type="number"
            value={heightInches}
            onChange={(e) => setHeightInches(e.target.value)}
            placeholder="e.g. 65"
          />
          <Input
            label="Vocal Range"
            value={vocalRange}
            onChange={(e) => setVocalRange(e.target.value)}
            placeholder="e.g. Mezzo A3-C6"
          />
          <Input
            label="Dance Styles"
            value={danceStyles}
            onChange={(e) => setDanceStyles(e.target.value)}
            placeholder="Comma separated: Ballet, Jazz"
          />
          <Input
            label="Special Skills"
            value={specialSkills}
            onChange={(e) => setSpecialSkills(e.target.value)}
            placeholder="Comma separated: Guitar, Dialects"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="City"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
            />
            <Input
              label="State"
              value={locationState}
              onChange={(e) => setLocationState(e.target.value)}
              placeholder="e.g. CA"
            />
          </div>
          <Input
            label="Travel Radius (miles)"
            type="number"
            value={travelRadius}
            onChange={(e) => setTravelRadius(e.target.value)}
          />
        </div>
      )}

      {/* ── About ── */}
      {activeSection === "about" && (
        <div className="flex flex-col gap-4">
          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            placeholder="Tell directors about yourself..."
          />

          {/* Bucket List Shows */}
          <div>
            <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-1">
              Bucket List Shows
            </label>
            <p className="text-[11px] text-clay-400 mb-3">
              Up to 5 dream roles. A great conversation starter at auditions.
            </p>
            <div className="flex flex-col gap-2">
              {bucketListShows.map((show, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={show.title}
                    onChange={(e) => updateBucketListShow(i, "title", e.target.value)}
                    placeholder="Show title"
                    className="flex-1"
                  />
                  <Input
                    value={show.role ?? ""}
                    onChange={(e) => updateBucketListShow(i, "role", e.target.value)}
                    placeholder="Dream role (optional)"
                    className="flex-1"
                  />
                  <button
                    onClick={() => removeBucketListShow(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors flex-shrink-0"
                    aria-label="Remove show"
                  >
                    <X className="w-4 h-4" weight="bold" />
                  </button>
                </div>
              ))}
            </div>
            {bucketListShows.length < 5 && (
              <button
                onClick={addBucketListShow}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-stage-600 hover:text-stage-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" weight="bold" />
                Add a show
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Private ── */}
      {activeSection === "private" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-clay-400">
            This information is only visible to you and production teams for shows you&apos;ve signed up for.
          </p>

          {/* Guardian info — only for minor accounts */}
          {profile?.isMinor && (
            <>
              <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                Guardian
              </p>
              <Input
                label="Guardian Name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Guardian Email"
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                />
                <Input
                  label="Guardian Phone"
                  type="tel"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                />
              </div>
              <hr className="border-cream-200" />
            </>
          )}

          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-0100"
          />
          <div>
            <Textarea
              label="I describe myself as..."
              value={appearanceDescription}
              onChange={(e) => setAppearanceDescription(e.target.value)}
              rows={2}
              placeholder="How you'd describe your appearance — in your own words"
            />
            <p className="text-[11px] text-clay-400 mt-1">
              Helps directors understand your range for character-specific casting. Never shown publicly.
            </p>
          </div>

          <hr className="border-cream-200" />

          <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
            Only visible to you
          </p>
          <div>
            <Textarea
              label="Accessibility & Accommodation Needs"
              value={accessibilityNeeds}
              onChange={(e) => setAccessibilityNeeds(e.target.value)}
              rows={2}
              placeholder="Anything production teams should know to support you"
            />
            <p className="text-[11px] text-clay-400 mt-1">
              This is never shared. It&apos;s here so you can reference it when communicating with production teams on your own terms.
            </p>
          </div>
          <div>
            <Input
              label="Dealbreakers"
              value={dealbreakers}
              onChange={(e) => setDealbreakers(e.target.value)}
              placeholder="Comma separated: nudity, stage combat, firearms"
            />
            <p className="text-[11px] text-clay-400 mt-1">
              Shows with matching content advisories won&apos;t appear in your Discover feed.
            </p>
          </div>
        </div>
      )}

      {/* ── Measurements ── */}
      {activeSection === "measurements" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-clay-400">
            Measurements help costume designers prepare for your fitting. Only visible to production teams.
          </p>
          <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
            Upper Body
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Head" type="number" value={headInches} onChange={(e) => setHeadInches(e.target.value)} placeholder='"' />
            <Input label="Neck" type="number" value={neckInches} onChange={(e) => setNeckInches(e.target.value)} placeholder='"' />
            <Input label="Shoulders" type="number" value={shouldersInches} onChange={(e) => setShouldersInches(e.target.value)} placeholder='"' />
            <Input label="Chest" type="number" value={chestInches} onChange={(e) => setChestInches(e.target.value)} placeholder='"' />
            <Input label="Underbust" type="number" value={underbustInches} onChange={(e) => setUnderbustInches(e.target.value)} placeholder='"' />
            <Input label="Sleeve" type="number" value={sleeveInches} onChange={(e) => setSleeveInches(e.target.value)} placeholder='"' />
          </div>
          <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase mt-2">
            Lower Body
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Waist" type="number" value={waistInches} onChange={(e) => setWaistInches(e.target.value)} placeholder='"' />
            <Input label="Hips" type="number" value={hipsInches} onChange={(e) => setHipsInches(e.target.value)} placeholder='"' />
            <Input label="Inseam" type="number" value={inseamInches} onChange={(e) => setInseamInches(e.target.value)} placeholder='"' />
            <Input label="Outseam" type="number" value={outseamInches} onChange={(e) => setOutseamInches(e.target.value)} placeholder='"' />
            <Input label="Rise" type="number" value={riseInches} onChange={(e) => setRiseInches(e.target.value)} placeholder='"' />
          </div>
          <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase mt-2">
            Sizing
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Shoe Size" value={shoeSize} onChange={(e) => setShoeSize(e.target.value)} placeholder="e.g. 7.5" />
            <Input label="Hat Size" value={hatSize} onChange={(e) => setHatSize(e.target.value)} placeholder="e.g. S" />
            <Input label="Jacket/Dress" value={jacketDressSize} onChange={(e) => setJacketDressSize(e.target.value)} placeholder="e.g. 4" />
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          icon={<FloppyDisk className="w-4 h-4" weight="bold" />}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </Modal>
  );
}
