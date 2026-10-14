/**
 * Show Hub API — rehearsals, announcements, absences, files, comm norms.
 * Same dual-mode contract as client.ts: Supabase when configured, mock
 * fallback otherwise. Cloud reads of migration-010 tables are try/catch
 * wrapped so they degrade to empty before PASTE_ME_NEXT.sql is pasted.
 */

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getShow,
  getShowRoles,
  getShowTeam,
  getShowAccess,
  getCastAssignments,
  getShowConflicts,
} from "@/lib/api/client";
import { MAX_UPLOAD_BYTES } from "@/lib/api/photos";
import {
  rehearsals as mockRehearsals,
  rehearsalAbsences as mockAbsences,
  announcements as mockAnnouncements,
  commNorms as mockCommNorms,
  volunteerNeeds as mockVolunteerNeeds,
  volunteerSignups as mockVolunteerSignups,
  volunteerEvents as mockVolunteerEvents,
  volunteerShifts as mockVolunteerShifts,
  memberConflicts as mockMemberConflicts,
  showLinks as mockShowLinks,
  type MockVolunteerNeed,
  type MockVolunteerEvent,
  type MockVolunteerShift,
} from "@/data/hub";
import { shows as mockShows } from "@/data/shows";
import { actors, auditionSignups as mockSignups } from "@/data/actors";
import type {
  ID,
  Show,
  ShowRole,
  ShowTeamMember,
  CastAssignment,
  ShowConflictEntry,
  Rehearsal,
  RehearsalAbsence,
  Announcement,
  AnnouncementAudience,
  ShowFile,
  CommNormItem,
  CalledScope,
  CalledGroup,
  VolunteerNeed,
  VolunteerSignupEntry,
  VolunteerBoard,
  VolunteerShiftInfo,
  VolunteerEvent,
  VolunteerShift,
} from "@/types";

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const SHOW_FILES_BUCKET = "show-files";

/* ============================================================
   Access — "production member" = accepted cast + show team +
   org owner/admin. Cast members must reach the hub, so this is
   deliberately broader than getShowAccess (team-only).
   ============================================================ */

export async function getHubAccess(
  showId: string,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const supabase = getSupabase();
  const [{ data: teamRow }, { data: castRow }, { data: showRow }] =
    await Promise.all([
      supabase
        .from("show_team_members")
        .select("id")
        .eq("show_id", showId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("cast_assignments")
        .select("id")
        .eq("show_id", showId)
        .eq("actor_id", userId)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle(),
      supabase.from("shows").select("org_id").eq("id", showId).maybeSingle(),
    ]);
  if (teamRow || castRow) return true;
  if (!showRow) return false;
  const { data: memberRow } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", showRow.org_id)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  return !!memberRow;
}

/* ============================================================
   Who's called — shared resolution used by the page and the
   next-call computation. Mirrors announce_to_show / the
   reminder engine's server-side logic.
   ============================================================ */

const PRINCIPAL_ROLE_TYPES = new Set(["lead", "supporting"]);

export function resolveCalledUserIds(
  rehearsal: Rehearsal,
  acceptedCast: CastAssignment[],
  team: ShowTeamMember[],
  roles: ShowRole[]
): Set<ID> {
  const roleTypeById = new Map(roles.map((r) => [r.id, r.roleType]));
  // Guests (invited by email, no account yet — migration 024) have no user
  // id, so they can't be called/notified; drop their null actorIds.
  const castIds = acceptedCast
    .map((c) => c.actorId)
    .filter((id): id is ID => !!id);
  const teamIds = team.map((t) => t.userId);
  if (rehearsal.calledScope === "custom") {
    return new Set(rehearsal.calledPeople);
  }
  if (rehearsal.calledScope === "group") {
    if (rehearsal.calledGroup === "crew") return new Set(teamIds);
    const wantPrincipals = rehearsal.calledGroup === "principals";
    return new Set(
      acceptedCast
        .filter((c) => {
          const isPrincipal = PRINCIPAL_ROLE_TYPES.has(
            roleTypeById.get(c.roleId) ?? ""
          );
          return wantPrincipals ? isPrincipal : !isPrincipal;
        })
        .map((c) => c.actorId)
        .filter((id): id is ID => !!id)
    );
  }
  // everyone = full company (cast + team)
  return new Set([...castIds, ...teamIds]);
}

/** Short human label for a rehearsal's call, for who's-called chips. */
export function calledLabel(
  rehearsal: Rehearsal,
  peopleNames: (id: ID) => string
): string {
  if (rehearsal.calledScope === "everyone") return "Full company";
  if (rehearsal.calledScope === "group") {
    const labels: Record<CalledGroup, string> = {
      principals: "Principals",
      ensemble: "Ensemble",
      crew: "Production team",
    };
    return labels[rehearsal.calledGroup ?? "principals"];
  }
  const names = rehearsal.calledPeople.map(peopleNames).filter(Boolean);
  if (names.length === 0) return "Selected people";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

/* ============================================================
   Rehearsals
   ============================================================ */

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToRehearsal(r: any): Rehearsal {
  const call = Array.isArray(r.rehearsal_calls)
    ? r.rehearsal_calls[0]
    : r.rehearsal_calls;
  return {
    id: r.id,
    showId: r.show_id,
    date: r.rehearsal_date,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location ?? null,
    focus: r.focus ?? null,
    notes: r.notes ?? null,
    calledScope: (call?.called_scope ?? "everyone") as CalledScope,
    calledGroup: (call?.group_key ?? null) as CalledGroup | null,
    calledPeople: (r.rehearsal_call_people ?? []).map((p: any) => p.user_id),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const REHEARSAL_SELECT =
  "*, rehearsal_calls(called_scope, group_key), rehearsal_call_people(user_id)";

export async function getRehearsals(showId: string): Promise<Rehearsal[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("rehearsals")
        .select(REHEARSAL_SELECT)
        .eq("show_id", showId)
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map(rowToRehearsal);
    } catch (e) {
      console.warn("getRehearsals — table may not exist yet (paste migration 010):", e);
      return [];
    }
  }
  await delay();
  return mockRehearsals
    .filter((r) => r.showId === showId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((r) => ({ ...r, calledPeople: [...r.calledPeople] }));
}

export type RehearsalInput = {
  showId: ID;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  focus: string | null;
  notes: string | null;
  calledScope: CalledScope;
  calledGroup: CalledGroup | null;
  calledPeople: ID[];
};

async function writeCall(rehearsalId: string, input: RehearsalInput) {
  const supabase = getSupabase();
  const { error: callError } = await supabase.from("rehearsal_calls").upsert(
    {
      rehearsal_id: rehearsalId,
      called_scope: input.calledScope,
      group_key: input.calledScope === "group" ? input.calledGroup : null,
    },
    { onConflict: "rehearsal_id" }
  );
  if (callError) throw new Error(callError.message);
  // Replace the picked-people list wholesale.
  const { error: clearError } = await supabase
    .from("rehearsal_call_people")
    .delete()
    .eq("rehearsal_id", rehearsalId);
  if (clearError) throw new Error(clearError.message);
  if (input.calledScope === "custom" && input.calledPeople.length > 0) {
    const { error: peopleError } = await supabase
      .from("rehearsal_call_people")
      .insert(
        input.calledPeople.map((userId) => ({
          rehearsal_id: rehearsalId,
          user_id: userId,
        }))
      );
    if (peopleError) throw new Error(peopleError.message);
  }
}

export async function createRehearsal(input: RehearsalInput): Promise<Rehearsal> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from("rehearsals")
      .insert({
        show_id: input.showId,
        rehearsal_date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        location: input.location,
        focus: input.focus,
        notes: input.notes,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await writeCall(row.id, input);
    return {
      ...rowToRehearsal(row),
      calledScope: input.calledScope,
      calledGroup: input.calledScope === "group" ? input.calledGroup : null,
      calledPeople: input.calledScope === "custom" ? input.calledPeople : [],
    };
  }
  await delay(300);
  const rehearsal: Rehearsal = {
    id: `reh-${Date.now()}`,
    showId: input.showId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    focus: input.focus,
    notes: input.notes,
    calledScope: input.calledScope,
    calledGroup: input.calledScope === "group" ? input.calledGroup : null,
    calledPeople: input.calledScope === "custom" ? [...input.calledPeople] : [],
  };
  mockRehearsals.push(rehearsal);
  return rehearsal;
}

export async function updateRehearsal(
  rehearsalId: string,
  input: RehearsalInput
): Promise<Rehearsal> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from("rehearsals")
      .update({
        rehearsal_date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        location: input.location,
        focus: input.focus,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rehearsalId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Only the production team can edit rehearsals.");
    await writeCall(rehearsalId, input);
    return {
      ...rowToRehearsal(row),
      calledScope: input.calledScope,
      calledGroup: input.calledScope === "group" ? input.calledGroup : null,
      calledPeople: input.calledScope === "custom" ? input.calledPeople : [],
    };
  }
  await delay(200);
  const rehearsal = mockRehearsals.find((r) => r.id === rehearsalId);
  if (!rehearsal) throw new Error("Rehearsal not found.");
  Object.assign(rehearsal, {
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    focus: input.focus,
    notes: input.notes,
    calledScope: input.calledScope,
    calledGroup: input.calledScope === "group" ? input.calledGroup : null,
    calledPeople: input.calledScope === "custom" ? [...input.calledPeople] : [],
  });
  return rehearsal;
}

export async function deleteRehearsal(rehearsalId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("rehearsals")
      .delete()
      .eq("id", rehearsalId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = mockRehearsals.findIndex((r) => r.id === rehearsalId);
  if (idx !== -1) mockRehearsals.splice(idx, 1);
}

/* ============================================================
   Absences — "Can't make it"
   ============================================================ */

export async function getShowAbsences(
  showId: string
): Promise<RehearsalAbsence[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("rehearsal_absences")
        .select("*, profiles:user_id(display_name)")
        .eq("show_id", showId);
      if (error) throw error;
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      return (data ?? []).map((r: any) => ({
        id: r.id,
        rehearsalId: r.rehearsal_id,
        showId: r.show_id,
        userId: r.user_id,
        userName: r.profiles?.display_name ?? "",
        reason: r.reason ?? null,
        reportedAt: r.reported_at,
      }));
    } catch (e) {
      console.warn("getShowAbsences — table may not exist yet (paste migration 010):", e);
      return [];
    }
  }
  await delay();
  return mockAbsences.filter((a) => a.showId === showId).map((a) => ({ ...a }));
}

export async function reportAbsence(input: {
  rehearsalId: ID;
  showId: ID;
  userId: ID;
  userName: string;
  reason: string | null;
}): Promise<RehearsalAbsence> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("rehearsal_absences")
      .upsert(
        {
          rehearsal_id: input.rehearsalId,
          show_id: input.showId,
          user_id: input.userId,
          reason: input.reason,
        },
        { onConflict: "rehearsal_id,user_id" }
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      rehearsalId: data.rehearsal_id,
      showId: data.show_id,
      userId: data.user_id,
      userName: input.userName,
      reason: data.reason ?? null,
      reportedAt: data.reported_at,
    };
  }
  await delay(250);
  const existing = mockAbsences.find(
    (a) => a.rehearsalId === input.rehearsalId && a.userId === input.userId
  );
  if (existing) {
    existing.reason = input.reason;
    return existing;
  }
  const absence: RehearsalAbsence = {
    id: `abs-${Date.now()}`,
    rehearsalId: input.rehearsalId,
    showId: input.showId,
    userId: input.userId,
    userName: input.userName,
    reason: input.reason,
    reportedAt: new Date().toISOString(),
  };
  mockAbsences.push(absence);
  return absence;
}

