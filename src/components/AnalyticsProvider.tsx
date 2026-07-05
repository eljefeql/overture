"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isAnalyticsConfigured, trackPageview } from "@/lib/analytics";

/**
 * Captures a PostHog pageview on every app-router navigation.
 * Renders nothing; mounts nothing at all when PostHog isn't configured,
 * so mock mode / keyless dev has zero analytics footprint.
 */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams?.toString();
    trackPageview(
      window.location.origin + pathname + (search ? `?${search}` : "")
    );
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {isAnalyticsConfigured && (
        // useSearchParams needs a Suspense boundary during prerender.
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
      )}
      {children}
    </>
  );
}
