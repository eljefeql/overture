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
  /** Geocoded coordinates (migration 018) — best-effort at save time;
   *  optional so mock orgs and pre-paste rows stay valid. */
  latitude?: number | null;
  longitude?: number | null;
  websiteUrl: string | null;
  codeOfConduct: string | null;
  // Theatre profile depth (Sprint D, Phase 2)
  foundedYear: number | null;
  mission: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  ticketingUrl: string | null;
  /** Organizations the theatre belongs to (EMACT, AACT, NETC, free text) —
   *  migration 022. Optional so mock orgs and pre-paste rows stay valid. */
  affiliations?: string[];
  /** Platform-admin soft hide (migration 021) — archived orgs are excluded
   *  from public surfaces. Optional so mock orgs and pre-paste rows stay valid. */
  isArchived?: boolean;
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
  /** Geocoded from the free-text address (migration 018) — best-effort. */
  latitude?: number | null;
  longitude?: number | null;
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
  /** Day-of contact for "questions or last-minute issues" on the public
   *  audition page (QA finding 11). Optional: columns land with migration
   *  017, and reads/writes degrade gracefully before the paste. When empty,
   *  the public page falls back to the stage manager from the show team. */
  dayOfContactName?: string | null;
  dayOfContactInfo?: string | null;
  /** Show-level offer agreements (migration 022) — the commitments an actor
   *  checks off when accepting a cast offer. Each string's first line is the
   *  agreement title, the rest its body. Null/absent = use the Overture
   *  defaults (the previously fixed copy), so existing shows are unchanged. */
  offerAgreements?: string[] | null;
  posterUrl: string | null;
  city: string;
  state: string;
  distanceMiles: number | null;
  isPromoted: boolean;
  /** Already-cast show (migration 024) — the create-screen answer "We've
   *  already cast it — we just want the Show Hub". Reorders the setup
   *  checklist (Add your cast → Build your team → Hub live) and makes the
   *  subnav module-aware. Optional so mock rows and pre-paste cloud reads
   *  stay valid; never changes the status machine. */
  precast?: boolean;
  /** Role names an OPEN supplemental casting call is seeking (migration 023).
   *  Populated only by getOpenAuditions for shows surfaced via a call —
   *  drives the "Seeking: {roles}" badge on Browse/Discover. Optional so
   *  every other Show read stays valid. */
  seekingRoles?: string[];
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
  /** Headshot (profiles.avatar_url) — hub team cards. Optional: mock rows
   *  and older readers don't carry it. */
  avatarUrl?: string | null;
};

export type AuditionGroup = {
  id: ID;
  showId: ID;
  name: string;
  startTime: string;
  endTime: string;
  slotCount: number;
  sortOrder: number;
  /** Supplemental casting call (migration 023) — all optional so legacy
   *  mock rows and pre-paste cloud reads stay valid. A block with
   *  `supplemental` true belongs to a role-scoped casting call. */
  supplemental?: boolean;
  /** The role ids the call is seeking; roles are removed as they fill. */
  targetRoleIds?: ID[];
  /** Optional public note ("seeking a strong tenor"). */
  supplementalNote?: string | null;
  /** Null/absent = the call is OPEN; set when closed (manually, or
   *  automatically when every targeted role gains an accepted primary). */
  supplementalClosedAt?: string | null;
};

/** Is this block part of a currently-open supplemental casting call? */
export function isOpenSupplementalGroup(g: AuditionGroup): boolean {
  return !!g.supplemental && !g.supplementalClosedAt;
}

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
  /** Acknowledged at signup: happy to accept an ensemble/smaller role in THIS
   *  show (per-show, never a profile-level flag — owner decision, QA round 2).
   *  Optional so legacy mock rows default to false. */
  openToEnsemble?: boolean;
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
  /** Row id (signup_conflicts or member_conflicts) — present on read-model
   *  rows so the owner can remove one range; absent on form drafts. */
  id?: ID;
  /** Where the range came from: entered at audition signup, or added on the
   *  Show Hub "My conflicts" card (member_conflicts, migration 025). */
  source?: "signup" | "member";
  /** Optional note — hub-added ranges only. */
  note?: string | null;
};

