/**
 * API Client — thin wrapper for mock data during MVP development.
 * When we connect to Supabase, this becomes the real fetch layer.
 * All components use these functions, so the swap is seamless.
 */

import { shows, allShowRoles, showTeam, auditionGroups, orgs, castAssignments } from "@/data/shows";
import { actors, auditionSignups, teamNotes, callbacks } from "@/data/actors";
import type {
  Show,
  ShowRole,
  ShowTeamMember,
  AuditionGroup,
  AuditionSignup,
  ActorWithProfile,
  ActorProfile,
  Training,
  Award,
  TeamNote,
  Callback,
  CastAssignment,
  Org,
  SignupStatus,
} from "@/types";

// Simulate network delay
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// SHOWS
// ============================================================

export async function getShows(filters?: {
  status?: string;
  orgId?: string;
}): Promise<Show[]> {
  await delay();
  let result = [...shows];
  if (filters?.status) {
    result = result.filter((s) => s.status === filters.status);
  }
  if (filters?.orgId) {
    result = result.filter((s) => s.orgId === filters.orgId);
  }
  return result;
}

export async function getShow(showId: string): Promise<Show | null> {
  await delay();
  const show = shows.find((s) => s.id === showId);
  return show ? { ...show } : null;
}

export async function getShowRoles(showId: string): Promise<ShowRole[]> {
  await delay();
  return allShowRoles[showId] ?? [];
}

export async function getShowTeam(showId: string): Promise<ShowTeamMember[]> {
  await delay();
  return showTeam.filter((t) => t.showId === showId);
}

export async function getOrg(orgId: string): Promise<Org | null> {
  await delay();
  return orgs.find((o) => o.id === orgId) ?? null;
}

// ============================================================
// AUDITIONS
// ============================================================

