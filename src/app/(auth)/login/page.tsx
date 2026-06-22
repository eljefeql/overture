"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Button, useToast } from "@/components/ui";
import { GoogleLogo, CircleNotch } from "@phosphor-icons/react";
import type { User } from "@/types";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login, loginWithGoogle, isLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState(isSupabaseConfigured ? "" : "maria.santos@email.com");
  const [password, setPassword] = useState(isSupabaseConfigured ? "" : "demo");
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  function routeAfterAuth(u: User | null) {
    // New users who haven't finished onboarding go to the wizard first,
    // carrying the deep-link so they land back where they started.
    if (u && u.onboardingStep !== "complete") {
      router.push(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
      return;
    }
    if (next) {
      router.push(next);
      return;
    }
    router.push(u && !u.id.startsWith("user-team") ? "/discover" : "/shows");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const loggedIn = await login(email, password);
      if (!loggedIn) {
        setError("No account found with that email.");
        return;
      }
      routeAfterAuth(loggedIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    }
  };

  async function handleGoogle() {
    if (isSupabaseConfigured) {
      toast("info", "Google sign-in arrives with provider setup — use email for now.");
      return;
    }
    setGoogleLoading(true);
    const u = await loginWithGoogle();
    routeAfterAuth(u);
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-14 h-14 rounded-xl bg-stage-500 flex items-center justify-center mb-4">
          <span className="text-curtain-900 font-display text-2xl font-bold">O</span>
        </div>
        <h1 className="text-3xl font-display text-white mb-1">Welcome back</h1>
        <p className="text-sm text-curtain-300">Sign in to Overture</p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading || isLoading}
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

      <div className="flex items-center gap-3 text-curtain-600 my-5">
        <div className="flex-1 h-px bg-curtain-700" />
        <span className="text-xs">or</span>
        <div className="flex-1 h-px bg-curtain-700" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
          />
        </div>
        {error && (
          <p className="text-xs text-ruby-400" role="alert">
            {error}
          </p>
        )}
        <Button size="lg" className="w-full" loading={isLoading}>
          Sign In
        </Button>
      </form>

      <p className="text-xs text-curtain-500 mt-6 text-center">
        New to Overture?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="text-stage-400 hover:text-stage-300"
        >
          Create an account
        </Link>
      </p>

      {/* Demo accounts hint — mock mode only */}
      {!isSupabaseConfigured && (
        <div className="mt-8 p-4 rounded-xl bg-curtain-800/50 border border-curtain-700">
          <p className="text-xs text-curtain-400 font-medium mb-2">Demo accounts:</p>
          <div className="space-y-1 text-xs text-curtain-500">
            <p>Director: sarah.mitchell@email.com</p>
            <p>Actor: maria.santos@email.com</p>
            <p>SM: tom.briggs@email.com</p>
            <p>New user: newcomer@email.com</p>
            <p className="text-curtain-600">(any password works)</p>
          </div>
        </div>
      )}
    </div>
  );
}
