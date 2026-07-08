import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatHeight(inches: number | null): string {
  if (!inches) return "";
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

export function formatTeamRole(role: string): string {
  const map: Record<string, string> = {
    director: "Director",
    music_director: "Music Dir.",
    choreographer: "Choreo.",
    stage_manager: "SM",
    producer: "Producer",
    asst_director: "Asst. Dir.",
    asst_stage_manager: "Asst. SM",
    accompanist: "Accompanist",
  };
  return map[role] ?? role;
}

export function formatDate(date: string | null): string {
  if (!date) return "";
  // Date-only strings (YYYY-MM-DD) parse as UTC midnight, which renders a day
  // early in negative-offset timezones. Pin those to local noon. Full
  // timestamps (with a time component) are left to parse normally.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`)
    : new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Conflict text is stored with raw ISO dates ("2026-09-12 to 2026-09-13, …").
 * Format each embedded date for humans at display time, so existing rows
 * render nicely without a data migration.
 */
export function formatConflictText(text: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}/g, (d) => formatDate(d));
}

export function formatTime(datetime: string): string {
  return new Date(datetime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * LOCAL calendar-date key ("YYYY-MM-DD") for a timestamp. Never use
 * toISOString().slice(0,10) for day grouping — that's the UTC date, so an
 * 8:00 PM ET block lands on the NEXT day and evening schedules split under
 * duplicate day headers.
 */
export function localDateKey(datetime: string | Date): string {
  const d = typeof datetime === "string" ? new Date(datetime) : datetime;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Group audition blocks under LOCAL day headings ("Saturday, Sep 12"), days
 * in chronological order, blocks within a day sorted by start time. Shared by
 * the show setup schedule card and the public audition page (the signup modal
 * groups via locale date strings, which is equivalent).
 */
export function groupBlocksByDay<T extends { startTime: string }>(
  blocks: T[]
): { dateKey: string; label: string; blocks: T[] }[] {
  const byDay = new Map<string, T[]>();
  for (const b of blocks) {
    const dateKey = localDateKey(b.startTime);
    const arr = byDay.get(dateKey) ?? [];
    arr.push(b);
    byDay.set(dateKey, arr);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayBlocks]) => ({
      dateKey,
      label: new Date(dayBlocks[0].startTime).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      blocks: dayBlocks
        .slice()
        .sort((x, y) => x.startTime.localeCompare(y.startTime)),
    }));
}

export function formatMeasurement(inches: number | null): string {
  if (!inches) return "—";
  return `${inches}"`;
}

export function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
