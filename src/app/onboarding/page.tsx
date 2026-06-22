"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { createActorProfile, createOrg } from "@/lib/api/client";
import { completeActorOnboarding, completeMakerOnboarding } from "@/lib/api/onboarding";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  Card,
  Button,
  Input,
  Textarea,
  SectionHeader,
  useToast,
} from "@/components/ui";
import { StepIndicator } from "@/components/ui/StepIndicator";
import {
  MaskHappy,
  Megaphone,
  ArrowLeft,
  ArrowRight,
  Check,
  Confetti,
  ShieldCheck,
  Lock,
} from "@phosphor-icons/react";
import type { Pronouns, TeamRole } from "@/types";

const PRONOUN_OPTIONS: { value: Pronouns; label: string }[] = [
  { value: "she/her", label: "she/her" },
  { value: "he/him", label: "he/him" },
  { value: "they/them", label: "they/them" },
  { value: "she/they", label: "she/they" },
  { value: "he/they", label: "he/they" },
  { value: "any pronouns", label: "any pronouns" },
  { value: "prefer not to say", label: "Prefer not to say" },
];

const ACTOR_STEPS = ["Profile", "Talent", "Private", "Done"];
const MAKER_STEPS = ["You", "Theatre", "Done"];

type Path = "actor" | "maker" | null;

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { user, updateUser, switchRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [path, setPath] = useState<Path>(null);
  const [step, setStep] = useState(0);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // ── Shared identity ── (pre-filled from the auth provider, e.g. Google)
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [pronouns, setPronouns] = useState<Pronouns | "">(
    (user?.pronouns as Pronouns) ?? ""
  );

  // ── Actor: account holder / minor ──
  const [accountFor, setAccountFor] = useState<"me" | "child">("me");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // ── Actor: basics ──
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [travelRadius, setTravelRadius] = useState("");
  const [ageRangeLow, setAgeRangeLow] = useState("");
  const [ageRangeHigh, setAgeRangeHigh] = useState("");

  // ── Actor: talent ──
  const [heightInches, setHeightInches] = useState("");
  const [vocalRange, setVocalRange] = useState("");
  const [danceStyles, setDanceStyles] = useState("");
  const [specialSkills, setSpecialSkills] = useState("");
  const [bio, setBio] = useState("");

  // ── Actor: private ──
  const [phone, setPhone] = useState("");
  const [appearance, setAppearance] = useState("");
  const [accessibility, setAccessibility] = useState("");
  const [dealbreakers, setDealbreakers] = useState("");

  // ── Maker ──
  const [teamRole, setTeamRole] = useState<TeamRole>("director");
  const [orgName, setOrgName] = useState("");
  const [orgCity, setOrgCity] = useState("");
  const [orgState, setOrgState] = useState("");

  const num = (v: string) => (v.trim() ? parseFloat(v) : null);
  const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  // ── Mutations ──
  const actorMutation = useMutation({
    mutationFn: async () => {
      const profile = {
          bio: bio.trim(),
          heightInches: num(heightInches),
          vocalRange: vocalRange.trim() || null,
          danceStyles: csv(danceStyles),
          specialSkills: csv(specialSkills),
          ageRangeLow: num(ageRangeLow),
          ageRangeHigh: num(ageRangeHigh),
          locationCity: city.trim() || null,
          locationState: stateVal.trim() || null,
          travelRadius: num(travelRadius),
          isMinor: accountFor === "child",
          guardianName: accountFor === "child" ? guardianName.trim() || null : null,
          guardianEmail: accountFor === "child" ? guardianEmail.trim() || null : null,
          guardianPhone: accountFor === "child" ? guardianPhone.trim() || null : null,
          phone: phone.trim() || null,
          appearanceDescription: appearance.trim() || null,
          accessibilityNeeds: accessibility.trim() || null,
          dealbreakers: csv(dealbreakers),
      };
      if (isSupabaseConfigured) {
        return completeActorOnboarding({
          user: {
            id: user?.id ?? "",
            displayName: displayName.trim(),
            pronouns: (pronouns as Pronouns) || null,
          },
          profile,
        });
      }
      return createActorProfile({
        user: {
          id: user?.id ?? `actor-${Date.now()}`,
          email: user?.email ?? "",
          displayName: displayName.trim(),
          pronouns: (pronouns as Pronouns) || null,
        },
        profile,
      });
    },
    onSuccess: () => {
      updateUser({
        displayName: displayName.trim(),
        pronouns: (pronouns as Pronouns) || null,
        onboardingStep: "complete",
      });
      switchRole({ type: "actor" });
    },
    onError: () => toast("error", "Something went wrong. Please try again."),
  });

  const makerMutation = useMutation({
    mutationFn: () => {
      const org = {
        name: orgName.trim(),
        city: orgCity.trim() || null,
        state: orgState.trim() || null,
      };
      if (isSupabaseConfigured) {
        return completeMakerOnboarding({
          user: {
            id: user?.id ?? "",
            displayName: displayName.trim(),
            pronouns: (pronouns as Pronouns) || null,
          },
          org,
        });
      }
      return createOrg(org);
    },
    onSuccess: () => {
      updateUser({
        displayName: displayName.trim(),
        pronouns: (pronouns as Pronouns) || null,
        onboardingStep: "complete",
      });
      // The freshly created org must be visible to useOrg before /shows/new.
      queryClient.invalidateQueries({ queryKey: ["myOrg"] });
      switchRole({ type: "team", showId: "show-1", teamRole });
    },
    onError: () => toast("error", "Something went wrong. Please try again."),
  });

  // ── Validation ──
  const actorProfileValid =
    displayName.trim() !== "" &&
    city.trim() !== "" &&
    stateVal.trim() !== "" &&
    (accountFor === "me" ||
      (guardianName.trim() !== "" && guardianEmail.trim() !== ""));

  const makerYouValid = displayName.trim() !== "";
  const makerTheatreValid =
    orgName.trim() !== "" && orgCity.trim() !== "" && orgState.trim() !== "";

  function advanceActorProfile() {
    setHasAttemptedSubmit(true);
    if (!actorProfileValid) return;
    setHasAttemptedSubmit(false);
    setStep(1);
  }

  function advanceMakerYou() {
    setHasAttemptedSubmit(true);
    if (!makerYouValid) return;
    setHasAttemptedSubmit(false);
    setStep(1);
  }

  function finishActor() {
    actorMutation.mutate(undefined, { onSuccess: () => setStep(3) });
  }

  function submitMakerTheatre() {
    setHasAttemptedSubmit(true);
    if (!makerTheatreValid) return;
    makerMutation.mutate(undefined, {
      onSuccess: () => {
        setHasAttemptedSubmit(false);
        setStep(2);
      },
    });
  }

  // ════════════════════════════════════════════════
  // FORK SCREEN
  // ════════════════════════════════════════════════
  if (path === null) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8 animate-fade-up">
          <h1 className="text-3xl font-display text-curtain-900 mb-2">
            Welcome to Overture
          </h1>
          <p className="text-sm text-clay-500">
            How will you use Overture? You can always do both later.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
          <Card
            variant="elevated"
            padding="spacious"
            interactive
            onClick={() => {
              setPath("actor");
              setStep(0);
            }}
            className="text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-stage-100 flex items-center justify-center mx-auto mb-4">
              <MaskHappy className="w-7 h-7 text-stage-600" weight="duotone" />
            </div>
            <p className="text-lg font-display text-curtain-900 mb-1">
              I&apos;m an actor
            </p>
            <p className="text-xs text-clay-500">
              Build a profile, discover auditions, and get cast.
            </p>
          </Card>

          <Card
            variant="elevated"
            padding="spacious"
            interactive
            onClick={() => {
              setPath("maker");
              setStep(0);
            }}
            className="text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-stage-100 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-7 h-7 text-stage-600" weight="duotone" />
            </div>
            <p className="text-lg font-display text-curtain-900 mb-1">
              I&apos;m a theatre maker
            </p>
            <p className="text-xs text-clay-500">
              Cast a show, run auditions, and build your company.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // ACTOR WIZARD
  // ════════════════════════════════════════════════
  if (path === "actor") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <StepIndicator steps={ACTOR_STEPS} currentStep={step} />

        {/* STEP 0 — Profile */}
        {step === 0 && (
          <div className="animate-fade-up">
            <h1 className="text-3xl font-display text-curtain-900 mb-1">
              Your profile
            </h1>
            <p className="text-sm text-clay-500 mb-6">
              The essentials so directors can find you.
            </p>

            {/* Account holder toggle */}
            <SectionHeader>Who is this account for?</SectionHeader>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={() => setAccountFor("me")}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  accountFor === "me"
                    ? "border-stage-400 bg-stage-50 text-curtain-900"
                    : "border-cream-300 bg-white text-clay-500 hover:border-cream-400"
                }`}
              >
                Me (I&apos;m 18+)
              </button>
              <button
                onClick={() => setAccountFor("child")}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  accountFor === "child"
                    ? "border-stage-400 bg-stage-50 text-curtain-900"
                    : "border-cream-300 bg-white text-clay-500 hover:border-cream-400"
                }`}
              >
                My child
              </button>
            </div>

            {accountFor === "child" && (
              <Card variant="flat" className="mb-5 animate-fade-up">
                <div className="flex items-start gap-2.5 mb-4">
                  <ShieldCheck
                    className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5"
                    weight="duotone"
                  />
                  <p className="text-xs text-clay-600 leading-relaxed">
                    You&apos;ll manage this profile as the guardian. Production
                    teams see your contact info, and you stay in control until
                    your child turns 18. You can add more children later from
                    your account.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Input
                    label="Guardian Name *"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    error={
                      hasAttemptedSubmit && !guardianName.trim()
                        ? "Required"
                        : undefined
                    }
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Guardian Email *"
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      error={
                        hasAttemptedSubmit && !guardianEmail.trim()
                          ? "Required"
                          : undefined
                      }
                    />
                    <Input
                      label="Guardian Phone"
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                    />
                  </div>
                </div>
              </Card>
            )}

            <div className="flex flex-col gap-4">
              <Input
                label={accountFor === "child" ? "Child's Name *" : "Display Name *"}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={
                  hasAttemptedSubmit && !displayName.trim()
                    ? "Required"
                    : undefined
                }
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-curtain-700 tracking-wide">
                  Pronouns
                </label>
                <select
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value as Pronouns | "")}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300"
                >
                  <option value="">Select pronouns</option>
                  {PRONOUN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="City *"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  error={hasAttemptedSubmit && !city.trim() ? "Required" : undefined}
                />
                <Input
                  label="State *"
                  placeholder="CA"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  error={
                    hasAttemptedSubmit && !stateVal.trim() ? "Required" : undefined
                  }
                />
                <Input
                  label="Travel Radius (mi)"
                  type="number"
                  value={travelRadius}
                  onChange={(e) => setTravelRadius(e.target.value)}
                />
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
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="ghost" onClick={() => setPath(null)}>
                Back
              </Button>
              <Button
                onClick={advanceActorProfile}
                icon={<ArrowRight className="w-4 h-4" weight="bold" />}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1 — Talent */}
        {step === 1 && (
          <div className="animate-fade-up">
            <h1 className="text-3xl font-display text-curtain-900 mb-1">
              Your talent
            </h1>
            <p className="text-sm text-clay-500 mb-6">
              What you bring to the stage. All optional — add what you like.
            </p>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Height (inches)"
                  type="number"
                  placeholder="e.g. 65"
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                />
                <Input
                  label="Vocal Range"
                  placeholder="e.g. Mezzo A3-C6"
                  value={vocalRange}
                  onChange={(e) => setVocalRange(e.target.value)}
                />
              </div>
              <Input
                label="Dance Styles"
                placeholder="Comma separated: Ballet, Jazz"
                value={danceStyles}
                onChange={(e) => setDanceStyles(e.target.value)}
              />
              <Input
                label="Special Skills"
                placeholder="Comma separated: Guitar, Dialects"
                value={specialSkills}
                onChange={(e) => setSpecialSkills(e.target.value)}
              />
              <Textarea
                label="Bio"
                rows={4}
                placeholder="Tell directors about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="flex justify-between mt-8">
              <Button
                variant="ghost"
                onClick={() => setStep(0)}
                icon={<ArrowLeft className="w-4 h-4" weight="bold" />}
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                icon={<ArrowRight className="w-4 h-4" weight="bold" />}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Private */}
        {step === 2 && (
          <div className="animate-fade-up">
            <h1 className="text-3xl font-display text-curtain-900 mb-1">
              Private details
            </h1>
            <div className="flex items-center gap-1.5 mb-6">
              <Lock className="w-3.5 h-3.5 text-clay-400" weight="duotone" />
              <p className="text-sm text-clay-500">
                Only you &amp; production teams for shows you join can see these.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Input
                label="Phone"
                type="tel"
                placeholder="(555) 555-0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div>
                <Textarea
                  label="I describe myself as..."
                  rows={2}
                  placeholder="How you'd describe your appearance — in your own words"
                  value={appearance}
                  onChange={(e) => setAppearance(e.target.value)}
                />
                <p className="text-[11px] text-clay-400 mt-1">
                  Helps directors understand your range. Never shown publicly.
                </p>
              </div>
              <div>
                <Textarea
                  label="Accessibility & Accommodation Needs"
                  rows={2}
                  placeholder="Anything production teams should know to support you"
                  value={accessibility}
                  onChange={(e) => setAccessibility(e.target.value)}
                />
                <p className="text-[11px] text-clay-400 mt-1">
                  Only visible to you — a private reference for your own use.
                </p>
              </div>
              <div>
                <Input
                  label="Dealbreakers"
                  placeholder="Comma separated: nudity, stage combat"
                  value={dealbreakers}
                  onChange={(e) => setDealbreakers(e.target.value)}
                />
                <p className="text-[11px] text-clay-400 mt-1">
                  Shows with matching content advisories won&apos;t appear in your
                  Discover feed.
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                icon={<ArrowLeft className="w-4 h-4" weight="bold" />}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={finishActor}
                  loading={actorMutation.isPending}
                >
                  Skip
                </Button>
                <Button
                  onClick={finishActor}
                  loading={actorMutation.isPending}
                  icon={<Check className="w-4 h-4" weight="bold" />}
                >
                  Finish
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Done */}
        {step === 3 && (
          <div className="animate-fade-up text-center py-8">
            <div className="w-16 h-16 rounded-full bg-stage-100 flex items-center justify-center mx-auto mb-5">
              <Confetti className="w-8 h-8 text-stage-600" weight="duotone" />
            </div>
            <h1 className="text-3xl font-display text-curtain-900 mb-2">
              You&apos;re all set
              {displayName ? `, ${displayName.split(" ")[0]}` : ""}!
            </h1>
            <p className="text-sm text-clay-500 mb-8 max-w-sm mx-auto">
              Your profile is live. Start discovering auditions near you — and
              flesh out the rest of your profile any time.
            </p>
            <Button
              size="lg"
              onClick={() => router.push(next ?? "/discover")}
              icon={<ArrowRight className="w-4 h-4" weight="bold" />}
            >
              {next ? "Pick Up Where You Left Off" : "Start Exploring"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // THEATRE-MAKER WIZARD
  // ════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <StepIndicator steps={MAKER_STEPS} currentStep={step} />

      {/* STEP 0 — You */}
      {step === 0 && (
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display text-curtain-900 mb-1">
            About you
          </h1>
          <p className="text-sm text-clay-500 mb-6">
            How you&apos;ll show up to your cast and crew.
          </p>

          <div className="flex flex-col gap-4">
            <Input
              label="Your Name *"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={
                hasAttemptedSubmit && !displayName.trim() ? "Required" : undefined
              }
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-curtain-700 tracking-wide">
                Pronouns
              </label>
              <select
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value as Pronouns | "")}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300"
              >
                <option value="">Select pronouns</option>
                {PRONOUN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-curtain-700 tracking-wide">
                Your Primary Role
              </label>
              <select
                value={teamRole}
                onChange={(e) => setTeamRole(e.target.value as TeamRole)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300"
              >
                <option value="director">Director</option>
                <option value="music_director">Music Director</option>
                <option value="choreographer">Choreographer</option>
                <option value="stage_manager">Stage Manager</option>
                <option value="producer">Producer</option>
                <option value="asst_director">Asst. Director</option>
                <option value="accompanist">Accompanist</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setPath(null)}>
              Back
            </Button>
            <Button
              onClick={advanceMakerYou}
              icon={<ArrowRight className="w-4 h-4" weight="bold" />}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 1 — Theatre */}
      {step === 1 && (
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display text-curtain-900 mb-1">
            Your theatre
          </h1>
          <p className="text-sm text-clay-500 mb-6">
            The company you&apos;re casting for. You can update this later.
          </p>

          <div className="flex flex-col gap-4">
            <Input
              label="Theatre / Company Name *"
              placeholder="North County Theatre"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              error={hasAttemptedSubmit && !orgName.trim() ? "Required" : undefined}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="City *"
                value={orgCity}
                onChange={(e) => setOrgCity(e.target.value)}
                error={
                  hasAttemptedSubmit && !orgCity.trim() ? "Required" : undefined
                }
              />
              <Input
                label="State *"
                placeholder="CA"
                value={orgState}
                onChange={(e) => setOrgState(e.target.value)}
                error={
                  hasAttemptedSubmit && !orgState.trim() ? "Required" : undefined
                }
              />
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={() => setStep(0)}
              icon={<ArrowLeft className="w-4 h-4" weight="bold" />}
            >
              Back
            </Button>
            <Button
              onClick={submitMakerTheatre}
              loading={makerMutation.isPending}
              icon={<Check className="w-4 h-4" weight="bold" />}
            >
              Finish
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — Done */}
      {step === 2 && (
        <div className="animate-fade-up text-center py-8">
          <div className="w-16 h-16 rounded-full bg-stage-100 flex items-center justify-center mx-auto mb-5">
            <Confetti className="w-8 h-8 text-stage-600" weight="duotone" />
          </div>
          <h1 className="text-3xl font-display text-curtain-900 mb-2">
            {orgName || "Your theatre"} is ready
          </h1>
          <p className="text-sm text-clay-500 mb-8 max-w-sm mx-auto">
            Next, create your first show — add roles, set an audition schedule,
            and start finding your cast.
          </p>
          <Button
            size="lg"
            onClick={() => router.push("/shows/new")}
            icon={<ArrowRight className="w-4 h-4" weight="bold" />}
          >
            Create Your First Show
          </Button>
        </div>
      )}
    </div>
  );
}
