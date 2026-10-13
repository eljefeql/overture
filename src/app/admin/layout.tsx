"use client";

import { AuthGuard } from "@/features/auth/AuthGuard";
import { Nav } from "@/components/ui";

/* ============================================================
   Platform admin layout — deliberately OUTSIDE the (production)
   route group: that layout's org-membership + show gating has
   nothing to do with platform administration. AuthGuard still
   applies (anonymous → /login); whether the signed-in user may
   actually see anything is decided inside the page by the
   is_platform_admin check (non-admins get a "page not found"
   empty state — the page is never advertised).
   ============================================================ */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <Nav />
      <main className="flex-1">{children}</main>
    </AuthGuard>
  );
}
