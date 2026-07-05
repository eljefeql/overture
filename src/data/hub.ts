/**
 * Mock data for the Show Hub (rehearsals, announcements, absences, comm
 * norms). Rehearsal dates are generated RELATIVE TO TODAY so the "Your next
 * call" card and the This Week section always have something to show in a
 * demo, whenever it's run.
 */

import type {
  Rehearsal,
  RehearsalAbsence,
  Announcement,
  CommNormItem,
} from "@/types";

/** A YYYY-MM-DD date string n days from today (local). */
function dayFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO timestamp on the date n days from today at HH:MM local. */
function timeOn(n: number, hhmm: string): string {
  return new Date(`${dayFromNow(n)}T${hhmm}:00`).toISOString();
}

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const rehearsals: Rehearsal[] = [
  {
    id: "reh-1",
    showId: "show-1",
    date: dayFromNow(1),
    startTime: timeOn(1, "18:30"),
    endTime: timeOn(1, "21:30"),
    location: "NCT Rehearsal Hall, 1236 Oak Ave",
    focus: "Act 1, sc. 1–3 — Prologue & Cinderella at the Grave",
    notes: "Bring pencils for blocking notes.",
    calledScope: "everyone",
    calledGroup: null,
    calledPeople: [],
  },
  {
    id: "reh-2",
    showId: "show-1",
    date: dayFromNow(3),
    startTime: timeOn(3, "18:30"),
    endTime: timeOn(3, "21:00"),
    location: "NCT Rehearsal Hall, 1236 Oak Ave",
    focus: "Music — 'It Takes Two' & 'Giants in the Sky'",
    notes: null,
    calledScope: "custom",
    calledGroup: null,
    calledPeople: ["actor-1", "actor-2"],
  },
  {
    id: "reh-3",
    showId: "show-1",
    date: dayFromNow(5),
    startTime: timeOn(5, "10:00"),
    endTime: timeOn(5, "13:00"),
    location: "NCT Main Stage, 1234 Oak Ave",
    focus: "Act 1 stumble-through",
    notes: "First time on the main stage — enter through the lobby.",
    calledScope: "group",
    calledGroup: "principals",
    calledPeople: [],
  },
  {
    id: "reh-4",
    showId: "show-1",
    date: dayFromNow(8),
    startTime: timeOn(8, "18:30"),
    endTime: timeOn(8, "21:30"),
    location: "NCT Rehearsal Hall, 1236 Oak Ave",
    focus: "Act 2, sc. 1–2 — openings",
    notes: null,
    calledScope: "everyone",
    calledGroup: null,
    calledPeople: [],
  },
];

export const rehearsalAbsences: RehearsalAbsence[] = [
  {
    id: "abs-1",
    rehearsalId: "reh-1",
    showId: "show-1",
    userId: "actor-5",
    userName: "Marcus Bell",
    reason: "Work travel — back Thursday",
    reportedAt: isoAgo(20),
  },
];

export const announcements: Announcement[] = [
  {
    id: "ann-1",
    showId: "show-1",
    authorId: "user-team-1",
    authorName: "Sarah Mitchell",
    bodyMd:
      "Welcome to the **Into the Woods** company! This hub is our one home for schedules, announcements, and files — check it before you text anyone at 10pm.\n\n- Rehearsals are posted under Schedule\n- Report conflicts as soon as you know them\n- Sides and music tracks live in Resources",
    audience: "company",
    rehearsalId: null,
    pinned: true,
    emailed: true,
    createdAt: isoAgo(72),
    isRead: false,
    readerIds: ["user-team-2", "user-team-3", "actor-1", "actor-5"],
  },
  {
    id: "ann-2",
    showId: "show-1",
    authorId: "user-team-2",
    authorName: "Tom Briggs",
    bodyMd:
      "Cast: please bring **character shoes** (or your closest equivalent) starting this week. Blocking on the raked stage is easier when you're in the footwear you'll perform in.",
    audience: "cast",
    rehearsalId: null,
    pinned: false,
    emailed: false,
    createdAt: isoAgo(26),
    isRead: false,
    readerIds: ["actor-1"],
  },
];

export const commNorms: Record<string, CommNormItem[]> = {
  "show-1": [
    { topic: "Running late to rehearsal", contact: "Tom Briggs (SM)", method: "Text (951) 555-0102" },
    { topic: "Schedule conflicts", contact: "Tom Briggs (SM)", method: "Report in the hub, then text if urgent" },
    { topic: "Costumes & fittings", contact: "Angela Davis", method: "Email angela.davis@nctmail.org" },
    { topic: "Music questions", contact: "Marcus Webb (MD)", method: "Email marcus.webb@nctmail.org" },
  ],
};
