/**
 * Client-side instrumentation — runs before hydration on every page load.
 * See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md.
 *
 * Sentry browser init is gated on NEXT_PUBLIC_SENTRY_DSN. When the env var
 * is absent (mock mode / keyless dev) nothing is loaded — the dynamic
 * import below never fires, so the Sentry bundle isn't even downloaded.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

const sentryPromise = SENTRY_DSN
  ? import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment:
          process.env.NEXT_PUBLIC_VERCEL_ENV ??
          process.env.NODE_ENV ??
          "development",
        tracesSampleRate: 0.1,
      });
      return Sentry;
    })
  : null;

/** Lets Sentry trace app-router navigations. Silent no-op without a DSN. */
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
) {
  sentryPromise
    ?.then((Sentry) =>
      Sentry.captureRouterTransitionStart(url, navigationType)
    )
    .catch(() => {});
}
