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

export function Modal({ open, onClose, title, children, className }: Props) {
  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
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
    // Outer wrapper catches all clicks, prevents them from reaching page beneath
    <div
      className="fixed inset-0 z-40"
      onClick={(e) => {
        // Only close if clicking the backdrop area (not the modal panel)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-curtain-900/50 transition-opacity"
        aria-hidden
      />

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // Mobile: bottom sheet
          "fixed bottom-0 left-0 right-0 z-50",
          "max-h-[90vh] overflow-y-auto",
          "bg-white rounded-t-3xl",
          "animate-slide-up",
          // Desktop: centered modal
          "md:bottom-auto md:left-1/2 md:top-1/2 md:right-auto",
          "md:-translate-x-1/2 md:-translate-y-1/2",
          "md:rounded-2xl md:max-w-lg md:w-full",
          "md:max-h-[85vh]",
          "md:animate-scale-in",
          "shadow-2xl",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Drag handle (mobile only) */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-cream-300" />
        </div>

        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 bg-white px-6 py-4 flex items-center justify-between border-b border-cream-200">
            <h2 className="text-lg font-display text-curtain-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-clay-400 hover:text-curtain-900 hover:bg-cream-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" weight="bold" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
