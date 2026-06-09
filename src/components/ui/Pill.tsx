"use client";

import { cn } from "@/lib/utils";

type PillVariant = "role" | "status" | "filter" | "endorsement";

const variantStyles: Record<PillVariant, string> = {
  role: "bg-curtain-50 text-curtain-700 border-curtain-200",
  status: "bg-stage-100 text-stage-700 border-stage-200",
  filter: "bg-cream-100 text-clay-600 border-cream-300",
  endorsement: "bg-stage-50 text-stage-700 border-stage-200",
};

type Props = {
  children: React.ReactNode;
  variant?: PillVariant;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Pill({
  children,
  variant = "role",
  active = false,
  onClick,
  className,
}: Props) {
  const isToggle = !!onClick;

  return (
    <span
      role={isToggle ? "button" : undefined}
      tabIndex={isToggle ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isToggle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150",
        variantStyles[variant],
        active && "bg-curtain-700 text-white border-curtain-700",
        isToggle && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      {children}
    </span>
  );
}
