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

  return (
    <div className="bg-stage-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Eye className="w-4 h-4 text-stage-700 flex-shrink-0" weight="duotone" />
        <span className="text-curtain-800">
          You&apos;re viewing the public page — this is what actors see.
        </span>
        <Link
          href={target.href}
          className="inline-flex items-center gap-1 font-semibold text-curtain-900 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
          Back to {target.name}
        </Link>
      </div>
    </div>
  );
}