/** One person's structured conflicts for a show — Conflict Calendar read model.
 *  Since migration 025 this is the UNION of audition-signup ranges and ranges
 *  the member added on the hub; a person who never auditioned (precast cast,
 *  production team) gets a synthetic `signupId` of `member:<userId>`. */
export type ShowConflictEntry = {
  signupId: ID;
  actorId: ID;
  actorName: string;
  actorEmail: string | null;
  status: SignupStatus;
  ranges: ConflictRange[];
  /** Set when the person has NO audition signup for this show — `cast` =
   *  accepted cast member, `team` = production team member. */
  memberKind?: "cast" | "team";
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
  /** NULL for a cast member added by email who has no account yet (precast
   *  bulk add, migration 024) — mirrors show_team_members' guest pattern.
   *  Signing up with the invited email auto-links (claim_cast_assignments). */
  actorId: ID | null;
  actorName: string;
  /** Headshot (profiles.avatar_url) — hub cast grid. Optional. */
  actorAvatarUrl?: string | null;
  assignmentType: AssignmentType;
  status: OfferStatus;
  sortOrder: number;
  /** Entered directly by the director (precast bulk add) — status 'accepted'
   *  without an offer dance. Honesty flag for history. Migration 024. */
  addedDirectly?: boolean;
  /** Guest fields (actorId null until claimed) — migration 024. */
  guestName?: string | null;
  guestEmail?: string | null;
  /** Set when "Review & send invitations" fires; null = not invited yet. */
  invitedAt?: string | null;
  /** Cloud rows carry timestamps (offer tracker); mock rows may not. */
  createdAt?: string | null;
  updatedAt?: string | null;
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
  /** Storage object path for uploaded files; null for link rows (migration 026). */
  storagePath: string | null;
  /** External http(s) link (Drive, YouTube, docs) — null for uploaded files.
   *  Exactly one of storagePath / url is set (DB CHECK, migration 026). */
  url: string | null;
  label: string;
  category: string | null;
  sizeBytes: number | null;
  uploadedBy: ID | null;
  createdAt: string;
};

/** One row of the "who to contact for what" routing card. The team decides
 *  what to share: `phone`/`email` are typed in by hand (QC #30), never pulled
 *  from private profiles. `userId` links the row to a production team member
 *  with an account so the hub can offer "Send a note" (QC #32). All optional —
 *  rows saved before this shape stay valid. */
export type CommNormItem = {
  topic: string;
  contact: string;
  method: string;
  phone?: string;
  email?: string;
  userId?: ID | null;
};

/* ── Volunteers — dual-path (Show Hub part 2, SHOW_HUB_SPEC.md) ── */

/** A confirmed signup on a volunteer need. Guests have no userId. */
export type VolunteerSignupEntry = {
  id: ID;
  userId: ID | null;
  name: string;
  isGuest: boolean;
};

export type VolunteerNeed = {
  id: ID;
  showId: ID;
  label: string;
  /** YYYY-MM-DD (a shift can be date-only, no times). */
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  slots: number;
  notes: string | null;
  /** Confirmed signups (hub view — production members only). */
  signups: VolunteerSignupEntry[];
};

/** Anonymous-safe board for the public /volunteer/[showId] page — slot
 *  counts only, never who signed up. */
export type VolunteerBoard = {
  show: {
    id: ID;
    title: string;
    orgName: string;
    posterUrl: string | null;
    city: string;
    state: string;
    showOpen: string | null;
    showClose: string | null;
    performanceLocation: string | null;
  };
  needs: {
    id: ID;
    label: string;
    eventDate: string | null;
    startTime: string | null;
    endTime: string | null;
    slots: number;
    notes: string | null;
    filled: number;
  }[];
};

/** What the tokened cancel page shows — holding the token proves ownership. */
export type VolunteerShiftInfo = {
  status: "confirmed" | "cancelled";
  name: string | null;
  label: string;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  showTitle: string;
  orgName: string;
};
