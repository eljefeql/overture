/**
 * Next.js server instrumentation (runs once per server start).
 * See node_modules/next/dist/docs/01-app/02-guides/instrumentation.md.
 *
 * Sentry server/edge init is gated on NEXT_PUBLIC_SENTRY_DSN — when the
 * env var is absent this file does nothing at all (dormant-safe).
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/** Report server-side request errors (App Router hook). No-op without a DSN. */
export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
}
