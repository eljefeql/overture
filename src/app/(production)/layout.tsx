"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getShow, getShowAccess } from "@/lib/api/client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useOrg } from "@/features/auth/useOrg";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { ProductionTopNav } from "@/components/ui/ProductionTopNav";
import { ProductionSubNav } from "@/components/ui/ProductionSubNav";
import { Button, EmptyState, PageSkeleton } from "@/components/ui";
import { Buildings, LockSimple } from "@phosphor-icons/react";

/* ============================================================
   Production Layout — Two-tier navigation + content area

   Extracts showId from the URL to power the sub-nav and
   show switcher. Sub-nav only renders when inside a show.
   Auto-switches auth role to "team" for production features.

   Cloud mode adds membership gating:
   - Inside a show: must be on the show's team OR an owner/admin
     of the show's org.
   - Outside a show (/shows, /org, /shows/new): must belong to a
     theatre — otherwise a friendly nudge to onboarding.
   ============================================================ */

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, activeRole, switchRole } = useAuth();
  const { org, isLoading: orgLoading } = useOrg();

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

  // Cloud-mode access check: show team member OR org admin of the show's org
  const { data: hasShowAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["showAccess", showId, user?.id],
    queryFn: () => getShowAccess(showId!, user!.id),
    enabled: isSupabaseConfigured && !!showId && !!user,
  });

  let content = children;
  if (isSupabaseConfigured && user) {
    const checking = showId ? accessLoading : orgLoading;
    if (checking) {
      content = <PageSkeleton />;
    } else if (showId && !hasShowAccess) {
      content = (
        <div className="max-w-2xl mx-auto px-6 py-16">
          <EmptyState
            icon={<LockSimple className="w-12 h-12" weight="duotone" />}
            title="You don't have access to this show"
            description="Only the production team and theatre admins can work on a show. Ask the director or theatre owner to add you to the team."
            action={
              <Link href="/shows">
                <Button size="sm">Back to Shows</Button>
              </Link>
            }
          />
        </div>
      );
    } else if (!showId && !org) {
      content = (
        <div className="max-w-2xl mx-auto px-6 py-16">
          <EmptyState
            icon={<Buildings className="w-12 h-12" weight="duotone" />}
            title="You're not part of a theatre yet"
            description="Create your theatre to start producing shows, or ask a theatre admin to invite you with the email you signed in with."
            action={
              <Link href="/onboarding">
                <Button size="sm">Set Up Your Theatre</Button>
              </Link>
            }
          />
        </div>
      );
    }
  }

  return (
    <AuthGuard>
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
      <main className="flex-1">{content}</main>
    </AuthGuard>
  );
}
