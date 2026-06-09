"use client";

import { cn } from "@/lib/utils";
import { Lock } from "@phosphor-icons/react";

type Props = {
  title: string;
  note?: string;
  className?: string;
};

/**
 * Section header with lock icon and privacy note.
 * Used for contact info, measurements, and other restricted-visibility sections.
 * See CLAUDE.md "Privacy Indicator" pattern.
 */
export function PrivacyHeader({
  title,
  note = "Only visible to you & production teams",
  className,
}: Props) {
  return (
    <div className={cn("flex items-center gap-1.5 mb-3", className)}>
      <h3 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase">
        {title}
      </h3>
      <Lock className="w-3 h-3 text-clay-400" weight="duotone" />
      <span className="text-[10px] text-clay-400">{note}</span>
    </div>
  );
}
