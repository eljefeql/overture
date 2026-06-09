"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getShow } from "@/lib/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { ProductionTopNav } from "@/components/ui/ProductionTopNav";
import { ProductionSubNav } from "@/components/ui/ProductionSubNav";

/* ============================================================
   Production Layout — Two-tier navigation + content area

   Extracts showId from the URL to power the sub-nav and
   show switcher. Sub-nav only renders when inside a show.
   Auto-switches auth role to "team" for production features.
   ============================================================ */

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeRole, switchRole } = useAuth();

  // Auto-switch to team role when on production pages
  // Uses the actual showId from the URL (or falls back to "show-1")
  useEffect(() => {
    const urlShowId = pathname?.match(/\/shows\/([^/]+)\//)?.[1] ?? "show-1";
    if (activeRole.type !== "team") {
      switchRole({ type: "team", showId: urlShowId, teamRole: "director" });
    } else if (activeRole.type === "team" && activeRole.showId !== urlShowId && urlShowId !== "show-1") {
      // Update showId if user navigated to a different show
      switchRole({ type: "team", showId: urlShowId, teamRole: activeRole.teamRole });
    }
  }, [activeRole, switchRole, pathname]);

  // Extract showId from URL: /shows/[showId]/...
  const showIdMatch = pathname?.match(/\/shows\/([^/]+)\/(setup|auditions|callbacks|casting|cast-list)/);
  const showId = showIdMatch?.[1] ?? null;

  // Fetch show data for nav context (only when inside a show)
  const { data: show } = useQuery({
    queryKey: ["show", showId],
    queryFn: () => getShow(showId!),
    enabled: !!showId,
  });

  return (
    <>
      <ProductionTopNav
        currentShowId={showId ?? undefined}
        currentShowTitle={show?.title}
      />
      {showId && (
        <ProductionSubNav
          showId={showId}
          showStatus={show?.status}
        />
      )}
      <main className="flex-1">{children}</main>
    </>
  );
}
