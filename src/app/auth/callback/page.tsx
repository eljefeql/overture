"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { useAuth, takeAuthReturn } from "@/features/auth/AuthContext";
import { getHomeRoute } from "@/lib/api/client";
import { CircleNotch } from "@phosphor-icons/react";

/* ============================================================
   OAuth return pad — Google (and future providers) redirect
   here. The Supabase client picks the session out of the URL;
   AuthContext maps it to a User; then we route by onboarding
   state, exactly like a password sign-in.
   ============================================================ */

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  const providerError =
    params.get("error_description") ?? params.get("error");

  // Carried through the OAuth round-trip by loginWithGoogle (same deep-link
  // + role-hint semantics as the password login/signup pages). The stash
  // covers the email-confirmation link and any provider that drops the
  // query string. Read once per mount.
  const [ret] = useState(() => {
    const stash = typeof window !== "undefined" ? takeAuthReturn() : { next: null, path: null };
    return {
      next: params.get("next") ?? stash.next,
      path: params.get("path") ?? stash.path,
    };
  });
  const next = ret.next;
  const pathHint = ret.path;

  useEffect(() => {
    if (providerError) return;
    if (user) {
      if (user.onboardingStep !== "complete") {
        const qs = new URLSearchParams();
        if (next) qs.set("next", next);
        if (pathHint === "actor" || pathHint === "maker") qs.set("path", pathHint);
        const s = qs.toString();
        router.replace(`/onboarding${s ? `?${s}` : ""}`);
        return;
      }
      if (next && next.startsWith("/")) {
        router.replace(next);
        return;
      }
      let cancelled = false;
      getHomeRoute(user.id).then((dest) => {
        if (!cancelled) router.replace(dest);
      });
      return () => {
        cancelled = true;
      };
    }
    if (!isLoading) {
      // Session not there yet — give the URL exchange a moment before
      // declaring failure (supabase-js processes the hash asynchronously).
      const t = setTimeout(() => setTimedOut(true), 6000);
      return () => clearTimeout(t);
    }
  }, [user, isLoading, providerError, router, next, pathHint]);

  if (providerError || timedOut) {
    return (
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-display text-white mb-3">
          Sign-in didn&apos;t finish
        </h1>
        <p className="text-sm text-curtain-300 mb-6">
          {providerError ?? "We couldn't complete the sign-in. Please try again."}
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-stage-400 hover:text-stage-300"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <CircleNotch className="w-8 h-8 text-stage-400 animate-spin" weight="bold" />
      <p className="text-sm text-curtain-300">Finishing sign-in&hellip;</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-curtain-900 flex items-center justify-center px-6">
      <Suspense fallback={null}>
        <CallbackInner />
      </Suspense>
    </div>
  );
}
