import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Standard section header — uppercase, small, plum-colored.
 * See CLAUDE.md "Section Header" pattern.
 */
export function SectionHeader({ children, className }: Props) {
  return (
    <h3
      className={cn(
        "text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3",
        className
      )}
    >
      {children}
    </h3>
  );
}
