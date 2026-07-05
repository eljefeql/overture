import type {
  ID,
  Timestamps,
  ShowStatus,
  RoleType,
  GenderReq,
  TeamRole,
  SignupStatus,
  CallbackStatus,
  AssignmentType,
  OfferStatus,
} from "./common";

export type Org = {
  id: ID;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  websiteUrl: string | null;
  codeOfConduct: string | null;
  // Theatre profile depth (Sprint D, Phase 2)
  foundedYear: number | null;
  mission: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  ticketingUrl: string | null;
} & Timestamps;

/** What a space is used for — labels & groups spaces on the public page. */
export type SpaceType = "performance" | "rehearsal" | "other";

/** A space belonging to a theatre (performance, rehearsal, or other). */
export type Venue = {
  id: ID;
  orgId: ID;
  name: string;
  address: string | null;
  capacity: number | null;
  accessibilityNotes: string | null;
  parkingNotes: string | null;
  isPrimary: boolean;
  spaceType: SpaceType;
  sortOrder: number;
  createdAt: string;
};

/**
 * A manually-entered past production — a theatre's history that predates
 * Overture. Merged with auto-derived past shows on the public theatre page.
 */
export type OrgPastProduction = {
  id: ID;
  orgId: ID;
  title: string;
  year: number | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
};

/** A public "key person" — leadership display entry (may have no app account). */
export type OrgLeader = {
  id: ID;
  orgId: ID;
  name: string;
  title: string | null;
  photoUrl: string | null;
  sortOrder: number;
  createdAt: string;
};

/** A venue or production photo in a theatre's gallery. */
export type OrgPhoto = {
  id: ID;
  orgId: ID;
  storagePath: string;
  caption: string | null;
  kind: "venue" | "production";
  sortOrder: number;
  createdAt: string;
  publicUrl: string;
};

/**
 * Theatre-level membership — distinct from ShowTeamMember (show-scoped).
 * owner/admin: manage theatre, create shows, see all shows.
 * member: view-only at org level; show access comes from ShowTeamMember.
 */
export type OrgMember = {
  id: ID;
  orgId: ID;
  userId: ID | null; // null until the invite is accepted
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited";
  invitedAt: string;
  joinedAt: string | null;
};

export type ShowType = "musical" | "play" | "revue";

export type Show = {
  id: ID;
  orgId: ID;
  orgName: string;
  title: string;
  authorInfo: string | null;
  showType: ShowType;
  season: string | null;
  status: ShowStatus;
  auditionStart: string | null;
  auditionEnd: string | null;
  callbackDate: string | null;
  callbackStartTime: string | null;
  callbackEndTime: string | null;
  rehearsalStart: string | null;
  showOpen: string | null;
  showClose: string | null;
  auditionLocation: string | null;
  auditionNotes: string | null;
  callbackLocation: string | null;
  callbackNotes: string | null;
  performanceLocation: string | null;
  callbackContactName: string | null;
  callbackContactPhone: string | null;
  posterUrl: string | null;
  city: string;
  state: string;
  distanceMiles: number | null;
  isPromoted: boolean;
} & Timestamps;

export type ShowRole = {
  id: ID;
  showId: ID;
  name: string;
  roleType: RoleType;
  gender: GenderReq | null;
  ageRange: string | null;
  vocalRange: string | null;
  description: string | null;
  sortOrder: number;
};

export type ShowTeamMember = {
  id: ID;
  showId: ID;
  userId: ID;
  userName: string;
  role: TeamRole;
  canEvaluate: boolean;
  email: string | null;
  phone: string | null;
};

export type AuditionGroup = {
  id: ID;
  showId: ID;
  name: string;
  startTime: string;
  endTime: string;
  slotCount: number;
  sortOrder: number;
};

export type AuditionSignup = {
  id: ID;
  showId: ID;
  actorId: ID;
  actorName: string;
  actorAvatarUrl: string | null;
  actorPronouns: string | null;
  groupId: ID | null;
  slotPosition: number | null;
  rolesInterested: ID[];
  openToOther: boolean;
  willCrew: boolean;
  conflicts: string | null;
  /** Structured conflict ranges (mock-mode storage; cloud rows live in signup_conflicts). */
  conflictDates?: ConflictRange[];
  status: SignupStatus;
  signedUpAt: string;
};

/** A single unavailable date range (YYYY-MM-DD, inclusive). */
export type ConflictRange = {
  startDate: string;
  endDate: string;
};

/** One person's structured conflicts for a show — Conflict Calendar read model. */
export type ShowConflictEntry = {
  signupId: ID;
  actorId: ID;
  actorName: string;
  actorEmail: string | null;
  status: SignupStatus;
  ranges: ConflictRange[];
};

export type TeamNote = {
  id: ID;
  showId: ID;
  actorId: ID;
  authorId: ID;
  authorName: string;
  authorRole: TeamRole;
  body: string;
  createdAt: string;
  updatedAt: string | null;
};

export type Callback = {
  id: ID;
  showId: ID;
  actorId: ID;
  actorName: string;
  roleId: ID;
  roleName: string;
  status: CallbackStatus;
  notifiedAt: string | null;
  respondedAt: string | null;
  prepNotes: string | null;
};

export type CastAssignment = {
  id: ID;
  showId: ID;
  roleId: ID;
  roleName: string;
  actorId: ID;
  actorName: string;
  assignmentType: AssignmentType;
  status: OfferStatus;
  sortOrder: number;
};

/* ============================================================
   Show Hub (Week 3) — rehearsals, announcements, files, norms
   ============================================================ */

/** Who's called to a rehearsal. */
export type CalledScope = "everyone" | "group" | "custom";
/** The named groups a rehearsal call can target when scope = "group". */
export type CalledGroup = "principals" | "ensemble" | "crew";

export type Rehearsal = {
  id: ID;
  showId: ID;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  /** What's being worked, e.g. "Act 1, sc. 3–5". */
  focus: string | null;
  notes: string | null;
  calledScope: CalledScope;
  calledGroup: CalledGroup | null;
  /** User ids picked when calledScope = "custom". */
  calledPeople: ID[];
};

export type RehearsalAbsence = {
  id: ID;
  rehearsalId: ID;
  showId: ID;
  userId: ID;
  userName: string;
  reason: string | null;
  reportedAt: string;
};

/** Announcement targeting — see SHOW_HUB_SPEC.md. */
export type AnnouncementAudience =
  | "company"
  | "cast"
  | "principals"
  | "crew"
  | "rehearsal";

export type Announcement = {
  id: ID;
  showId: ID;
  authorId: ID;
  authorName: string;
  bodyMd: string;
  audience: AnnouncementAudience;
  /** Set when audience = "rehearsal" ("everyone called to [rehearsal]"). */
  rehearsalId: ID | null;
  pinned: boolean;
  /** "Also email" flag — recorded on post; delivery rides the notification→email pipeline. */
  emailed: boolean;
  createdAt: string;
  /** Whether the current viewer has read it (drives mark-read on view). */
  isRead: boolean;
  /** User ids who have read it (team-only receipt view). */
  readerIds: ID[];
};

export type ShowFile = {
  id: ID;
  showId: ID;
  storagePath: string;
  label: string;
  category: string | null;
  sizeBytes: number | null;
  uploadedBy: ID | null;
  createdAt: string;
};

/** One row of the "who to contact for what" routing card. */
export type CommNormItem = {
  topic: string;
  contact: string;
  method: string;
};
