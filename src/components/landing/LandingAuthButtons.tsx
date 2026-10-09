"use client";

import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui";

/* ============================================================
   Landing header actions — session-aware island on the static
   landing page. Signed-out: Sign In + Get Started. Signed-in:
   one "Open Overture" button, so arriving here never reads as
   being signed out.
   ============================================================ */

export function LandingAuthButtons() {
  const { user } = useAuth();

  if (user) {
    return (
      <Link href="/discover">
        <Button size="sm">Open Overture</Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="px-4 py-2 text-sm font-medium text-curtain-300 hover:text-white transition"
      >
        Sign In
      </Link>
      <Link href="/signup">
        <Button size="sm">Get Started</Button>
      </Link>
    </div>
  );
}
