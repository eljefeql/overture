import { cn } from "@/lib/utils";
import type { ReactNode, HTMLAttributes } from "react";

type CardVariant = "elevated" | "flat" | "sunken" | "highlighted";

const variantClasses: Record<CardVariant, string> = {
  elevated: "bg-white rounded-2xl border border-cream-200 shadow-md",
  flat: "bg-white rounded-2xl border border-cream-200",
  sunken: "bg-cream-50 rounded-2xl border border-cream-200",
  highlighted: "bg-white rounded-2xl border-2 border-stage-300 shadow-sm",
};

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: "compact" | "standard" | "spacious";
  interactive?: boolean;
  children: ReactNode;
};

const paddingClasses = {
  compact: "p-3",
  standard: "p-5",
  spacious: "p-8",
};

export function Card({
  variant = "elevated",
  padding = "standard",
  interactive = false,
  className,
  children,
  ...props
}: Props) {
  return (
    <div
      className={cn(
        variantClasses[variant],
        paddingClasses[padding],
        interactive &&
          "cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-stage-300",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3 className={cn("text-lg font-display text-curtain-900", className)}>
      {children}
    </h3>
  );
}
