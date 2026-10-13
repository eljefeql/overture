"use client";

import { useEffect, useState } from "react";
import { Pill, Input } from "@/components/ui";

/* ============================================================
   Dance Styles — curated multi-select chips + "Other" free text.
   Replaces the free-CSV entry in ProfileEditModal and actor
   onboarding (QC item 11). The stored shape is unchanged: a
   plain string[] on the profile. Stored values that match a
   chip (case-insensitively) light that chip; anything else is
   preserved through the "Other" text field.
   ============================================================ */

export const DANCE_STYLE_OPTIONS = [
  "Ballet",
  "Tap",
  "Jazz",
  "Ballroom",
  "Hip-hop",
  "Contemporary",
  "Musical theatre",
  "Swing/partner",
];

const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

function matchOption(value: string): string | null {
  return (
    DANCE_STYLE_OPTIONS.find((o) => o.toLowerCase() === value.trim().toLowerCase()) ?? null
  );
}

function splitValue(value: string[]): { chips: string[]; others: string[] } {
  const chips: string[] = [];
  const others: string[] = [];
  for (const v of value) {
    const m = matchOption(v);
    if (m) {
      if (!chips.includes(m)) chips.push(m);
    } else if (v.trim()) {
      others.push(v.trim());
    }
  }
  return { chips, others };
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
};

export function DanceStylesField({ value, onChange, label = "Dance Styles" }: Props) {
  const { chips: selectedChips, others } = splitValue(value);
  const [otherText, setOtherText] = useState(others.join(", "));

  // Resync the free-text box only when the outside value changed in a way the
  // current text doesn't already represent (e.g. a form reset) — never while
  // the user is mid-typing (trailing commas parse to the same list).
  useEffect(() => {
    if (!sameSet(csv(otherText), others)) setOtherText(others.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (chips: string[], otherRaw: string) => {
    onChange([...chips, ...csv(otherRaw)]);
  };

  const toggleChip = (option: string) => {
    const next = selectedChips.includes(option)
      ? selectedChips.filter((c) => c !== option)
      : [...selectedChips, option];
    emit(next, otherText);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {DANCE_STYLE_OPTIONS.map((option) => (
          <Pill
            key={option}
            variant="role"
            active={selectedChips.includes(option)}
            onClick={() => toggleChip(option)}
          >
            {option}
          </Pill>
        ))}
      </div>
      <Input
        value={otherText}
        onChange={(e) => {
          setOtherText(e.target.value);
          emit(selectedChips, e.target.value);
        }}
        placeholder="Other styles — comma separated (e.g. Irish step, Flamenco)"
        aria-label="Other dance styles"
      />
    </div>
  );
}