/** Withdraw your own "can't make it" (plans changed). */
export async function cancelAbsence(
  rehearsalId: string,
  userId: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("rehearsal_absences")
      .delete()
      .eq("rehearsal_id", rehearsalId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = mockAbsences.findIndex(
    (a) => a.rehearsalId === rehearsalId && a.userId === userId
  );
  if (idx !== -1) mockAbsences.splice(idx, 1);
}

/* ============================================================
   My conflicts — dates a production member can't rehearse
   (member_conflicts, migration 025). Reads ride getShowConflicts
   (client.ts) which unions these with audition-signup ranges;
   RLS hands a cast member only their own rows. Writes fail LOUD
   pre-paste: silently losing a conflict is worse than an error.
   ============================================================ */

const MIGRATION_025_MSG =
  "Saving conflicts needs a database update (migration 025). Your conflict was NOT saved — let your Overture admin know, and text the stage manager in the meantime.";

/** Postgres "relation does not exist" (42P01) or PostgREST's schema-cache
 *  miss — both mean the table hasn't been pasted yet. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache");
}

export type MemberConflictInput = {
  showId: ID;
  userId: ID;
  startDate: string;
  endDate: string;
  note: string | null;
};

/** Add a hub conflict range for the signed-in member. Returns the row id. */
export async function addMemberConflict(
  input: MemberConflictInput
): Promise<ID> {
  if (input.endDate < input.startDate) {
    throw new Error("The end date can't be before the start date.");
  }
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("member_conflicts")
      .insert({
        show_id: input.showId,
        user_id: input.userId,
        start_date: input.startDate,
        end_date: input.endDate,
        note: input.note,
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_025_MSG);
      throw new Error(error.message);
    }
    return data.id as ID;
  }
  await delay(250);
  const id = `mc-${Date.now()}`;
  mockMemberConflicts.push({
    id,
    showId: input.showId,
    userId: input.userId,
    startDate: input.startDate,
    endDate: input.endDate,
    note: input.note,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** Remove one of your own hub-added ranges. */
export async function removeMemberConflict(conflictId: ID): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("member_conflicts")
      .delete()
      .eq("id", conflictId);
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_025_MSG);
      throw new Error(error.message);
    }
    return;
  }
  await delay(200);
  const idx = mockMemberConflicts.findIndex((m) => m.id === conflictId);
  if (idx !== -1) mockMemberConflicts.splice(idx, 1);
}

/**
 * Remove one of your own AUDITION-SIGNUP ranges (signup_conflicts row) from
 * the hub card — the actor owns it (migration 009 already grants the actor
 * DELETE on rows hanging off their own signup). The legacy freetext
 * `audition_signups.conflicts` string is left untouched on purpose.
 */
export async function removeSignupConflict(input: {
  rangeId: ID;
  signupId: ID;
  startDate: string;
  endDate: string;
}): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("signup_conflicts")
      .delete()
      .eq("id", input.rangeId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const signup = mockSignups.find((s) => s.id === input.signupId);
  if (!signup?.conflictDates) return;
  const idx = signup.conflictDates.findIndex(
    (c) => c.startDate === input.startDate && c.endDate === input.endDate
  );
  if (idx !== -1) signup.conflictDates.splice(idx, 1);
}

