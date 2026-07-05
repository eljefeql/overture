import type { PostHog } from "posthog-js";

/**
 * Product analytics — thin PostHog wrapper.
 *
 * Dormant-safe: when NEXT_PUBLIC_POSTHOG_KEY is not set (mock mode, local
 * dev without keys), every function here is a silent no-op and posthog-js
 * is never even downloaded (lazy dynamic import keeps it out of the main
 * bundle). Callers sprinkle one-line `track(...)` calls at success points
 * and never need to think about configuration.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const isAnalyticsConfigured = Boolean(KEY);

let posthogPromise: Promise<PostHog> | null = null;

/** Lazy-load + init posthog-js on first use. Returns null when unconfigured. */
function getPostHog(): Promise<PostHog> | null {
  if (!KEY || typeof window === "undefined") return null;
  if (!posthogPromise) {
    posthogPromise = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        // Pageviews are captured manually by AnalyticsProvider so SPA
        // navigations are counted deterministically.
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
      });
      return posthog;
    });
  }
  return posthogPromise;
}

/** Capture a product event. Silent no-op when PostHog isn't configured. */
export function track(event: string, props?: Record<string, unknown>): void {
  getPostHog()
    ?.then((p) => p.capture(event, props))
    .catch(() => {});
}

/** Tie events to a signed-in user. Cloud mode only — never call with mock personas. */
export function identify(userId: string, props?: Record<string, unknown>): void {
  getPostHog()
    ?.then((p) => p.identify(userId, props))
    .catch(() => {});
}

/** Clear the identified user (call on sign-out). */
export function resetAnalytics(): void {
  if (!posthogPromise) return;
  posthogPromise.then((p) => p.reset()).catch(() => {});
}

/** Manual pageview capture (used by AnalyticsProvider on route changes). */
export function trackPageview(url: string): void {
  track("$pageview", { $current_url: url });
}
