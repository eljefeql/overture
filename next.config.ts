import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 allows ONE dev server per distDir (lockfile at <distDir>/dev/lock).
  // Set NEXT_DIST_DIR (e.g. ".next-mock") to run a second dev server — the
  // mock-mode instance on :3002 beside staging on :3001 — without stopping
  // the first. Unset = the normal ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
