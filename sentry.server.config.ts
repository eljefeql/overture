// Sentry — Node.js server runtime. Only imported by src/instrumentation.ts
// when NEXT_PUBLIC_SENTRY_DSN is set, so this init is never reached dormant.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
});
