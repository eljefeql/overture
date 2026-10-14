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
  ShowFile,
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

/** Mock mirror of `member_conflicts` (migration 025) — conflicts a production
 *  member added on the Show Hub "My conflicts" card (as opposed to the ones
 *  entered at audition signup, which live on mock signups' `conflictDates`).
 *  Mutated in place by hub.ts in mock mode. Dates are relative to today so a
 *  demo rehearsal always shows the union in the team view. */
export type MockMemberConflict = {
  id: string;
  showId: string;
  userId: string;
  startDate: string;
  endDate: string;
  note: string | null;
  createdAt: string;
};

export const memberConflicts: MockMemberConflict[] = [
  {
    // Marcus Bell (Narrator, accepted cast on show-1) — overlaps reh-4
    // (full company) so the team sees "1 conflict" next to that rehearsal.
    id: "mc-1",
    showId: "show-1",
    userId: "actor-5",
    startDate: dayFromNow(7),
    endDate: dayFromNow(9),
    note: "Out of town for a wedding",
    createdAt: isoAgo(30),
  },
];

export const commNorms: Record<string, CommNormItem[]> = {
  "show-1": [
    { topic: "Running late to rehearsal", contact: "Tom Briggs (SM)", method: "Text first", phone: "(951) 555-0102", userId: "user-team-2" },
    { topic: "Schedule conflicts", contact: "Tom Briggs (SM)", method: "Report in the hub, then text if urgent", phone: "(951) 555-0102", userId: "user-team-2" },
    { topic: "Costumes & fittings", contact: "Angela Davis", method: "Email", email: "angela.davis@nctmail.org", userId: "user-team-3" },
    { topic: "Music questions", contact: "Marcus Webb (MD)", method: "Email", email: "marcus.webb@nctmail.org", userId: "user-team-5" },
  ],
};

/** Mock mirror of link rows in `show_files` (migration 026 — `url` set,
 *  `storage_path` null). Uploads stay cloud-only in the demo; links work
 *  end to end. Mutated in place by hub.ts in mock mode. */
export const showLinks: ShowFile[] = [
  {
    id: "link-1",
    showId: "show-1",
    storagePath: null,
    url: "https://drive.google.com/drive/folders/into-the-woods-rehearsal-tracks",
    label: "Rehearsal tracks (Google Drive)",
    category: "music",
    sizeBytes: null,
    uploadedBy: "user-team-5",
    createdAt: isoAgo(50),
  },
  {
    id: "link-2",
    showId: "show-1",
    storagePath: null,
    url: "https://docs.google.com/document/d/into-the-woods-contact-sheet",
    label: "Company contact sheet",
    category: "form",
    sizeBytes: null,
    uploadedBy: "user-team-2",
    createdAt: isoAgo(40),
  },
];

/* ── Volunteers — dual-path mock data (show-1) ── */

/** Internal mock signup row — carries the cancel token + guest email the
 *  cloud keeps in volunteer_signups (never exposed on the public board). */
export type MockVolunteerSignup = {
  id: string;
  needId: string;
  userId: string | null;
  name: string;
  guestEmail: string | null;
  cancelToken: string;
  status: "confirmed" | "cancelled";
};

export type MockVolunteerNeed = {
  id: string;
  showId: string;
  label: string;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  slots: number;
  notes: string | null;
  /** Event → shift → role grouping (migration 027). Null = standalone need. */
  eventId?: string | null;
  shiftId?: string | null;
  roleLabel?: string | null;
};

export type MockVolunteerEvent = {
  id: string;
  showId: string;
  title: string;
  eventDate: string | null;
  location: string | null;
  notes: string | null;
};

export type MockVolunteerShift = {
  id: string;
  eventId: string;
  showId: string;
  startTime: string | null;
  endTime: string | null;
  label: string | null;
  sortOrder: number;
};

/** Nested demo event on show-1: Set build Saturday → two shifts ×
 *  carpentry / painting / misc. Roles live in `volunteerNeeds` below. */
export const volunteerEvents: MockVolunteerEvent[] = [
  {
    id: "vevt-1",
    showId: "show-1",
    title: "Set build Saturday",
    eventDate: dayFromNow(6),
    location: "NCT Scene Shop, 1236 Oak Ave (back entrance)",
    notes: "No experience needed — bring work gloves if you have them. Coffee and donuts on us.",
  },
];

export const volunteerShifts: MockVolunteerShift[] = [
  {
    id: "vsh-1",
    eventId: "vevt-1",
    showId: "show-1",
    startTime: timeOn(6, "09:00"),
    endTime: timeOn(6, "12:00"),
    label: "Morning",
    sortOrder: 0,
  },
  {
    id: "vsh-2",
    eventId: "vevt-1",
    showId: "show-1",
    startTime: timeOn(6, "12:00"),
    endTime: timeOn(6, "15:00"),
    label: "Afternoon",
    sortOrder: 1,
  },
];

export const volunteerNeeds: MockVolunteerNeed[] = [
  {
    id: "vol-1",
    showId: "show-1",
    label: "Ushers — opening night",
    eventDate: dayFromNow(12),
    startTime: timeOn(12, "18:00"),
    endTime: timeOn(12, "21:30"),
    slots: 6,
    notes: "Arrive an hour before curtain. Black top if you have one!",
  },
  {
    id: "vol-2",
    showId: "show-1",
    label: "Concessions",
    eventDate: dayFromNow(12),
    startTime: timeOn(12, "18:30"),
    endTime: timeOn(12, "21:00"),
    slots: 3,
    notes: null,
  },
  /* Roles inside the Set build Saturday event (two shifts × three roles).
     A role IS a need: label is composed "<role> — <event>" and the shift's
     times are copied on, exactly as the cloud write path does. */
  ...(
    [
      ["vsh-1", "09:00", "12:00"],
      ["vsh-2", "12:00", "15:00"],
    ] as const
  ).flatMap(([shiftId, start, end], si) =>
    (
      [
        ["Carpentry", 3],
        ["Painting", 2],
        ["Misc / runner", 2],
      ] as const
    ).map(([role, slots], ri) => ({
      id: `vol-3-${si + 1}-${ri + 1}`,
      showId: "show-1",
      label: `${role} — Set build Saturday`,
      eventDate: dayFromNow(6),
      startTime: timeOn(6, start),
      endTime: timeOn(6, end),
      slots,
      notes: null,
      eventId: "vevt-1",
      shiftId,
      roleLabel: role,
    }))
  ),
];

export const volunteerSignups: MockVolunteerSignup[] = [
  {
    id: "vs-1",
    needId: "vol-1",
    userId: "actor-5",
    name: "Marcus Bell",
    guestEmail: null,
    cancelToken: "mock-token-vs-1",
    status: "confirmed",
  },
  {
    id: "vs-2",
    needId: "vol-1",
    userId: null,
    name: "Robert Kim",
    guestEmail: "robert.kim@example.com",
    cancelToken: "mock-token-vs-2",
    status: "confirmed",
  },
  {
    id: "vs-3",
    needId: "vol-3-1-1",
    userId: null,
    name: "Dana Whitfield",
    guestEmail: "dana.w@example.com",
    cancelToken: "mock-token-vs-3",
    status: "confirmed",
  },
];
