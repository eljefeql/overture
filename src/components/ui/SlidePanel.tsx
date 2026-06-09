"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "@phosphor-icons/react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function SlidePanel({ open, onClose, title, children, className }: Props) {
  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-curtain-900/40 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-lg bg-cream-50 shadow-2xl z-50",
          "overflow-y-auto animate-slide-in-right",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 bg-cream-50/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-cream-200">
            <h2 className="text-lg font-display text-curtain-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-clay-400 hover:text-curtain-900 hover:bg-cream-100 transition"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" weight="bold" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6">{children}</div>
      </div>
    </>
  );
}
