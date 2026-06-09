"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CircleNotch } from "@phosphor-icons/react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-stage-500 text-curtain-900 hover:bg-stage-400 active:bg-stage-600 shadow-sm hover:shadow-md",
  secondary:
    "bg-curtain-700 text-white hover:bg-curtain-600 active:bg-curtain-800 shadow-sm",
  outline:
    "border border-curtain-200 text-curtain-700 hover:bg-curtain-50 active:bg-curtain-100",
  ghost:
    "text-curtain-600 hover:text-curtain-900 hover:bg-cream-100 active:bg-cream-200",
  danger:
    "bg-ruby-500 text-white hover:bg-ruby-600 active:bg-ruby-700 shadow-sm",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-lg gap-2",
  lg: "px-6 py-3 text-base rounded-xl gap-2",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-150",
          "hover:-translate-y-0.5 active:translate-y-0",
          variantClasses[variant],
          sizeClasses[size],
          isDisabled && "opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-sm",
          className
        )}
        {...props}
      >
        {loading ? (
          <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
