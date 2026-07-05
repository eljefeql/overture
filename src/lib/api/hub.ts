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
  getCastAssignments,
  getShowConflicts,
} from "@/lib/api/client";
import { MAX_UPLOAD_BYTES } from "@/lib/api/photos";
import {
  rehearsals as mockRehearsals,
  rehearsalAbsences as mockAbsences,
  announcements as mockAnnouncements,
  commNorms as mockCommNorms,
} from "@/data/hub";
import { actors } from "@/data/actors";
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
  const castIds = acceptedCast.map((c) => c.actorId);
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
    storagePath: r.storage_path,
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
  return []; // Mock mode has no storage — the hub shows a cloud-only note.
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
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("show_files").delete().eq("id", file.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(SHOW_FILES_BUCKET).remove([file.storagePath]);
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
  ]);
  return {
    show,
    roles,
    team,
    cast: assignments.filter((a) => a.status === "accepted"),
    rehearsals: rehearsalList,
    absences,
    announcements: announcementList,
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
