import { cn } from "@/lib/utils";
import { SealCheck } from "@phosphor-icons/react/dist/ssr";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "gold" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-curtain-50 text-curtain-600 border-curtain-200",
  success: "bg-forest-100 text-forest-700 border-forest-200",
  warning: "bg-stage-50 text-stage-700 border-stage-200",
  danger: "bg-ruby-50 text-ruby-600 border-ruby-200",
  gold: "bg-stage-100 text-stage-700 border-stage-200",
  muted: "bg-cream-100 text-clay-500 border-cream-200",
};

type Props = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
};

export function Badge({ children, variant = "default", size = "sm", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px] tracking-wide" : "px-3 py-1 text-xs",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <SealCheck
      className={cn("w-4 h-4 text-stage-500 flex-shrink-0", className)}
      weight="fill"
    />
  );
}
