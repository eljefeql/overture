"use client";

import { useSyncExternalStore } from "react";
import { Phone, ChatCircleText, Envelope, Copy, PaperPlaneTilt } from "@phosphor-icons/react";
import { copyText } from "@/lib/share";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

/**
 * Contact flow (QC #32 — "HOLY SHIT YES"). One small component used by the
 * hub's production-team cards and the Who-to-Contact routing rows.
 *
 *  - Touch / narrow (phones): phone → Call (`tel:`) + Text (`sms:`) buttons,
 *    email → Email (`mailto:`). Natural taps.
 *  - Desktop: the number / address shown as TEXT with a one-click Copy
 *    (toast "Copied"), and mailto kept as a secondary ghost action.
 *  - Optional "Send a note" button (team members with accounts) — the
 *    parent owns the modal + the 30s post-send cooldown.
 *
 * Never decides WHAT to show: the caller passes only the details the
 * team chose to share.
 */

/** Coarse-pointer / no-hover devices get the tap-first layout. */
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
function subscribeTouch(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(TOUCH_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function readTouch() {
  return typeof window !== "undefined" && !!window.matchMedia?.(TOUCH_QUERY).matches;
}
export function useIsTouch(): boolean {
  // Server snapshot = false (desktop layout), corrected on hydration.
  return useSyncExternalStore(subscribeTouch, readTouch, () => false);
}

/** Digits (+ leading plus) only — what tel:/sms: links want. */
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned || phone.trim();
}

type Props = {
  /** Person's name — used in aria-labels only. */
  name: string;
  phone?: string | null;
  email?: string | null;
  /** Present = show "Send a note". */
  onNote?: () => void;
  /** Cooldown / in-flight — the button is disabled with a hint. */
  noteDisabled?: boolean;
  className?: string;
};

const chip =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-curtain-700 bg-cream-100 hover:bg-cream-200 active:bg-cream-300 transition min-h-[36px]";
const iconBtn =
  "p-1.5 rounded-lg text-curtain-600 hover:text-curtain-900 hover:bg-cream-100 transition";

export function ContactActions({
  name,
  phone,
  email,
  onNote,
  noteDisabled,
  className,
}: Props) {
  const isTouch = useIsTouch();
  const { toast } = useToast();
  const hasPhone = !!phone?.trim();
  const hasEmail = !!email?.trim();
  if (!hasPhone && !hasEmail && !onNote) return null;

  const copy = async (value: string, what: string) => {
    const ok = await copyText(value);
    toast(ok ? "success" : "error", ok ? "Copied" : `Couldn't copy — ${what} is ${value}`);
  };

  const noteButton = onNote && (
    <button
      type="button"
      onClick={onNote}
      disabled={noteDisabled}
      className={cn(chip, "disabled:opacity-50 disabled:cursor-not-allowed")}
      title={noteDisabled ? "Give it a moment before sending another note" : `Send ${name} a note`}
      aria-label={`Send ${name} a note`}
    >
      <PaperPlaneTilt className="w-4 h-4 text-stage-500" weight="duotone" />
      Send a note
    </button>
  );

  if (isTouch) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {hasPhone && (
          <>
            <a href={`tel:${telHref(phone!)}`} className={chip} aria-label={`Call ${name}`}>
              <Phone className="w-4 h-4 text-stage-500" weight="duotone" />
              Call
            </a>
            <a href={`sms:${telHref(phone!)}`} className={chip} aria-label={`Text ${name}`}>
              <ChatCircleText className="w-4 h-4 text-stage-500" weight="duotone" />
              Text
            </a>
          </>
        )}
        {hasEmail && (
          <a href={`mailto:${email!.trim()}`} className={chip} aria-label={`Email ${name}`}>
            <Envelope className="w-4 h-4 text-stage-500" weight="duotone" />
            Email
          </a>
        )}
        {noteButton}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {hasPhone && (
        <div className="flex items-center gap-1 min-w-0">
          <Phone className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
          <span className="text-sm text-curtain-800 truncate select-all">{phone!.trim()}</span>
          <button
            type="button"
            onClick={() => copy(phone!.trim(), "the number")}
            className={iconBtn}
            aria-label={`Copy ${name}'s phone number`}
            title="Copy"
          >
            <Copy className="w-4 h-4" weight="duotone" />
          </button>
        </div>
      )}
      {hasEmail && (
        <div className="flex items-center gap-1 min-w-0">
          <Envelope className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
          <span className="text-sm text-curtain-800 truncate select-all">{email!.trim()}</span>
          <button
            type="button"
            onClick={() => copy(email!.trim(), "the address")}
            className={iconBtn}
            aria-label={`Copy ${name}'s email address`}
            title="Copy"
          >
            <Copy className="w-4 h-4" weight="duotone" />
          </button>
          <a
            href={`mailto:${email!.trim()}`}
            className={cn(iconBtn, "text-clay-400")}
            aria-label={`Email ${name}`}
            title="Open in your mail app"
          >
            <PaperPlaneTilt className="w-4 h-4" weight="duotone" />
          </a>
        </div>
      )}
      {noteButton && <div className="mt-1">{noteButton}</div>}
    </div>
  );
}