/** The viewer's own unified ranges for this show, from a hub conflicts list. */
export function myConflictRanges(
  conflicts: ShowConflictEntry[],
  userId: ID
) {
  const mine = conflicts.find((c) => c.actorId === userId);
  return mine
    ? { signupId: mine.signupId, ranges: mine.ranges }
    : { signupId: null, ranges: [] };
}

/** Does any of these ranges cover the given YYYY-MM-DD date? */
export function rangesCoverDate(
  ranges: { startDate: string; endDate: string }[],
  date: string
): boolean {
  return ranges.some((r) => r.startDate <= date && date <= r.endDate);
}

/* ============================================================
   Announcements
   ============================================================ */

export async function getAnnouncements(
  showId: string,
  userId: string
): Promise<Announcement[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("announcements")
        .select(
          "*, profiles:author_id(display_name), announcement_reads(user_id)"
        )
        .eq("show_id", showId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      return (data ?? []).map((r: any) => {
        const readerIds = (r.announcement_reads ?? []).map(
          (x: { user_id: string }) => x.user_id
        );
        return {
          id: r.id,
          showId: r.show_id,
          authorId: r.author_id,
          authorName: r.profiles?.display_name ?? "Production team",
          bodyMd: r.body_md,
          audience: r.audience,
          rehearsalId: r.rehearsal_id ?? null,
          pinned: r.pinned,
          emailed: r.emailed,
          createdAt: r.created_at,
          isRead: readerIds.includes(userId),
          readerIds,
        };
      });
    } catch (e) {
      console.warn("getAnnouncements — table may not exist yet (paste migration 010):", e);
      return [];
    }
  }
  await delay();
  return mockAnnouncements
    .filter((a) => a.showId === showId)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.createdAt.localeCompare(a.createdAt)
    )
    .map((a) => ({
      ...a,
      isRead: a.readerIds.includes(userId),
      readerIds: [...a.readerIds],
    }));
}

