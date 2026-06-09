"use client";

import { cn, getInitials } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
type AvatarVariant = "person" | "org";

const sizeClasses: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-xl",
  xl: "w-28 h-28 text-3xl font-display",
};

type Props = {
  name: string;
  imageUrl?: string | null;
  size?: AvatarSize;
  variant?: AvatarVariant;
  className?: string;
};

export function Avatar({
  name,
  imageUrl,
  size = "md",
  variant = "person",
  className,
}: Props) {
  const shape = variant === "person" ? "rounded-full" : "rounded-xl";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          sizeClasses[size],
          shape,
          "object-cover flex-shrink-0",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        shape,
        "flex items-center justify-center flex-shrink-0 font-bold",
        "bg-curtain-100 text-curtain-600",
        className
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
