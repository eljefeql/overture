"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Button, useToast } from "@/components/ui";
import { track } from "@/lib/analytics";
import { GoogleLogo, CircleNotch, EnvelopeSimple } from "@phosphor-icons/react";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const pathHint = searchParams.get("path"); // landing CTA role hint: actor | maker
  const { beginOnboarding, loginWithGoogle, signUp, isLoading } = useAuth();
  const { toast } = useToast();
  const [googleLoading, setGoogleLoading] = useState(false);

  // Cloud-mode email/password form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const onboardingParams = new URLSearchParams();
  if (next) onboardingParams.set("next", next);
  if (pathHint === "actor" || pathHint === "maker")
    onboardingParams.set("path", pathHint);
  const onboardingUrl = onboardingParams.size
    ? `/onboarding?${onboardingParams.toString()}`
    : "/onboarding";

  function handleGetStarted() {
    beginOnboarding();
    router.push(onboardingUrl);
  }

  async function handleGoogle() {
    if (isSupabaseConfigured) {
      toast("info", "Google sign-in arrives with provider setup — use email for now.");
      return;
    }
    setGoogleLoading(true);
    const u = await loginWithGoogle();
    if (u.onboardingStep !== "complete") {
      router.push(onboardingUrl);
    } else {
      router.push(next ?? "/discover");
    }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    try {
      const result = await signUp(email.trim(), password);
      track("signup_completed");
      if (result.needsEmailConfirmation) {
        setAwaitingConfirmation(true);
        return;
      }
      router.push(onboardingUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed. Please try again.");
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-xl bg-stage-500 flex items-center justify-center mx-auto mb-6">
          <EnvelopeSimple className="w-7 h-7 text-curtain-900" weight="duotone" />
        </div>
        <h1 className="text-3xl font-display text-white mb-2">Check your email</h1>
        <p className="text-sm text-curtain-300 mb-8">
          We sent a confirmation link to <span className="text-white">{email}</span>.
          Click it to confirm your account, then sign in.
        </p>
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-sm text-stage-400 hover:text-stage-300"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md text-center">
      <div className="w-14 h-14 rounded-xl bg-stage-500 flex items-center justify-center mx-auto mb-6">
        <span className="text-curtain-900 font-display text-2xl font-bold">O</span>
      </div>
      <h1 className="text-3xl font-display text-white mb-2">Join Overture</h1>
      <p className="text-sm text-curtain-300 mb-10">
        Create your account and find your next role.
      </p>

      <div className="space-y-4">
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full py-3 px-4 flex items-center justify-center gap-2.5 text-sm font-semibold text-curtain-900 bg-white rounded-xl hover:bg-cream-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <>
              <CircleNotch className="w-5 h-5 animate-spin" weight="bold" />
              Connecting to Google&hellip;
            </>
          ) : (
            <>
              <GoogleLogo className="w-5 h-5" weight="bold" />
              Continue with Google
            </>
          )}
        </button>

        <div className="flex items-center gap-3 text-curtain-600">
          <div className="flex-1 h-px bg-curtain-700" />
          <span className="text-xs">or</span>
          <div className="flex-1 h-px bg-curtain-700" />
        </div>

        {isSupabaseConfigured ? (
          <form onSubmit={handleEmailSignup} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-curtain-300 tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-curtain-700 bg-curtain-800 text-white placeholder:text-curtain-500 focus:ring-2 focus:ring-stage-500 focus:border-stage-500 outline-none"
                placeholder="you@email.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-curtain-300 tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-curtain-700 bg-curtain-800 text-white placeholder:text-curtain-500 focus:ring-2 focus:ring-stage-500 focus:border-stage-500 outline-none"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-curtain-300 tracking-wide">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-curtain-700 bg-curtain-800 text-white placeholder:text-curtain-500 focus:ring-2 focus:ring-stage-500 focus:border-stage-500 outline-none"
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              />
            </div>
            {error && (
              <p className="text-xs text-ruby-400" role="alert">
                {error}
              </p>
            )}
            <Button size="lg" className="w-full" loading={isLoading}>
              Create Account
            </Button>
          </form>
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="w-full !text-white !border-curtain-700 hover:!bg-curtain-800"
            onClick={handleGetStarted}
            disabled={googleLoading}
          >
            Sign Up with Email
          </Button>
        )}
      </div>

      <p className="text-xs text-curtain-500 mt-6">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="text-stage-400 hover:text-stage-300">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-stage-400 hover:text-stage-300">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="text-xs text-curtain-500 mt-4">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-stage-400 hover:text-stage-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