export async function getAuditionGroups(
  showId: string
): Promise<AuditionGroup[]> {
  await delay();
  return auditionGroups
    .filter((g) => g.showId === showId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getAuditionSignups(
  showId: string
): Promise<AuditionSignup[]> {
  await delay();
  return auditionSignups.filter((s) => s.showId === showId);
}

export type DiscoverFilters = {
  radius: number | null; // null = anywhere
  showType: "all" | "musical" | "play" | "revue";
  sortBy: "suggested" | "newest" | "date" | "distance";
};

export async function getOpenAuditions(filters?: DiscoverFilters): Promise<Show[]> {
  await delay();
  let results = shows.filter((s) => s.status === "auditions_open");

  // NOTE: Don't filter by radius here — we return all results
  // so the UI can split into "For You" (within radius) and "Nearby" (beyond radius)

  // Filter by type
  if (filters?.showType && filters.showType !== "all") {
    results = results.filter((s) => s.showType === filters.showType);
  }

  // Sort
  const sortBy = filters?.sortBy ?? "suggested";
  if (sortBy === "suggested") {
    // Promoted first, then by distance
    results.sort((a, b) => {
      if (a.isPromoted && !b.isPromoted) return -1;
      if (!a.isPromoted && b.isPromoted) return 1;
      return (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999);
    });
  } else if (sortBy === "newest") {
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortBy === "date") {
    results.sort((a, b) => {
      if (!a.auditionStart) return 1;
      if (!b.auditionStart) return -1;
      return new Date(a.auditionStart).getTime() - new Date(b.auditionStart).getTime();
    });
  } else if (sortBy === "distance") {
    results.sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
  }

  return results;
}

// ============================================================
// ACTORS
// ============================================================

export async function getActor(
  actorId: string
): Promise<ActorWithProfile | null> {
  await delay();
  return actors.find((a) => a.id === actorId) ?? null;
}

export async function getActors(): Promise<ActorWithProfile[]> {
  await delay();
  return actors;
}

// ============================================================
// TEAM NOTES
// ============================================================

export async function getTeamNotes(
  showId: string,
  actorId?: string
): Promise<TeamNote[]> {
  await delay();
  let result = teamNotes.filter((n) => n.showId === showId);
  if (actorId) {
    result = result.filter((n) => n.actorId === actorId);
  }
  return result.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export async function postTeamNote(note: {
  showId: string;
  actorId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
}): Promise<TeamNote> {
  await delay(300);
  const newNote: TeamNote = {
    id: `note-${Date.now()}`,
    showId: note.showId,
    actorId: note.actorId,
    authorId: note.authorId,
    authorName: note.authorName,
    authorRole: note.authorRole as TeamNote["authorRole"],
    body: note.body,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  teamNotes.push(newNote);
  return newNote;
}

export async function updateTeamNote(noteId: string, body: string): Promise<TeamNote> {
  await delay(200);
  const note = teamNotes.find((n) => n.id === noteId);
  if (!note) throw new Error("Note not found.");
  note.body = body;
  note.updatedAt = new Date().toISOString();
  return note;
}

export async function deleteTeamNote(noteId: string): Promise<void> {
  await delay(200);
  const idx = teamNotes.findIndex((n) => n.id === noteId);
  if (idx === -1) throw new Error("Note not found.");
  teamNotes.splice(idx, 1);
}

// ============================================================
// CALLBACKS
// ============================================================

export async function getCallbacks(showId: string): Promise<Callback[]> {
  await delay();
  return callbacks.filter((c) => c.showId === showId);
}

export async function getActorCallbacks(actorId: string): Promise<Callback[]> {
  await delay();
  return callbacks.filter((c) => c.actorId === actorId);
}

export async function acceptCallback(callbackId: string): Promise<Callback> {
  await delay(300);
  const cb = callbacks.find((c) => c.id === callbackId);
  if (!cb) throw new Error("Callback not found.");
  if (cb.status !== "pending") throw new Error("Callback already responded to.");
  cb.status = "accepted";
  cb.respondedAt = new Date().toISOString();
  return cb;
}

export async function declineCallback(callbackId: string): Promise<Callback> {
  await delay(300);
  const cb = callbacks.find((c) => c.id === callbackId);
  if (!cb) throw new Error("Callback not found.");
  if (cb.status !== "pending") throw new Error("Callback already responded to.");
  cb.status = "declined";
  cb.respondedAt = new Date().toISOString();
  return cb;
}

// ============================================================
// AUDITION SIGNUP (Actor-side)
// ============================================================

export async function getActorSignups(
  actorId: string
): Promise<AuditionSignup[]> {
  await delay();
  return auditionSignups.filter((s) => s.actorId === actorId);
}

export async function getActorSignup(
  showId: string,
  actorId: string
): Promise<AuditionSignup | null> {
  await delay();
  return (
    auditionSignups.find(
      (s) => s.showId === showId && s.actorId === actorId
    ) ?? null
  );
}

export async function getSlotAvailability(
  showId: string
): Promise<{ groupId: string; taken: number }[]> {
  await delay();
  const groups = auditionGroups.filter((g) => g.showId === showId);
  return groups.map((g) => ({
    groupId: g.id,
    taken: auditionSignups.filter((s) => s.showId === showId && s.groupId === g.id).length,
  }));
}

export async function signUpForAudition(signup: {
  showId: string;
  actorId: string;
  actorName: string;
  groupId: string;
  rolesInterested: string[];
  openToOther: boolean;
  willCrew: boolean;
  conflicts: string;
}): Promise<AuditionSignup> {
  await delay(400);

  // Check Chris Rule — is this user on the production team?
  const isTeam = showTeam.some(
    (t) => t.showId === signup.showId && t.userId === signup.actorId
  );
  if (isTeam) {
    throw new Error(
      "You cannot audition for a show you are on the production team for."
    );
  }

  // Check if already signed up
  const existing = auditionSignups.find(
    (s) => s.showId === signup.showId && s.actorId === signup.actorId
  );
  if (existing) {
    throw new Error("You are already signed up for this audition.");
  }

  // Count taken slots in this group
  const group = auditionGroups.find((g) => g.id === signup.groupId);
  const takenInGroup = auditionSignups.filter(
    (s) => s.showId === signup.showId && s.groupId === signup.groupId
  ).length;
  if (group && takenInGroup >= group.slotCount) {
    throw new Error("This time slot is full. Please select a different one.");
  }

  const newSignup: AuditionSignup = {
    id: `signup-${Date.now()}`,
    showId: signup.showId,
    actorId: signup.actorId,
    actorName: signup.actorName,
    actorAvatarUrl: null,
    actorPronouns: null,
    groupId: signup.groupId,
    slotPosition: takenInGroup + 1,
    rolesInterested: signup.rolesInterested,
    openToOther: signup.openToOther,
    willCrew: signup.willCrew,
    conflicts: signup.conflicts,
    status: "signed_up",
    signedUpAt: new Date().toISOString(),
  };

  auditionSignups.push(newSignup);
  return newSignup;
}

export async function withdrawSignup(
  showId: string,
  actorId: string
): Promise<void> {
  await delay(300);
  const idx = auditionSignups.findIndex(
    (s) => s.showId === showId && s.actorId === actorId
  );
  if (idx !== -1) {
    auditionSignups.splice(idx, 1);
  }
}

// ============================================================
// PROFILE MUTATIONS
// ============================================================

export async function updateActorProfile(
  actorId: string,
  updates: Partial<ActorProfile>
): Promise<ActorWithProfile> {
  await delay(400);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");
  if (!actor.profile) throw new Error("No profile to update.");

  Object.assign(actor.profile, updates, {
    updatedAt: new Date().toISOString(),
  });
  return actor;
}

export async function updateActorUser(
  actorId: string,
  updates: Partial<Pick<ActorWithProfile, "displayName" | "pronouns">>
): Promise<ActorWithProfile> {
  await delay(300);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");

  Object.assign(actor, updates);
  return actor;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export type Notification = {
  id: string;
  actorId: string;
  type: "callback" | "endorsement" | "kudos" | "cast" | "system";
  title: string;
  body: string;
  showTitle: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

// Track read notifications in memory (mock persistence)
const readNotifIds = new Set<string>();

// Generate notifications from existing data
function buildNotifications(actorId: string): Notification[] {
  const notes: Notification[] = [];

  // Callback notifications
  const actorCallbacks = callbacks.filter((c) => c.actorId === actorId);
  for (const cb of actorCallbacks) {
    const show = shows.find((s) => s.id === cb.showId);
    notes.push({
      id: `notif-cb-${cb.id}`,
      actorId,
      type: "callback",
      title: cb.status === "pending" ? "Callback Invitation" : `Callback ${cb.status === "accepted" ? "Accepted" : "Declined"}`,
      body: cb.status === "pending"
        ? `You've been called back for ${cb.roleName}!`
        : `You ${cb.status} the callback for ${cb.roleName}.`,
      showTitle: show?.title ?? null,
      linkUrl: `/auditions/${cb.showId}`,
      isRead: cb.status !== "pending" || readNotifIds.has(`notif-cb-${cb.id}`),
      createdAt: cb.notifiedAt ?? new Date().toISOString(),
    });
  }

  // Endorsement notifications
  const actor = actors.find((a) => a.id === actorId);
  if (actor) {
    for (const e of actor.endorsements) {
      notes.push({
        id: `notif-end-${e.id}`,
        actorId,
        type: "endorsement",
        title: "New Endorsement",
        body: `${e.endorserName} endorsed you as "${e.label}"`,
        showTitle: e.showTitle,
        linkUrl: "/profile",
        isRead: true,
        createdAt: e.createdAt,
      });
    }

    // Kudos notifications
    for (const credit of actor.credits) {
      if (credit.kudos) {
        notes.push({
          id: `notif-kudos-${credit.id}`,
          actorId,
          type: "kudos",
          title: "New Kudos",
          body: `${credit.kudos.authorName} left kudos on your ${credit.showTitle} credit`,
          showTitle: credit.showTitle,
          linkUrl: "/profile",
          isRead: true,
          createdAt: "2026-03-15T00:00:00Z",
        });
      }
    }
  }

  // Cast offer notifications
  const actorAssignments = castAssignments.filter(
    (a) => a.actorId === actorId && (a.status === "sent" || a.status === "accepted" || a.status === "declined")
  );
  for (const assignment of actorAssignments) {
    const show = shows.find((s) => s.id === assignment.showId);
    notes.push({
      id: `notif-cast-${assignment.id}`,
      actorId,
      type: "cast",
      title: assignment.status === "sent"
        ? "You've Been Cast!"
        : assignment.status === "accepted"
          ? "Role Accepted"
          : "Offer Declined",
      body: assignment.status === "sent"
        ? `You've been offered the role of ${assignment.roleName}!`
        : assignment.status === "accepted"
          ? `You accepted the role of ${assignment.roleName}.`
          : `You declined the role of ${assignment.roleName}.`,
      showTitle: show?.title ?? null,
      linkUrl: assignment.status === "sent"
        ? `/offers/${assignment.id}`
        : `/auditions/${assignment.showId}`,
      isRead: assignment.status !== "sent" || readNotifIds.has(`notif-cast-${assignment.id}`),
      createdAt: show?.updatedAt ?? new Date().toISOString(),
    });
  }

  // Sort by date, newest first
  return notes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getNotifications(actorId: string): Promise<Notification[]> {
  await delay();
  return buildNotifications(actorId);
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await delay(100);
  readNotifIds.add(notifId);
}

// ============================================================
// SHOW CRUD (Production-side)
// ============================================================

export async function createShow(data: Omit<Show, "id" | "createdAt" | "updatedAt">): Promise<Show> {
  await delay(400);
  const newShow: Show = {
    ...data,
    id: `show-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  shows.push(newShow);
  allShowRoles[newShow.id] = [];
  return newShow;
}

export async function updateShow(showId: string, updates: Partial<Show>): Promise<Show> {
  await delay(300);
  const idx = shows.findIndex((s) => s.id === showId);
  if (idx === -1) throw new Error("Show not found.");
  const updated = { ...shows[idx], ...updates, updatedAt: new Date().toISOString() };
  shows[idx] = updated;
  return updated;
}

// ============================================================
// SHOW ROLE CRUD (Production-side)
// ============================================================

export async function createShowRole(data: Omit<ShowRole, "id">): Promise<ShowRole> {
  await delay(300);
  const newRole: ShowRole = {
    ...data,
    id: `role-${Date.now()}`,
  };
  if (!allShowRoles[data.showId]) {
    allShowRoles[data.showId] = [];
  }
  allShowRoles[data.showId].push(newRole);
  return newRole;
}

export async function updateShowRole(roleId: string, updates: Partial<ShowRole>): Promise<ShowRole> {
  await delay(200);
  for (const roles of Object.values(allShowRoles)) {
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      Object.assign(role, updates);
      return role;
    }
  }
  throw new Error("Role not found.");
}

export async function deleteShowRole(roleId: string): Promise<void> {
  await delay(200);
  for (const [showId, roles] of Object.entries(allShowRoles)) {
    const idx = roles.findIndex((r) => r.id === roleId);
    if (idx !== -1) {
      allShowRoles[showId].splice(idx, 1);
      return;
    }
  }
  throw new Error("Role not found.");
}

// ============================================================
// TEAM MANAGEMENT (Production-side)
// ============================================================

export async function addTeamMember(data: Omit<ShowTeamMember, "id">): Promise<ShowTeamMember> {
  await delay(300);
  const newMember: ShowTeamMember = {
    ...data,
    id: `tm-${Date.now()}`,
  };
  showTeam.push(newMember);
  return newMember;
}

export async function removeTeamMember(memberId: string): Promise<void> {
  await delay(200);
  const idx = showTeam.findIndex((t) => t.id === memberId);
  if (idx !== -1) {
    showTeam.splice(idx, 1);
  }
}

// ============================================================
// AUDITION GROUP MANAGEMENT (Production-side)
// ============================================================

export async function createAuditionGroup(data: Omit<AuditionGroup, "id">): Promise<AuditionGroup> {
  await delay(300);
  const newGroup: AuditionGroup = {
    ...data,
    id: `grp-${Date.now()}`,
  };
  auditionGroups.push(newGroup);
  return newGroup;
}

export async function updateAuditionGroup(groupId: string, updates: Partial<AuditionGroup>): Promise<AuditionGroup> {
  await delay(200);
  const group = auditionGroups.find((g) => g.id === groupId);
  if (!group) throw new Error("Audition group not found.");
  Object.assign(group, updates);
  return group;
}

export async function deleteAuditionGroup(groupId: string): Promise<void> {
  await delay(200);
  const idx = auditionGroups.findIndex((g) => g.id === groupId);
  if (idx === -1) throw new Error("Audition group not found.");
  auditionGroups.splice(idx, 1);
}

// ============================================================
// SIGNUP STATUS (Production-side)
// ============================================================

export async function updateSignupStatus(signupId: string, status: SignupStatus): Promise<AuditionSignup> {
  await delay(200);
  const signup = auditionSignups.find((s) => s.id === signupId);
  if (!signup) throw new Error("Signup not found.");
  signup.status = status;
  return signup;
}

// ============================================================
// CALLBACKS — Team-initiated (Production-side)
// ============================================================

export async function createCallback(data: {
  showId: string;
  actorId: string;
  actorName: string;
  roleId: string;
  roleName: string;
  prepNotes?: string;
}): Promise<Callback> {
  await delay(300);
  // Check if callback already exists for this actor + role
  const existing = callbacks.find(
    (c) => c.showId === data.showId && c.actorId === data.actorId && c.roleId === data.roleId
  );
  if (existing) throw new Error("Callback already exists for this actor and role.");

  const newCallback: Callback = {
    id: `cb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    showId: data.showId,
    actorId: data.actorId,
    actorName: data.actorName,
    roleId: data.roleId,
    roleName: data.roleName,
    status: "pending",
    notifiedAt: null,
    respondedAt: null,
    prepNotes: data.prepNotes ?? null,
  };
  callbacks.push(newCallback);

  // Also update the actor's signup status to "callback" if they're in an earlier status
  const signup = auditionSignups.find(
    (s) => s.showId === data.showId && s.actorId === data.actorId
  );
  if (signup && ["signed_up", "checked_in", "auditioned", "shortlisted"].includes(signup.status)) {
    signup.status = "callback";
  }

  return newCallback;
}

export async function deleteCallback(callbackId: string): Promise<void> {
  await delay(200);
  const idx = callbacks.findIndex((c) => c.id === callbackId);
  if (idx === -1) throw new Error("Callback not found.");
  callbacks.splice(idx, 1);
}

export async function notifyCallbacks(showId: string): Promise<number> {
  await delay(400);
  const pending = callbacks.filter(
    (c) => c.showId === showId && c.status === "pending"
  );
  for (const cb of pending) {
    cb.status = "notified";
    cb.notifiedAt = new Date().toISOString();
  }
  return pending.length;
}

// ============================================================
// CAST ASSIGNMENTS (Production-side)
// ============================================================

export async function getCastAssignments(showId: string): Promise<CastAssignment[]> {
  await delay();
  return castAssignments
    .filter((a) => a.showId === showId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createCastAssignment(data: Omit<CastAssignment, "id">): Promise<CastAssignment> {
  await delay(300);
  // Check for duplicate assignment (same role + same type)
  const existing = castAssignments.find(
    (a) =>
      a.showId === data.showId &&
      a.roleId === data.roleId &&
      a.assignmentType === data.assignmentType &&
      a.status !== "withdrawn"
  );
  if (existing) throw new Error(`A ${data.assignmentType} is already assigned to this role.`);

  const newAssignment: CastAssignment = {
    ...data,
    id: `cast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  castAssignments.push(newAssignment);
  return newAssignment;
}

export async function updateCastAssignment(
  assignmentId: string,
  updates: Partial<CastAssignment>
): Promise<CastAssignment> {
  await delay(200);
  const assignment = castAssignments.find((a) => a.id === assignmentId);
  if (!assignment) throw new Error("Cast assignment not found.");
  Object.assign(assignment, updates);
  return assignment;
}

// ============================================================
// CAST OFFERS (Actor-side)
// ============================================================

export async function getCastAssignment(assignmentId: string): Promise<CastAssignment | null> {
  await delay();
  return castAssignments.find((a) => a.id === assignmentId) ?? null;
}

export async function getActorCastAssignments(actorId: string): Promise<CastAssignment[]> {
  await delay();
  return castAssignments.filter((a) => a.actorId === actorId && a.status !== "withdrawn");
}

export async function acceptCastOffer(assignmentId: string): Promise<CastAssignment> {
  await delay(300);
  const assignment = castAssignments.find((a) => a.id === assignmentId);
  if (!assignment) throw new Error("Cast assignment not found.");
  if (assignment.status !== "sent") throw new Error("This offer is no longer available.");
  assignment.status = "accepted";
  // Also update the actor's signup status to "cast"
  const signup = auditionSignups.find(
    (s) => s.showId === assignment.showId && s.actorId === assignment.actorId
  );
  if (signup) signup.status = "cast";
  return assignment;
}

export async function declineCastOffer(assignmentId: string): Promise<CastAssignment> {
  await delay(300);
  const assignment = castAssignments.find((a) => a.id === assignmentId);
  if (!assignment) throw new Error("Cast assignment not found.");
  if (assignment.status !== "sent") throw new Error("This offer is no longer available.");
  assignment.status = "declined";
  return assignment;
}

/**
 * Send draft offers to actors. Sets all "draft" assignments to "sent".
 * Does NOT change show.status — show stays in "casting" while waiting.
 */
export async function sendOffers(showId: string): Promise<number> {
  await delay(400);
  let count = 0;
  for (const a of castAssignments) {
    if (a.showId === showId && a.status === "draft") {
      a.status = "sent";
      count++;
    }
  }
  return count;
}

/**
 * Publish the cast list. Requires every active role assignment to have
 * status === "accepted". Throws if any are still pending or declined.
 * Sets show.status = "cast".
 */
export async function publishCastList(showId: string): Promise<void> {
  await delay(400);
  const active = castAssignments.filter(
    (a) => a.showId === showId && a.status !== "withdrawn"
  );
  if (active.length === 0) {
    throw new Error("No cast assignments to publish.");
  }
  const notAccepted = active.filter((a) => a.status !== "accepted");
  if (notAccepted.length > 0) {
    throw new Error(
      "All cast assignments must be accepted before publishing."
    );
  }
  const idx = shows.findIndex((s) => s.id === showId);
  if (idx !== -1) {
    shows[idx] = {
      ...shows[idx],
      status: "cast",
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function unpublishCastList(showId: string): Promise<void> {
  await delay(400);
  // Revert "sent" assignments back to "draft" (leave "accepted" and "declined" alone)
  for (const a of castAssignments) {
    if (a.showId === showId && a.status === "sent") {
      a.status = "draft";
    }
  }
  // Revert show status to "casting"
  const idx = shows.findIndex((s) => s.id === showId);
  if (idx !== -1) {
    shows[idx] = {
      ...shows[idx],
      status: "casting",
      updatedAt: new Date().toISOString(),
    };
  }
}