/** Plain-text excerpt of a markdown body for notification copy. */
function excerpt(md: string, max = 140): string {
  const text = md
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[_*]/g, "")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function postAnnouncement(input: {
  showId: ID;
  showTitle: string | null;
  authorId: ID;
  authorName: string;
  bodyMd: string;
  audience: AnnouncementAudience;
  rehearsalId: ID | null;
  pinned: boolean;
  alsoEmail: boolean;
}): Promise<Announcement> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from("announcements")
      .insert({
        show_id: input.showId,
        author_id: input.authorId,
        body_md: input.bodyMd,
        audience: input.audience,
        rehearsal_id: input.audience === "rehearsal" ? input.rehearsalId : null,
        pinned: input.pinned,
        emailed: input.alsoEmail,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Fan out in-app notifications to the targeted members (email delivery
    // rides the notifications → send-notification-email pipeline). Best
    // effort: a fan-out failure never fails the post.
    try {
      const { error: rpcError } = await supabase.rpc("announce_to_show", {
        p_announcement_id: row.id,
        p_title: `Announcement — ${input.showTitle ?? "your show"}`,
        p_body: excerpt(input.bodyMd),
        p_show_title: input.showTitle,
      });
      if (rpcError) console.warn("Announcement fan-out skipped:", rpcError.message);
    } catch (e) {
      console.warn("Announcement fan-out skipped:", e);
    }

    return {
      id: row.id,
      showId: row.show_id,
      authorId: row.author_id,
      authorName: input.authorName,
      bodyMd: row.body_md,
      audience: row.audience,
      rehearsalId: row.rehearsal_id ?? null,
      pinned: row.pinned,
      emailed: row.emailed,
      createdAt: row.created_at,
      isRead: false,
      readerIds: [],
    };
  }
  await delay(300);
  const announcement: Announcement = {
    id: `ann-${Date.now()}`,
    showId: input.showId,
    authorId: input.authorId,
    authorName: input.authorName,
    bodyMd: input.bodyMd,
    audience: input.audience,
    rehearsalId: input.audience === "rehearsal" ? input.rehearsalId : null,
    pinned: input.pinned,
    emailed: input.alsoEmail,
    createdAt: new Date().toISOString(),
    isRead: false,
    readerIds: [],
  };
  mockAnnouncements.unshift(announcement);
  return announcement;
}

export async function setAnnouncementPinned(
  announcementId: string,
  pinned: boolean
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("announcements")
      .update({ pinned })
      .eq("id", announcementId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(150);
  const a = mockAnnouncements.find((x) => x.id === announcementId);
  if (a) a.pinned = pinned;
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("announcements")
      .delete()
      .eq("id", announcementId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(150);
  const idx = mockAnnouncements.findIndex((x) => x.id === announcementId);
  if (idx !== -1) mockAnnouncements.splice(idx, 1);
}

/** Record that the viewer has seen an announcement (mark-read on view). */
export async function markAnnouncementRead(
  announcementId: string,
  userId: string
): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await getSupabase()
        .from("announcement_reads")
        .upsert(
          { announcement_id: announcementId, user_id: userId },
          { onConflict: "announcement_id,user_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    } catch (e) {
      console.warn("markAnnouncementRead skipped:", e);
    }
    return;
  }
  const a = mockAnnouncements.find((x) => x.id === announcementId);
  if (a && !a.readerIds.includes(userId)) a.readerIds.push(userId);
}

/* ============================================================
   Show files (Resources) — cloud-only storage, like PhotoSection
   ============================================================ */

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function rowToShowFile(r: any): ShowFile {
  return {
    id: r.id,
    showId: r.show_id,
    storagePath: r.storage_path ?? null,
    // Pre-026 rows have no url column → null (a file row).
    url: r.url ?? null,
    label: r.label,
    category: r.category ?? null,
    sizeBytes: r.size_bytes ?? null,
    uploadedBy: r.uploaded_by ?? null,
    createdAt: r.created_at,
  };
}

export async function getShowFiles(showId: string): Promise<ShowFile[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("show_files")
        .select("*")
        .eq("show_id", showId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToShowFile);
    } catch (e) {
      console.warn("getShowFiles — table may not exist yet (paste migration 010):", e);
      return [];
    }
  }
  await delay();
  // Mock mode has no storage (uploads show a cloud-only note) but links
  // work end to end — the demo's Resources card shows them.
  return mockShowLinks
    .filter((l) => l.showId === showId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((l) => ({ ...l }));
}

export async function uploadShowFile(
  showId: string,
  file: File,
  label: string,
  category: string | null,
  uploadedBy: string
): Promise<ShowFile> {
  if (!isSupabaseConfigured) {
    throw new Error("File uploads are available once your theatre is on the cloud.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is over 10MB — try a smaller one.");
  }
  const supabase = getSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
  const path = `${showId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(SHOW_FILES_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: row, error } = await supabase
    .from("show_files")
    .insert({
      show_id: showId,
      storage_path: path,
      label: label || file.name,
      category,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToShowFile(row);
}

export async function deleteShowFile(file: ShowFile): Promise<void> {
  if (!isSupabaseConfigured) {
    await delay(150);
    const idx = mockShowLinks.findIndex((l) => l.id === file.id);
    if (idx !== -1) mockShowLinks.splice(idx, 1);
    return;
  }
  const supabase = getSupabase();
  const { error } = await supabase.from("show_files").delete().eq("id", file.id);
  if (error) throw new Error(error.message);
  // Link rows (migration 026) have nothing in storage to remove.
  if (file.storagePath) {
    await supabase.storage.from(SHOW_FILES_BUCKET).remove([file.storagePath]);
  }
}

/* ── Links (migration 026) — Resources holds links beside files ── */

const MIGRATION_026_LINKS_MSG =
  "Adding links needs a database update (migration 026). The link was NOT saved — let your Overture admin know. Uploads still work in the meantime.";

/** Postgres "column does not exist" (42703), a CHECK violation on the old
 *  NOT NULL storage_path (23502), or PostgREST's schema-cache miss — all
 *  mean migration 026 hasn't been pasted. */
function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42703" || err.code === "23502" || err.code === "PGRST204") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache") || m.includes("null value");
}

/**
 * Validate a user-typed resource link: http(s) only (never javascript:/data:),
 * a protocol added when missing. Returns the normalized URL or null.
 */
export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function addShowLink(input: {
  showId: ID;
  title: string;
  url: string;
  userId: ID;
}): Promise<ShowFile> {
  const url = normalizeLinkUrl(input.url);
  if (!url) throw new Error("That doesn't look like a web link — it needs to start with http:// or https://.");
  const label = input.title.trim() || url.replace(/^https?:\/\//, "").slice(0, 80);
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("show_files")
      .insert({
        show_id: input.showId,
        storage_path: null,
        url,
        label,
        category: "link",
        uploaded_by: input.userId,
      })
      .select("*")
      .single();
    if (error) {
      // Deliberately LOUD pre-paste — silently "saving" a link that never
      // lands would be worse than an error.
      if (isMissingColumn(error)) throw new Error(MIGRATION_026_LINKS_MSG);
      throw new Error(error.message);
    }
    return rowToShowFile(row);
  }
  await delay(250);
  const link: ShowFile = {
    id: `link-${Date.now()}`,
    showId: input.showId,
    storagePath: null,
    url,
    label,
    category: "link",
    sizeBytes: null,
    uploadedBy: input.userId,
    createdAt: new Date().toISOString(),
  };
  mockShowLinks.unshift(link);
  return link;
}

/** Short-lived signed URL — the show-files bucket is private. */
export async function getShowFileUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(SHOW_FILES_BUCKET)
    .createSignedUrl(path, 120);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/* ============================================================
   Send a note (QC #32) — a production member writes a short note
   to a PRODUCTION TEAM member; it lands as an in-app notification
   and rides the notifications → send-notification-email pipeline
   with Reply-To = the sender (migration 026's send_show_note).
   Pre-paste: falls back to create_notification (uncategorized →
   still emails, just without Reply-To). v1 recipients are team
   members only — cast-to-cast messaging is a later roadmap item.
   ============================================================ */

export const NOTE_MAX_CHARS = 1000;

/** PostgREST "function not found" (PGRST202) or Postgres 42883. */
function isMissingFunction(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "PGRST202" || err.code === "42883") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("could not find the function") || m.includes("does not exist");
}

export async function sendShowNote(input: {
  showId: ID;
  showTitle: string | null;
  recipientId: ID;
  senderName: string;
  subject: string;
  message: string;
}): Promise<{ replyTo: boolean }> {
  const message = input.message.trim();
  const subject = input.subject.trim();
  if (!message) throw new Error("Write something first.");
  if (message.length > NOTE_MAX_CHARS) {
    throw new Error(`Notes are limited to ${NOTE_MAX_CHARS} characters.`);
  }
  const title = subject
    ? `Note from ${input.senderName}: ${subject}`
    : `Note from ${input.senderName}`;

  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("send_show_note", {
      p_show_id: input.showId,
      p_recipient_id: input.recipientId,
      p_title: title,
      p_body: message,
    });
    if (!error) return { replyTo: true };
    if (!isMissingFunction(error)) throw new Error(error.message);

    // Migration 026 not pasted yet — the relationship-checked
    // create_notification (012) still delivers in-app + email (untagged
    // rows always email), just without Reply-To.
    const { error: fallbackError } = await supabase.rpc("create_notification", {
      p_recipient_id: input.recipientId,
      p_show_id: input.showId,
      p_type: "system",
      p_title: title,
      p_body: message,
      p_show_title: input.showTitle,
      p_link_url: `/shows/${input.showId}/hub`,
    });
    if (fallbackError) throw new Error(fallbackError.message);
    console.warn("send_show_note RPC missing (paste migration 026) — sent via create_notification without Reply-To.");
    return { replyTo: false };
  }
  await delay(400);
  return { replyTo: true };
}

/* ============================================================
   Comm norms — "who to contact for what" routing card.
   Stored one-row-per-show in show_comm_norms.items (jsonb array
   of { topic, contact, method }).
   ============================================================ */

export async function getCommNorms(showId: string): Promise<CommNormItem[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("show_comm_norms")
        .select("items")
        .eq("show_id", showId)
        .maybeSingle();
      if (error) throw error;
      return (data?.items as CommNormItem[]) ?? [];
    } catch (e) {
      console.warn("getCommNorms — table may not exist yet (paste migration 010):", e);
      return [];
    }
  }
  await delay();
  return (mockCommNorms[showId] ?? []).map((i) => ({ ...i }));
}

export async function updateCommNorms(
  showId: string,
  items: CommNormItem[]
): Promise<CommNormItem[]> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("show_comm_norms")
      .upsert(
        { show_id: showId, items, updated_at: new Date().toISOString() },
        { onConflict: "show_id" }
      );
    if (error) throw new Error(error.message);
    return items;
  }
  await delay(250);
  mockCommNorms[showId] = items.map((i) => ({ ...i }));
  return items;
}

/* ============================================================
   Hub composition — one query for the page
   ============================================================ */

export type HubData = {
  show: Show | null;
  roles: ShowRole[];
  team: ShowTeamMember[];
  /** Accepted cast only — the company. */
  cast: CastAssignment[];
  rehearsals: Rehearsal[];
  absences: RehearsalAbsence[];
  announcements: Announcement[];
  commNorms: CommNormItem[];
  conflicts: ShowConflictEntry[];
};

/**
 * Is this announcement addressed to the viewer? Mirrors announce_to_show's
 * recipient resolution (and migration 019's is_announcement_recipient):
 * company → anyone with hub access · cast → accepted cast · principals →
 * accepted cast in lead/supporting roles · crew → team · rehearsal →
 * the rehearsal call's called set (deleted rehearsal falls back to company).
 */
function isAnnouncementForViewer(
  a: Announcement,
  userId: ID,
  cast: CastAssignment[],
  team: ShowTeamMember[],
  roles: ShowRole[],
  rehearsals: Rehearsal[]
): boolean {
  if (a.audience === "rehearsal") {
    const rehearsal = a.rehearsalId
      ? rehearsals.find((r) => r.id === a.rehearsalId)
      : undefined;
    if (rehearsal) {
      return resolveCalledUserIds(rehearsal, cast, team, roles).has(userId);
    }
    // Rehearsal deleted (SET NULL) — same fallback as the fan-out: company.
    return true;
  }
  if (a.audience === "company") return true; // viewer already passed the hub gate
  const onTeam = team.some((t) => t.userId === userId);
  if (a.audience === "crew") return onTeam;
  const myAccepted = cast.filter((c) => c.actorId === userId);
  if (a.audience === "cast") return myAccepted.length > 0;
  // principals = accepted cast in lead/supporting roles
  const roleTypeById = new Map(roles.map((r) => [r.id, r.roleType]));
  return myAccepted.some((c) =>
    PRINCIPAL_ROLE_TYPES.has(roleTypeById.get(c.roleId) ?? "")
  );
}

export async function getHubData(
  showId: string,
  userId: string
): Promise<HubData> {
  const [
    show,
    roles,
    team,
    assignments,
    rehearsalList,
    absences,
    announcementList,
    norms,
    conflicts,
    isManager,
  ] = await Promise.all([
    getShow(showId),
    getShowRoles(showId),
    getShowTeam(showId),
    getCastAssignments(showId),
    getRehearsals(showId),
    getShowAbsences(showId),
    getAnnouncements(showId, userId),
    getCommNorms(showId),
    getShowConflicts(showId),
    // Team / org admin (real mock branch too) — managers see every
    // announcement with its audience label; everyone else only their own.
    getShowAccess(showId, userId).catch(() => false),
  ]);
  const cast = assignments.filter((a) => a.status === "accepted");
  // Targeted-announcement display (QC P1-6): the fan-out already targets
  // correctly; filter the hub READ the same way for non-managers. Migration
  // 019 enforces this at the RLS level too — this keeps mock mode and the
  // pre-paste window honest.
  const announcements = isManager
    ? announcementList
    : announcementList.filter((a) =>
        isAnnouncementForViewer(a, userId, cast, team, roles, rehearsalList)
      );
  return {
    show,
    roles,
    team,
    cast,
    rehearsals: rehearsalList,
    absences,
    announcements,
    commNorms: norms,
    conflicts,
  };
}

/** Display-name lookup that also covers mock actors (for called chips). */
export function nameForUser(
  userId: ID,
  cast: CastAssignment[],
  team: ShowTeamMember[]
): string {
  const castHit = cast.find((c) => c.actorId === userId);
  if (castHit?.actorName) return castHit.actorName;
  const teamHit = team.find((t) => t.userId === userId);
  if (teamHit?.userName) return teamHit.userName;
  if (!isSupabaseConfigured) {
    const actor = actors.find((a) => a.id === userId);
    if (actor) return actor.displayName;
  }
  return "";
}

/* ============================================================
   Volunteers — dual-path (SHOW_HUB_SPEC.md).
   Company members: one-tap claim/unclaim from the hub.
   Community guests: NO account — the public /volunteer/[showId]
   page claims through the SECURITY DEFINER claim_volunteer_slot
   RPC (anon-safe, capacity-checked). This is the approved
   exception to the access-gating rule.
   ============================================================ */

/**
 * Has this shift already happened? Over once its end time (or start time,
 * when no end) has passed; date-only needs are past once the viewer's local
 * date is beyond the event date. Mirrors migration 019's RPC guard.
 */
export function isShiftPast(n: {
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
}): boolean {
  const now = new Date();
  if (n.endTime) return new Date(n.endTime).getTime() < now.getTime();
  if (n.startTime) return new Date(n.startTime).getTime() < now.getTime();
  if (n.eventDate) {
    const pad = (x: number) => String(x).padStart(2, "0");
    const todayLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return n.eventDate < todayLocal;
  }
  return false;
}

function mockNeedToVolunteerNeed(n: MockVolunteerNeed): VolunteerNeed {
  return {
    id: n.id,
    showId: n.showId,
    label: n.label,
    eventDate: n.eventDate,
    startTime: n.startTime,
    endTime: n.endTime,
    slots: n.slots,
    notes: n.notes,
    signups: mockVolunteerSignups
      .filter((s) => s.needId === n.id && s.status === "confirmed")
      .map((s) => ({
        id: s.id,
        userId: s.userId,
        name: s.name,
        isGuest: s.userId === null,
      })),
    eventId: n.eventId ?? null,
    shiftId: n.shiftId ?? null,
    roleLabel: n.roleLabel ?? null,
  };
}

/** Hub view — needs + who's signed up. Production members only (RLS). */
export async function getVolunteerNeeds(showId: string): Promise<VolunteerNeed[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("volunteer_needs")
        .select(
          "*, volunteer_signups(id, user_id, guest_name, status, profiles:user_id(display_name))"
        )
        .eq("show_id", showId)
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("label");
      if (error) throw error;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      return (data ?? []).map((n: any) => ({
        id: n.id,
        showId: n.show_id,
        label: n.label,
        eventDate: n.event_date ?? null,
        startTime: n.start_time ?? null,
        endTime: n.end_time ?? null,
        slots: n.slots,
        notes: n.notes ?? null,
        signups: (n.volunteer_signups ?? [])
          .filter((s: any) => s.status === "confirmed")
          .map(
            (s: any): VolunteerSignupEntry => ({
              id: s.id,
              userId: s.user_id ?? null,
              name: s.profiles?.display_name ?? s.guest_name ?? "Volunteer",
              isGuest: !s.user_id,
            })
          ),
        // Migration 027 columns — undefined pre-paste → null → flat rendering.
        eventId: n.event_id ?? null,
        shiftId: n.shift_id ?? null,
        roleLabel: n.role_label ?? null,
      }));
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch (e) {
      console.warn("getVolunteerNeeds — table may not exist yet (paste migration 010/011):", e);
      return [];
    }
  }
  await delay();
  return mockVolunteerNeeds
    .filter((n) => n.showId === showId)
    .map(mockNeedToVolunteerNeed);
}

export type VolunteerNeedInput = {
  showId: ID;
  label: string;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  slots: number;
  notes: string | null;
};

export async function createVolunteerNeed(
  input: VolunteerNeedInput
): Promise<VolunteerNeed> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("volunteer_needs")
      .insert({
        show_id: input.showId,
        label: input.label,
        event_date: input.eventDate,
        start_time: input.startTime,
        end_time: input.endTime,
        slots: input.slots,
        notes: input.notes,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      showId: data.show_id,
      label: data.label,
      eventDate: data.event_date ?? null,
      startTime: data.start_time ?? null,
      endTime: data.end_time ?? null,
      slots: data.slots,
      notes: data.notes ?? null,
      signups: [],
      eventId: data.event_id ?? null,
      shiftId: data.shift_id ?? null,
      roleLabel: data.role_label ?? null,
    };
  }
  await delay(250);
  const need: MockVolunteerNeed = {
    id: `vol-${Date.now()}`,
    showId: input.showId,
    label: input.label,
    eventDate: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    slots: input.slots,
    notes: input.notes,
  };
  mockVolunteerNeeds.push(need);
  return mockNeedToVolunteerNeed(need);
}

export async function updateVolunteerNeed(
  needId: string,
  input: VolunteerNeedInput
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("volunteer_needs")
      .update({
        label: input.label,
        event_date: input.eventDate,
        start_time: input.startTime,
        end_time: input.endTime,
        slots: input.slots,
        notes: input.notes,
      })
      .eq("id", needId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const need = mockVolunteerNeeds.find((n) => n.id === needId);
  if (!need) throw new Error("Volunteer need not found.");
  Object.assign(need, {
    label: input.label,
    eventDate: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    slots: input.slots,
    notes: input.notes,
  });
}

export async function deleteVolunteerNeed(needId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("volunteer_needs")
      .delete()
      .eq("id", needId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  mockRemoveNeed(needId);
}

/* ── Events → shifts → roles (migration 027, QC #14) ──
   An EVENT ("Set build Saturday") has SHIFTS (9–12, 12–3), each with ROLES
   (Carpentry ×3, Painting ×2). A role IS a volunteer_needs row, so claims,
   guest signups, cancel tokens, and the T-24h reminder scan are untouched.
   At write time each role need gets its shift's start/end, the event's
   date, and a composed label "<role> — <event>" — that denormalization is
   what keeps the reminder cron + RPC copy working with no redeploy. */

const MIGRATION_027_MSG =
  "Volunteer events need a database update (migration 027). Nothing was saved — let your Overture admin know. The simple \"Add a need\" path still works in the meantime.";

function isMissingEventsTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205" || err.code === "42703" || err.code === "PGRST204") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache");
}

export type VolunteerRoleInput = {
  /** Present when editing an existing role (need) row. */
  id?: ID;
  label: string;
  slots: number;
};

export type VolunteerShiftInput = {
  id?: ID;
  /** ISO instants (built from the event date + HH:MM), or null for "any time". */
  startTime: string | null;
  endTime: string | null;
  label: string | null;
  roles: VolunteerRoleInput[];
};

export type VolunteerEventInput = {
  showId: ID;
  title: string;
  eventDate: string | null;
  location: string | null;
  notes: string | null;
  shifts: VolunteerShiftInput[];
};

/** The composed need label for a role — what reminders + RPC copy print. */
export function composeRoleLabel(role: string, eventTitle: string): string {
  return `${role.trim()} — ${eventTitle.trim()}`;
}

function mockRemoveNeed(needId: string) {
  const idx = mockVolunteerNeeds.findIndex((n) => n.id === needId);
  if (idx !== -1) mockVolunteerNeeds.splice(idx, 1);
  for (let i = mockVolunteerSignups.length - 1; i >= 0; i--) {
    if (mockVolunteerSignups[i].needId === needId) mockVolunteerSignups.splice(i, 1);
  }
}

function mockRemoveShift(shiftId: string) {
  const idx = mockVolunteerShifts.findIndex((s) => s.id === shiftId);
  if (idx !== -1) mockVolunteerShifts.splice(idx, 1);
  mockVolunteerNeeds
    .filter((n) => n.shiftId === shiftId)
    .map((n) => n.id)
    .forEach(mockRemoveNeed);
}

function mockEventToVolunteerEvent(e: MockVolunteerEvent): VolunteerEvent {
  return {
    id: e.id,
    showId: e.showId,
    title: e.title,
    eventDate: e.eventDate,
    location: e.location,
    notes: e.notes,
    shifts: mockVolunteerShifts
      .filter((s) => s.eventId === e.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(
        (s): VolunteerShift => ({
          id: s.id,
          eventId: s.eventId,
          startTime: s.startTime,
          endTime: s.endTime,
          label: s.label,
        })
      ),
  };
}

/** Events + their shifts for a show. Roles come from getVolunteerNeeds
 *  (needs with eventId/shiftId set). Cloud try/catch → [] pre-paste. */
export async function getVolunteerEvents(showId: string): Promise<VolunteerEvent[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("volunteer_events")
        .select("*, volunteer_shifts(id, event_id, start_time, end_time, label, sort_order)")
        .eq("show_id", showId)
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("title");
      if (error) throw error;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      return (data ?? []).map((e: any): VolunteerEvent => ({
        id: e.id,
        showId: e.show_id,
        title: e.title,
        eventDate: e.event_date ?? null,
        location: e.location ?? null,
        notes: e.notes ?? null,
        shifts: ((e.volunteer_shifts ?? []) as any[])
          .slice()
          .sort(
            (a, b) =>
              (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
              String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""))
          )
          .map(
            (s): VolunteerShift => ({
              id: s.id,
              eventId: s.event_id,
              startTime: s.start_time ?? null,
              endTime: s.end_time ?? null,
              label: s.label ?? null,
            })
          ),
      }));
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch (e) {
      console.warn("getVolunteerEvents — table may not exist yet (paste migration 027):", e);
      return [];
    }
  }
  await delay();
  return mockVolunteerEvents
    .filter((e) => e.showId === showId)
    .map(mockEventToVolunteerEvent);
}

function validateEventInput(input: VolunteerEventInput) {
  if (!input.title.trim()) throw new Error("Give the event a title — e.g. \"Set build Saturday\".");
  if (input.shifts.length === 0) throw new Error("Add at least one shift.");
  for (const shift of input.shifts) {
    if (shift.roles.length === 0) throw new Error("Every shift needs at least one role.");
    for (const role of shift.roles) {
      if (!role.label.trim()) throw new Error("Every role needs a name — e.g. \"Carpentry\".");
      if (!Number.isFinite(role.slots) || role.slots < 1)
        throw new Error("Each role needs at least 1 spot.");
    }
  }
}

/**
 * Create an event with all its shifts and roles in one go. Cloud: fails
 * LOUD pre-paste (a missing volunteer_events table → migration-027 toast);
 * if a later step fails after the event row exists, the event is deleted
 * again so there's never a half-created event.
 */
export async function createVolunteerEvent(input: VolunteerEventInput): Promise<VolunteerEvent> {
  validateEventInput(input);
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: ev, error } = await supabase
      .from("volunteer_events")
      .insert({
        show_id: input.showId,
        title: input.title.trim(),
        event_date: input.eventDate,
        location: input.location,
        notes: input.notes,
      })
      .select("*")
      .single();
    if (error) {
      if (isMissingEventsTable(error)) throw new Error(MIGRATION_027_MSG);
      throw new Error(error.message);
    }
    try {
      await writeShiftsAndRoles(ev.id, input);
    } catch (e) {
      // Roll back — cascade removes any shifts/roles already written.
      await supabase.from("volunteer_events").delete().eq("id", ev.id);
      throw e;
    }
    const events = await getVolunteerEvents(input.showId);
    return events.find((e) => e.id === ev.id)!;
  }
  await delay(300);
  const id = `vevt-${Date.now()}`;
  mockVolunteerEvents.push({
    id,
    showId: input.showId,
    title: input.title.trim(),
    eventDate: input.eventDate,
    location: input.location,
    notes: input.notes,
  });
  mockWriteShiftsAndRoles(id, input);
  return mockEventToVolunteerEvent(mockVolunteerEvents.find((e) => e.id === id)!);
}

/**
 * Save edits to an event: updates the event row, upserts shifts + roles by
 * id, deletes shifts/roles that were removed from the draft (their signups
 * go with them — the UI warns + confirms first), and re-stamps every role
 * with the event's date, its shift's times, and the composed label.
 */
export async function saveVolunteerEvent(
  eventId: ID,
  input: VolunteerEventInput,
  existing: VolunteerEvent
): Promise<void> {
  validateEventInput(input);
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("volunteer_events")
      .update({
        title: input.title.trim(),
        event_date: input.eventDate,
        location: input.location,
        notes: input.notes,
      })
      .eq("id", eventId);
    if (error) {
      if (isMissingEventsTable(error)) throw new Error(MIGRATION_027_MSG);
      throw new Error(error.message);
    }
    // Shifts dropped from the draft → delete (cascades their roles + signups).
    const keptShiftIds = new Set(input.shifts.map((s) => s.id).filter(Boolean));
    const droppedShifts = existing.shifts.filter((s) => !keptShiftIds.has(s.id)).map((s) => s.id);
    if (droppedShifts.length > 0) {
      const { error: delErr } = await supabase
        .from("volunteer_shifts")
        .delete()
        .in("id", droppedShifts);
      if (delErr) throw new Error(delErr.message);
    }
    await writeShiftsAndRoles(eventId, input);
    return;
  }
  await delay(250);
  const ev = mockVolunteerEvents.find((e) => e.id === eventId);
  if (!ev) throw new Error("Volunteer event not found.");
  Object.assign(ev, {
    title: input.title.trim(),
    eventDate: input.eventDate,
    location: input.location,
    notes: input.notes,
  });
  const keptShiftIds = new Set(input.shifts.map((s) => s.id).filter(Boolean));
  mockVolunteerShifts
    .filter((s) => s.eventId === eventId && !keptShiftIds.has(s.id))
    .map((s) => s.id)
    .forEach(mockRemoveShift);
  mockWriteShiftsAndRoles(eventId, input);
}

/** Cloud: upsert shifts + roles for an event; delete roles dropped from
 *  kept shifts. Roles get the denormalized date/times/label. */
async function writeShiftsAndRoles(eventId: ID, input: VolunteerEventInput): Promise<void> {
  const supabase = getSupabase();
  const title = input.title.trim();
  for (let si = 0; si < input.shifts.length; si++) {
    const shift = input.shifts[si];
    let shiftId = shift.id;
    const shiftRow = {
      event_id: eventId,
      show_id: input.showId,
      start_time: shift.startTime,
      end_time: shift.endTime,
      label: shift.label?.trim() || null,
      sort_order: si,
    };
    if (shiftId) {
      const { error } = await supabase.from("volunteer_shifts").update(shiftRow).eq("id", shiftId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from("volunteer_shifts")
        .insert(shiftRow)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      shiftId = data.id as ID;
    }

    // Roles dropped from this (kept) shift → delete.
    const keptRoleIds = shift.roles.map((r) => r.id).filter((x): x is ID => !!x);
    if (shift.id) {
      let q = supabase.from("volunteer_needs").delete().eq("shift_id", shiftId);
      if (keptRoleIds.length > 0) q = q.not("id", "in", `(${keptRoleIds.join(",")})`);
      const { error } = await q;
      if (error) throw new Error(error.message);
    }

    for (const role of shift.roles) {
      const needRow = {
        show_id: input.showId,
        label: composeRoleLabel(role.label, title),
        role_label: role.label.trim(),
        event_id: eventId,
        shift_id: shiftId,
        event_date: input.eventDate,
        start_time: shift.startTime,
        end_time: shift.endTime,
        slots: role.slots,
        notes: null,
      };
      if (role.id) {
        const { error } = await supabase.from("volunteer_needs").update(needRow).eq("id", role.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("volunteer_needs").insert(needRow);
        if (error) throw new Error(error.message);
      }
    }
  }
}

function mockWriteShiftsAndRoles(eventId: ID, input: VolunteerEventInput) {
  const title = input.title.trim();
  input.shifts.forEach((shift, si) => {
    let shiftId = shift.id;
    if (shiftId) {
      const row = mockVolunteerShifts.find((s) => s.id === shiftId);
      if (row) {
        Object.assign(row, {
          startTime: shift.startTime,
          endTime: shift.endTime,
          label: shift.label?.trim() || null,
          sortOrder: si,
        });
      }
    } else {
      shiftId = `vsh-${Date.now()}-${si}`;
      const row: MockVolunteerShift = {
        id: shiftId,
        eventId,
        showId: input.showId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        label: shift.label?.trim() || null,
        sortOrder: si,
      };
      mockVolunteerShifts.push(row);
    }
    const keptRoleIds = new Set(shift.roles.map((r) => r.id).filter(Boolean));
    if (shift.id) {
      mockVolunteerNeeds
        .filter((n) => n.shiftId === shiftId && !keptRoleIds.has(n.id))
        .map((n) => n.id)
        .forEach(mockRemoveNeed);
    }
    shift.roles.forEach((role, ri) => {
      const fields = {
        label: composeRoleLabel(role.label, title),
        roleLabel: role.label.trim(),
        eventId,
        shiftId: shiftId!,
        eventDate: input.eventDate,
        startTime: shift.startTime,
        endTime: shift.endTime,
        slots: role.slots,
        notes: null,
      };
      const existing = role.id ? mockVolunteerNeeds.find((n) => n.id === role.id) : null;
      if (existing) Object.assign(existing, fields);
      else
        mockVolunteerNeeds.push({
          id: `vol-${Date.now()}-${si}-${ri}`,
          showId: input.showId,
          ...fields,
        });
    });
  });
}

/* ── Grouping (shared by the hub + the public guest page) ── */

/** The minimum a need row carries for grouping — satisfied by both
 *  VolunteerNeed (hub) and VolunteerBoard["needs"][number] (public). */
export type VolunteerRoleLike = {
  id: ID;
  label: string;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  slots: number;
  notes: string | null;
  eventId?: ID | null;
  shiftId?: ID | null;
  roleLabel?: string | null;
};

export type VolunteerEventLike = {
  id: ID;
  title: string;
  eventDate: string | null;
  location: string | null;
  notes: string | null;
  shifts: VolunteerShift[];
};

export type GroupedVolunteerEvent<N extends VolunteerRoleLike> = {
  event: VolunteerEventLike;
  shifts: { shift: VolunteerShift; roles: N[]; isPast: boolean }[];
  /** Roles attached to the event but to no shift (not produced by the
   *  builder, but rendered honestly if they ever exist). */
  unshifted: N[];
  roles: N[];
  isPast: boolean;
};

export type VolunteerListItem<N extends VolunteerRoleLike> =
  | { kind: "need"; key: string; need: N; isPast: boolean; sortKey: string }
  | { kind: "event"; key: string; group: GroupedVolunteerEvent<N>; isPast: boolean; sortKey: string };

/**
 * Turn flat needs + events into one date-ordered list of standalone needs
 * and grouped events. Needs whose event can't be found (events read failed,
 * or pre-paste) fall back to standalone rows — legacy flat rendering.
 */
export function groupVolunteerItems<N extends VolunteerRoleLike>(
  needs: N[],
  events: VolunteerEventLike[]
): VolunteerListItem<N>[] {
  const eventById = new Map(events.map((e) => [e.id, e]));
  const byEvent = new Map<ID, N[]>();
  const standalone: N[] = [];
  for (const n of needs) {
    if (n.eventId && eventById.has(n.eventId)) {
      const arr = byEvent.get(n.eventId) ?? [];
      arr.push(n);
      byEvent.set(n.eventId, arr);
    } else {
      standalone.push(n);
    }
  }
  const items: VolunteerListItem<N>[] = standalone.map((need) => ({
    kind: "need",
    key: `need-${need.id}`,
    need,
    isPast: isShiftPast(need),
    sortKey: `${need.eventDate ?? "9999-99-99"}|${need.startTime ?? ""}`,
  }));
  for (const event of events) {
    const roles = byEvent.get(event.id) ?? [];
    const shifts = event.shifts.map((shift) => {
      const shiftRoles = roles.filter((r) => r.shiftId === shift.id);
      const isPast =
        shiftRoles.length > 0
          ? shiftRoles.every(isShiftPast)
          : isShiftPast({ eventDate: event.eventDate, startTime: shift.startTime, endTime: shift.endTime });
      return { shift, roles: shiftRoles, isPast };
    });
    const unshifted = roles.filter((r) => !r.shiftId || !event.shifts.some((s) => s.id === r.shiftId));
    const isPast =
      roles.length > 0
        ? roles.every(isShiftPast)
        : shifts.length > 0
          ? shifts.every((s) => s.isPast)
          : isShiftPast({ eventDate: event.eventDate, startTime: null, endTime: null });
    const firstStart = event.shifts.map((s) => s.startTime).filter(Boolean).sort()[0] ?? "";
    items.push({
      kind: "event",
      key: `event-${event.id}`,
      group: { event, shifts, unshifted, roles, isPast },
      isPast,
      sortKey: `${event.eventDate ?? "9999-99-99"}|${firstStart}`,
    });
  }
  return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/** Delete an event — its shifts, roles, and their signups go with it. */
export async function deleteVolunteerEvent(eventId: ID): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase().from("volunteer_events").delete().eq("id", eventId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  mockVolunteerShifts
    .filter((s) => s.eventId === eventId)
    .map((s) => s.id)
    .forEach(mockRemoveShift);
  mockVolunteerNeeds
    .filter((n) => n.eventId === eventId)
    .map((n) => n.id)
    .forEach(mockRemoveNeed);
  const idx = mockVolunteerEvents.findIndex((e) => e.id === eventId);
  if (idx !== -1) mockVolunteerEvents.splice(idx, 1);
}

/**
 * Claim a slot — both paths. Signed-in users claim as themselves (the RPC
 * reads auth.uid()); anonymous guests pass name + email (phone optional).
 * Returns the signup's cancel token (drives the no-login cancel link).
 * `mockUser` is only used by mock mode to record who claimed.
 */
export async function claimVolunteerSlot(input: {
  needId: ID;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  mockUser?: { id: ID; name: string } | null;
}): Promise<string> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase().rpc("claim_volunteer_slot", {
      p_need_id: input.needId,
      p_guest_name: input.guestName ?? null,
      p_guest_email: input.guestEmail ?? null,
      p_guest_phone: input.guestPhone ?? null,
    });
    if (error) throw new Error(error.message);
    return data as string;
  }
  await delay(300);
  const need = mockVolunteerNeeds.find((n) => n.id === input.needId);
  if (!need) throw new Error("This volunteer need no longer exists.");
  if (isShiftPast(need)) {
    throw new Error("This shift has already happened — thank you anyway!");
  }
  const confirmed = mockVolunteerSignups.filter(
    (s) => s.needId === input.needId && s.status === "confirmed"
  );
  if (confirmed.length >= need.slots) {
    throw new Error("All slots for this shift are filled — thank you anyway!");
  }
  const user = input.mockUser ?? null;
  if (user) {
    if (confirmed.some((s) => s.userId === user.id)) {
      throw new Error("You already have a spot on this shift.");
    }
  } else {
    if (!input.guestName?.trim() || !input.guestEmail?.trim()) {
      throw new Error("Name and email are required to sign up.");
    }
    if (
      confirmed.some(
        (s) =>
          s.guestEmail?.toLowerCase() === input.guestEmail!.trim().toLowerCase()
      )
    ) {
      throw new Error("You already have a spot on this shift.");
    }
  }
  const id = `vs-${Date.now()}`;
  const token = `mock-token-${id}`;
  mockVolunteerSignups.push({
    id,
    needId: input.needId,
    userId: user?.id ?? null,
    name: user?.name ?? input.guestName!.trim(),
    guestEmail: user ? null : input.guestEmail!.trim().toLowerCase(),
    cancelToken: token,
    status: "confirmed",
  });
  return token;
}

/** Member one-tap unclaim — finds your own signup and cancels via its token. */
export async function unclaimVolunteerSlot(
  needId: string,
  userId: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("volunteer_signups")
      .select("cancel_token")
      .eq("need_id", needId)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("You don't have a spot on this shift.");
    const { error: rpcError } = await supabase.rpc("cancel_volunteer_signup", {
      p_cancel_token: data.cancel_token,
    });
    if (rpcError) throw new Error(rpcError.message);
    return;
  }
  await delay(200);
  const signup = mockVolunteerSignups.find(
    (s) => s.needId === needId && s.userId === userId && s.status === "confirmed"
  );
  if (!signup) throw new Error("You don't have a spot on this shift.");
  signup.status = "cancelled";
}

/* ── Public guest path — anonymous-safe reads via SECURITY DEFINER RPCs ── */

/** The public volunteer board: show header + needs with fill counts only. */
export async function getVolunteerBoard(
  showId: string
): Promise<VolunteerBoard | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase().rpc("get_volunteer_page", {
        p_show_id: showId,
      });
      if (error) throw error;
      return (data as VolunteerBoard | null) ?? null;
    } catch (e) {
      console.warn("getVolunteerBoard — RPC may not exist yet (paste migration 011):", e);
      return null;
    }
  }
  await delay();
  const show = mockShows.find((s) => s.id === showId);
  if (!show) return null;
  return {
    show: {
      id: show.id,
      title: show.title,
      orgName: show.orgName,
      posterUrl: show.posterUrl,
      city: show.city,
      state: show.state,
      showOpen: show.showOpen,
      showClose: show.showClose,
      performanceLocation: show.performanceLocation,
    },
    needs: mockVolunteerNeeds
      .filter((n) => n.showId === showId)
      .map((n) => ({
        id: n.id,
        label: n.label,
        eventDate: n.eventDate,
        startTime: n.startTime,
        endTime: n.endTime,
        slots: n.slots,
        notes: n.notes,
        filled: mockVolunteerSignups.filter(
          (s) => s.needId === n.id && s.status === "confirmed"
        ).length,
        eventId: n.eventId ?? null,
        shiftId: n.shiftId ?? null,
        roleLabel: n.roleLabel ?? null,
      })),
    events: mockVolunteerEvents
      .filter((e) => e.showId === showId)
      .map(mockEventToVolunteerEvent)
      .map(({ id, title, eventDate, location, notes, shifts }) => ({
        id,
        title,
        eventDate,
        location,
        notes,
        shifts,
      })),
  };
}

/** Shift details for the tokened cancel page. */
export async function getVolunteerShiftInfo(
  cancelToken: string
): Promise<VolunteerShiftInfo | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase().rpc(
        "get_volunteer_signup_info",
        { p_cancel_token: cancelToken }
      );
      if (error) throw error;
      return (data as VolunteerShiftInfo | null) ?? null;
    } catch (e) {
      console.warn("getVolunteerShiftInfo — RPC may not exist yet (paste migration 011):", e);
      return null;
    }
  }
  await delay();
  const signup = mockVolunteerSignups.find((s) => s.cancelToken === cancelToken);
  if (!signup) return null;
  const need = mockVolunteerNeeds.find((n) => n.id === signup.needId);
  if (!need) return null;
  const show = mockShows.find((s) => s.id === need.showId);
  return {
    status: signup.status,
    name: signup.name,
    label: need.label,
    eventDate: need.eventDate,
    startTime: need.startTime,
    endTime: need.endTime,
    showTitle: show?.title ?? "your show",
    orgName: show?.orgName ?? "",
  };
}

/** Tokened cancel — no login required. Returns false if already cancelled. */
export async function cancelVolunteerByToken(
  cancelToken: string
): Promise<boolean> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase().rpc("cancel_volunteer_signup", {
      p_cancel_token: cancelToken,
    });
    if (error) throw new Error(error.message);
    return !!data;
  }
  await delay(250);
  const signup = mockVolunteerSignups.find((s) => s.cancelToken === cancelToken);
  if (!signup || signup.status !== "confirmed") return false;
  signup.status = "cancelled";
  return true;
}
