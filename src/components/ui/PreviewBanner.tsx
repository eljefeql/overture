"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { getOrg, getOrgAccess, getShow, getShowAccess } from "@/lib/api/client";
import { ArrowLeft, Eye } from "@phosphor-icons/react";

/* ============================================================
   PreviewBanner — "you're seeing what actors see"

   Shown at the top of a public page ONLY when the signed-in
   viewer manages the thing on the page (show team / org admin
   for shows, org member for theatre pages). Regular actors and
   anonymous visitors never see it. One cached query per page;
   any failure silently renders nothing — the public page must
   never depend on this.
   ============================================================ */

type Props =
  | { kind: "show"; showId: string; backSegment?: "setup" | "hub" }
  | { kind: "theatre"; orgId: string };

type BannerTarget = { name: string; href: string } | null;

export function PreviewBanner(props: Props) {
  const { user } = useAuth();

  const targetId = props.kind === "show" ? props.showId : props.orgId;
  const backSegment = props.kind === "show" ? (props.backSegment ?? "setup") : null;

  const { data: target } = useQuery<BannerTarget>({
    queryKey: ["previewBanner", props.kind, targetId, backSegment, user?.id],
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
    queryFn: async () => {
      try {
        if (props.kind === "show") {
          const canManage = await getShowAccess(props.showId, user!.id);
          if (!canManage) return null;
          const show = await getShow(props.showId);
          return {
            name: show?.title ?? "your show",
            href: `/shows/${props.showId}/${backSegment}`,
          };
        }
        const isMember = await getOrgAccess(props.orgId, user!.id);
        if (!isMember) return null;
        const org = await getOrg(props.orgId);
        return { name: org?.name ?? "your theatre", href: "/org" };
      } catch {
        // Silent fail — the banner is a convenience, never a blocker.
        return null;
      }
    },
  });

  if (!user || !target) return null;

  // Sticky just below the top nav (nav is h-14, sticky z-30) so team viewers
  // never lose the way back while scrolling the public page.
  return (
    <div className="sticky top-14 z-20 bg-stage-100 border-b border-stage-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 text-curtain-900 font-semibold">
          <Eye className="w-4 h-4 text-stage-700 flex-shrink-0" weight="duotone" />
          You&apos;re viewing the public page
        </span>
        <span className="text-curtain-800 hidden sm:inline">
          — this is what actors see.
        </span>
        <Link
          href={target.href}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-stage-300 font-semibold text-curtain-900 hover:bg-stage-50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
          Back to {target.name}
        </Link>
      </div>
    </div>
  );
}
