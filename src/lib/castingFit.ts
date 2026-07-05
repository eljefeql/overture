import type { ConflictRange, ShowConflictEntry } from "@/types";

/* ============================================================
   Casting fit helpers — Week 4 casting-board upgrades.

   Soft-warning heuristics only: a mismatch here is a "heads up",
   never a blocker. Community theatre casts against type all the
   time — the director stays in charge.
   ============================================================ */

/** Count DISTINCT unavailable days across (possibly overlapping) ranges. */
export function countConflictDays(ranges: ConflictRange[]): number {
  const days = new Set<number>();
  for (const range of ranges) {
    const start = toEpochDay(range.startDate);
    const end = toEpochDay(range.endDate);
    if (start === null || end === null) continue;
    for (let d = start; d <= end && d - start < 366; d++) days.add(d);
  }
  return days.size;
}

function toEpochDay(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

/** actorId → distinct conflict-day count, from the Conflict Calendar read model. */
export function conflictDaysByActor(
  entries: ShowConflictEntry[] | undefined
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries ?? []) {
    map.set(entry.actorId, countConflictDays(entry.ranges));
  }
  return map;
}

// Recognized voice parts — free-text vocal ranges get reduced to these.
const VOICE_PARTS = [
  "soprano",
  "mezzo",
  "alto",
  "contralto",
  "tenor",
  "baritenor",
  "baritone",
  "bass",
] as const;

function voiceParts(range: string | null): Set<string> {
  const found = new Set<string>();
  if (!range) return found;
  const lower = range.toLowerCase();
  for (const part of VOICE_PARTS) {
    if (lower.includes(part)) found.add(part);
  }
  return found;
}

/**
 * True when BOTH sides name a recognizable voice part and they share none.
 * "Mezzo-Soprano" vs "Soprano C4-Bb5" → overlap → no mismatch.
 * "Tenor" vs "Soprano C4-Bb5" → disjoint → mismatch.
 * Unparseable / missing on either side → never warn.
 */
export function vocalMismatch(
  roleRange: string | null,
  actorRange: string | null
): boolean {
  const roleParts = voiceParts(roleRange);
  const actorParts = voiceParts(actorRange);
  if (roleParts.size === 0 || actorParts.size === 0) return false;
  for (const part of actorParts) {
    if (roleParts.has(part)) return false;
  }
  return true;
}

/** Parse a role's age-range string: "25-45", "16+", "18 - 30". */
export function parseRoleAgeRange(
  ageRange: string | null
): { low: number; high: number } | null {
  if (!ageRange) return null;
  const span = /^\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\s*$/.exec(ageRange);
  if (span) return { low: Number(span[1]), high: Number(span[2]) };
  const open = /^\s*(\d{1,3})\s*\+\s*$/.exec(ageRange);
  if (open) return { low: Number(open[1]), high: 200 };
  return null;
}

/**
 * True when the role's age range and the actor's playable age range are BOTH
 * known and don't overlap at all. Missing/unparseable data → never warn.
 */
export function ageMismatch(
  roleAgeRange: string | null,
  actorLow: number | null,
  actorHigh: number | null
): boolean {
  const role = parseRoleAgeRange(roleAgeRange);
  if (!role || (actorLow === null && actorHigh === null)) return false;
  const low = actorLow ?? actorHigh!;
  const high = actorHigh ?? actorLow!;
  return high < role.low || low > role.high;
}
