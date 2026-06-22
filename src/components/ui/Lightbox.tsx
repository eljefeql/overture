"use client";

import { useEffect, useCallback } from "react";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react";

/* ============================================================
   Lightbox — full-screen photo overlay with caption.
   Prev/next via on-screen buttons AND keyboard arrows; Esc
   closes. Handles any number of photos (wraps around). Used by
   the public theatre photo gallery.
   ============================================================ */

export type LightboxPhoto = {
  url: string;
  caption?: string | null;
  /** Optional category label shown beside the caption (e.g. "Venue"). */
  label?: string | null;
};

type Props = {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function Lightbox({ photos, index, onClose, onIndexChange }: Props) {
  const open = index != null && index >= 0 && index < photos.length;

  const go = useCallback(
    (delta: number) => {
      if (index == null || photos.length === 0) return;
      const next = (index + delta + photos.length) % photos.length;
      onIndexChange(next);
    },
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose, go]);

  if (!open) return null;
  const photo = photos[index];
  const many = photos.length > 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-curtain-900/90 animate-fade-up"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6" weight="bold" />
      </button>

      {/* Prev */}
      {many && (
        <button
          onClick={() => go(-1)}
          aria-label="Previous photo"
          className="absolute left-3 sm:left-6 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <CaretLeft className="w-6 h-6" weight="bold" />
        </button>
      )}

      {/* Image + caption */}
      <figure className="flex flex-col items-center max-w-[90vw] max-h-[90vh] px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? "Photo"}
          className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl"
        />
        <figcaption className="mt-3 flex items-center gap-2 text-center text-cream-100">
          {photo.label && (
            <span className="text-[10px] font-semibold text-stage-300 tracking-wide uppercase">
              {photo.label}
            </span>
          )}
          {photo.caption && <span className="text-sm">{photo.caption}</span>}
          {many && (
            <span className="text-xs text-cream-300">
              {index + 1} / {photos.length}
            </span>
          )}
        </figcaption>
      </figure>

      {/* Next */}
      {many && (
        <button
          onClick={() => go(1)}
          aria-label="Next photo"
          className="absolute right-3 sm:right-6 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <CaretRight className="w-6 h-6" weight="bold" />
        </button>
      )}
    </div>
  );
}
