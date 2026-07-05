/**
 * API Client — thin wrapper for mock data during MVP development.
 * When we connect to Supabase, this becomes the real fetch layer.
 * All components use these functions, so the swap is seamless.
 */

import { shows, allShowRoles, showTeam, auditionGroups, orgs, orgMembers, castAssignments, venues as mockVenues, orgLeadership as mockOrgLeadership, orgPastProductions as mockPastProductions } from "@/data/shows";
import { actors, auditionSignups, teamNotes, callbacks } from "@/data/actors";
import type {
  Show,
  ShowRole,
  ShowTeamMember,
  AuditionGroup,
  AuditionSignup,
  ActorWithProfile,
  ActorProfile,
  ProductionCredit,
  CrewCredit,
  Training,
  Award,
  TeamNote,
  Callback,
  CastAssignment,
  Org,
  OrgMember,
  OrgRole,
  TeamRole,
  User,
  SignupStatus,
  CallbackStatus,
  OfferStatus,
  ConflictRange,
  ShowConflictEntry,
  Venue,
  OrgLeader,
  OrgPhoto,
  OrgPastProduction,
  NotificationPrefs,
} from "@/types";
import { DEFAULT_NOTIFICATION_PREFS } from "@/types";

// Simulate network delay
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// SUPABASE (incremental migration)
// Org/show reads go to the real database when configured;
// everything else still uses the mock layer below.
// ============================================================
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToOrg(r: any): Org {
  return {
    id: r.id, name: r.name, slug: r.slug, logoUrl: r.logo_url,
    description: r.description, city: r.city, state: r.state,
    websiteUrl: r.website_url, codeOfConduct: r.code_of_conduct,
    foundedYear: r.founded_year ?? null, mission: r.mission ?? null,
    facebookUrl: r.facebook_url ?? null, instagramUrl: r.instagram_url ?? null,
    ticketingUrl: r.ticketing_url ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function rowToShow(r: any): Show {
  return {
    id: r.id, orgId: r.org_id, orgName: r.orgs?.name ?? "",
    title: r.title, authorInfo: r.author_info, showType: r.show_type,
    season: r.season, status: r.status,
    auditionStart: r.audition_start, auditionEnd: r.audition_end,
    callbackDate: r.callback_date, callbackStartTime: r.callback_start_time,
    callbackEndTime: r.callback_end_time, rehearsalStart: r.rehearsal_start,
    showOpen: r.show_open, showClose: r.show_close,
    auditionLocation: r.audition_location, auditionNotes: r.audition_notes,
    callbackLocation: r.callback_location, callbackNotes: r.callback_notes,
    performanceLocation: r.performance_location,
    callbackContactName: r.callback_contact_name,
    callbackContactPhone: r.callback_contact_phone,
    posterUrl: r.poster_url ?? null,
    city: r.city, state: r.state,
    distanceMiles: null, // computed client-side once geo lands
    isPromoted: r.is_promoted,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToCredit(r: any): ProductionCredit {
  const kudosRow = Array.isArray(r.kudos) ? r.kudos[0] : r.kudos;
  return {
    id: r.id,
    showTitle: r.show_title,
    roleName: r.role_name,
    theatreName: r.theatre_name,
    year: r.year,
    verified: r.verified,
    orgId: r.org_id,
    likeCount: r.like_count ?? 0,
    kudos: kudosRow
      ? {
          authorName: kudosRow.profiles?.display_name ?? "Production Team",
          authorRole: "Production Team",
          quote: kudosRow.quote,
        }
      : null,
  };
}

function rowToCrewCredit(r: any): CrewCredit {
  return {
    id: r.id,
    position: r.role_name,
    showTitle: r.show_title,
    theatreName: r.theatre_name,
    year: r.year,
    verified: r.verified,
    orgId: r.org_id,
  };
}

function rowToMeasurements(r: any) {
  return {
    headInches: r.head_inches,
    neckInches: r.neck_inches,
    shouldersInches: r.shoulders_inches,
    chestInches: r.chest_inches,
    underbustInches: r.underbust_inches,
    waistInches: r.waist_inches,
    hipsInches: r.hips_inches,
    inseamInches: r.inseam_inches,
    outseamInches: r.outseam_inches,
    sleeveInches: r.sleeve_inches,
    riseInches: r.rise_inches,
    shoeSize: r.shoe_size,
    hatSize: r.hat_size,
    jacketDressSize: r.jacket_dress_size,
  };
}

const CREDIT_SELECT = "*, kudos(quote, profiles:author_id(display_name))";

const SIGNUP_SELECT = "*, profiles:actor_id(display_name, avatar_url, pronouns)";
const CALLBACK_SELECT = "*, show_roles:role_id(name), profiles:actor_id(display_name)";
const CAST_SELECT = "*, show_roles:role_id(name), profiles:actor_id(display_name)";

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToSignup(r: any): AuditionSignup {
  return {
    id: r.id,
    showId: r.show_id,
    actorId: r.actor_id,
    actorName: r.profiles?.display_name ?? "",
    actorAvatarUrl: r.profiles?.avatar_url ?? null,
    actorPronouns: r.profiles?.pronouns ?? null,
    groupId: r.group_id,
    slotPosition: r.slot_position,
    rolesInterested: r.roles_interested ?? [],
    openToOther: r.open_to_other,
    willCrew: r.will_crew,
    conflicts: r.conflicts,
    status: r.status,
    signedUpAt: r.signed_up_at,
  };
}

function rowToCallback(r: any, opts?: { actorFacing?: boolean }): Callback {
  return {
    id: r.id,
    showId: r.show_id,
    actorId: r.actor_id,
    actorName: r.profiles?.display_name ?? "",
    roleId: r.role_id,
    roleName: r.show_roles?.name ?? "",
    // To the actor, "notified" just means "awaiting your response" — the
    // pending/notified split only matters on the production side.
    status: opts?.actorFacing && r.status === "notified" ? "pending" : r.status,
    notifiedAt: r.notified_at,
    respondedAt: r.responded_at,
    prepNotes: r.prep_notes,
  };
}

function rowToCastAssignment(r: any): CastAssignment {
  return {
    id: r.id,
    showId: r.show_id,
    roleId: r.role_id,
    roleName: r.show_roles?.name ?? "",
    actorId: r.actor_id,
    actorName: r.profiles?.display_name ?? "",
    assignmentType: r.assignment_type,
    status: r.status,
    sortOrder: r.sort_order,
  };
}

/**
 * Create a notification row via the create_notification RPC (migration 005).
 * Best-effort: a failed notification must never fail the mutation that
 * triggered it, so errors are logged and swallowed.
 */
async function pushNotification(input: {
  recipientId: string;
  showId: string;
  type: "callback" | "cast" | "system";
  title: string;
  body: string;
  showTitle: string | null;
  linkUrl: string | null;
}): Promise<void> {
  try {
    const { error } = await getSupabase().rpc("create_notification", {
      p_recipient_id: input.recipientId,
      p_show_id: input.showId,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body,
      p_show_title: input.showTitle,
      p_link_url: input.linkUrl,
    });
    if (error) console.warn("Notification not created:", error.message);
  } catch (e) {
    console.warn("Notification not created:", e);
  }
}

/** Show title lookup for notification copy (best-effort). */
async function getShowTitle(showId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("shows").select("title").eq("id", showId).maybeSingle();
  return data?.title ?? null;
}

/**
 * Team members of a show who have user accounts, preferring those whose
 * role title contains "director". Used to notify the right people when an
 * actor responds to a cast offer.
 */
async function getShowDirectorUserIds(showId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("show_team_members")
    .select("user_id, show_team_roles(role_title)")
    .eq("show_id", showId)
    .not("user_id", "is", null);
  if (error || !data) return [];
  const directors = data.filter((m: any) =>
    (m.show_team_roles ?? []).some((r: any) =>
      (r.role_title ?? "").toLowerCase().includes("director")
    )
  );
  return (directors.length > 0 ? directors : data).map((m: any) => m.user_id);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function getActorFromSupabase(userId: string): Promise<ActorWithProfile | null> {
  const supabase = getSupabase();
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles").select("*").eq("id", userId).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profileRow) return null;

  const [details, measurements, bucketList, trainingRows, awardRows, creditRows, endorsementRows] =
    await Promise.all([
      supabase.from("actor_details").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("actor_measurements").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("bucket_list_shows").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("training").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("awards").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("production_credits").select(CREDIT_SELECT).eq("user_id", userId)
        .order("year", { ascending: false }),
      supabase.from("endorsements")
        .select("*, endorser:profiles!endorsements_endorser_id_fkey(display_name)")
        .eq("actor_id", userId),
    ]);
  for (const res of [details, measurements, bucketList, trainingRows, awardRows, creditRows, endorsementRows]) {
    if (res.error) throw new Error(res.error.message);
  }

  const d: any = details.data;
  const profile: ActorProfile | null = d
    ? {
        userId,
        bio: profileRow.bio ?? "",
        heightInches: d.height_inches ? Number(d.height_inches) : null,
        vocalRange: d.vocal_range,
        danceStyles: d.dance_styles ?? [],
        specialSkills: d.special_skills ?? [],
        ageRangeLow: d.age_range_low,
        ageRangeHigh: d.age_range_high,
        locationCity: profileRow.location_city,
        locationState: profileRow.location_state,
        travelRadius: profileRow.travel_radius,
        isAvailable: profileRow.is_available,
        resumePdfUrl: d.resume_pdf_url,
        isMinor: d.is_minor,
        guardianName: d.guardian_name,
        guardianEmail: d.guardian_email,
        guardianPhone: d.guardian_phone,
        phone: profileRow.phone,
        appearanceDescription: d.appearance_description,
        bucketListShows: (bucketList.data ?? []).map((b: any) => ({
          title: b.title,
          role: b.role,
        })),
        accessibilityNeeds: d.accessibility_needs,
        dealbreakers: d.dealbreakers ?? [],
        measurements: measurements.data ? rowToMeasurements(measurements.data) : null,
        training: (trainingRows.data ?? []).map((t: any) => ({
          id: t.id, institution: t.institution, description: t.description, years: t.years,
        })),
        awards: (awardRows.data ?? []).map((a: any) => ({
          id: a.id, title: a.title, organization: a.organization, year: a.year,
        })),
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }
    : null;

  const allCredits = creditRows.data ?? [];
  return {
    id: profileRow.id,
    email: profileRow.email,
    displayName: profileRow.display_name ?? "",
    avatarUrl: profileRow.avatar_url,
    pronouns: profileRow.pronouns,
    onboardingStep: profileRow.onboarding_step ?? "role_select",
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at,
    profile,
    credits: allCredits.filter((c: any) => c.credit_type === "performer").map(rowToCredit),
    crewCredits: allCredits.filter((c: any) => c.credit_type !== "performer").map(rowToCrewCredit),
    endorsements: (endorsementRows.data ?? []).map((e: any) => ({
      id: e.id,
      actorId: e.actor_id,
      endorserId: e.endorser_id,
      endorserName: e.endorser?.display_name ?? "",
      endorserRole: "Production Team",
      label: e.label,
      showTitle: e.show_title,
      createdAt: e.created_at,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const SHOW_SELECT = "*, orgs(name)";

// ============================================================
// ORG IDENTITY (cloud) — who does this user produce for?
// ============================================================

/** show_team_roles.department default for each TS TeamRole enum value. */
const TEAM_ROLE_DEPARTMENT: Record<TeamRole, string> = {
  director: "creative",
  music_director: "music",
  choreographer: "creative",
  stage_manager: "stage_management",
  producer: "production",
  asst_director: "creative",
  asst_stage_manager: "stage_management",
  accompanist: "music",
};

const TEAM_SELECT =
  "*, show_team_roles(role_title, department, sort_order), profiles:user_id(display_name, email, phone)";

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToTeamMember(r: any): ShowTeamMember {
  const roles = [...(r.show_team_roles ?? [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  return {
    id: r.id,
    showId: r.show_id,
    userId: r.user_id ?? `guest-${r.id}`,
    userName: r.profiles?.display_name ?? r.guest_name ?? "",
    role: (roles[0]?.role_title ?? "director") as TeamRole,
    canEvaluate: r.can_evaluate,
    email: r.profiles?.email ?? r.guest_email ?? null,
    phone: r.profiles?.phone ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type OrgMembershipInfo = { org: Org; role: OrgRole };

/**
 * The user's theatre — first active org membership joined to its org.
 * Mock mode resolves to org-1 (owner) so the demo personas keep working.
 */
export async function getMyOrgMembership(
  userId: string
): Promise<OrgMembershipInfo | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("org_members")
      .select("role, joined_at, orgs(*)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.orgs) return null;
    return { org: rowToOrg(data.orgs), role: data.role as OrgRole };
  }
  await delay();
  const membership = orgMembers.find(
    (m) => m.userId === userId && m.status === "active"
  );
  const org = orgs.find((o) => o.id === (membership?.orgId ?? "org-1"));
  return org ? { org, role: membership?.role ?? "owner" } : null;
}

/**
 * Can this user work on this show's production pages?
 * True when they're on the show team OR an owner/admin of the show's org.
 * Mock mode always allows (no membership data to check).
 */
export async function getShowAccess(
  showId: string,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const supabase = getSupabase();
  const [{ data: teamRow }, { data: showRow }] = await Promise.all([
    supabase
      .from("show_team_members")
      .select("id")
      .eq("show_id", showId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("shows").select("org_id").eq("id", showId).maybeSingle(),
  ]);
  if (teamRow) return true;
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

/**
 * Claim any pending org invites matching the signed-in user's email via the
 * claim_org_invites SECURITY DEFINER RPC (migration 006). Creates org_members
 * rows, marks invites accepted, and notifies the inviter — all server-side.
 * Best-effort: never throws (a missing migration just logs a warning).
 */
export async function claimPendingInvites(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  // Same email-match moment: attach any guest volunteer signups made with
  // this email before the account existed (claim_volunteer_signups RPC,
  // migration 011). Best-effort — never blocks the invite claim.
  try {
    const { error } = await getSupabase().rpc("claim_volunteer_signups");
    if (error) console.warn("Volunteer signup auto-link skipped:", error.message);
  } catch (e) {
    console.warn("Volunteer signup auto-link skipped:", e);
  }

  try {
    const { data, error } = await getSupabase().rpc("claim_org_invites");
    if (error) {
      console.warn("Org invite claim skipped:", error.message);
      return 0;
    }
    return data ?? 0;
  } catch (e) {
    console.warn("Org invite claim skipped:", e);
    return 0;
  }
}

// ============================================================
// SHOWS
// ============================================================

export async function getShows(filters?: {
  status?: string;
  orgId?: string;
}): Promise<Show[]> {
  if (isSupabaseConfigured) {
    let q = getSupabase().from("shows").select(SHOW_SELECT);
    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.orgId) q = q.eq("org_id", filters.orgId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToShow);
  }
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("shows").select(SHOW_SELECT).eq("id", showId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToShow(data) : null;
  }
  await delay();
  const show = shows.find((s) => s.id === showId);
  return show ? { ...show } : null;
}

export async function getShowRoles(showId: string): Promise<ShowRole[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("show_roles").select("*").eq("show_id", showId).order("sort_order");
    if (error) throw new Error(error.message);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return (data ?? []).map((r: any) => ({
      id: r.id, showId: r.show_id, name: r.name, roleType: r.role_type,
      gender: r.gender, ageRange: r.age_range, vocalRange: r.vocal_range,
      description: r.description, sortOrder: r.sort_order,
    }));
  }
  await delay();
  return allShowRoles[showId] ?? [];
}

export async function getShowTeam(showId: string): Promise<ShowTeamMember[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("show_team_members")
      .select(TEAM_SELECT)
      .eq("show_id", showId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToTeamMember);
  }
  await delay();
  return showTeam.filter((t) => t.showId === showId);
}

export async function getOrg(orgId: string): Promise<Org | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("orgs").select("*").eq("id", orgId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToOrg(data) : null;
  }
  await delay();
  return orgs.find((o) => o.id === orgId) ?? null;
}

export async function updateOrg(
  orgId: string,
  updates: Partial<Pick<Org, "name" | "description" | "city" | "state" | "websiteUrl" | "codeOfConduct" | "foundedYear" | "mission" | "facebookUrl" | "instagramUrl" | "ticketingUrl" | "logoUrl">>
): Promise<Org> {
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.logoUrl !== undefined) row.logo_url = updates.logoUrl;
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.city !== undefined) row.city = updates.city;
    if (updates.state !== undefined) row.state = updates.state;
    if (updates.websiteUrl !== undefined) row.website_url = updates.websiteUrl;
    if (updates.codeOfConduct !== undefined) row.code_of_conduct = updates.codeOfConduct;
    if (updates.foundedYear !== undefined) row.founded_year = updates.foundedYear;
    if (updates.mission !== undefined) row.mission = updates.mission;
    if (updates.facebookUrl !== undefined) row.facebook_url = updates.facebookUrl;
    if (updates.instagramUrl !== undefined) row.instagram_url = updates.instagramUrl;
    if (updates.ticketingUrl !== undefined) row.ticketing_url = updates.ticketingUrl;
    const { data, error } = await getSupabase()
      .from("orgs").update(row).eq("id", orgId).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    // RLS: only the org owner can update — a blocked update comes back empty.
    if (!data) throw new Error("Only the theatre owner can edit these details.");
    return rowToOrg(data);
  }
  await delay(300);
  const org = orgs.find((o) => o.id === orgId);
  if (!org) throw new Error("Theatre not found.");
  Object.assign(org, updates, { updatedAt: new Date().toISOString() });
  return org;
}

// ============================================================
// THEATRE PROFILE DEPTH — VENUES / LEADERSHIP / PHOTOS
// (Sprint D Phase 2 — migration 007 / PASTE_ME_NEXT.sql)
// Cloud reads of these new tables are wrapped so that, before the migration
// is pasted, a missing-table error degrades to an empty list rather than
// throwing and crashing the public theatre page.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToVenue(r: any): Venue {
  return {
    id: r.id, orgId: r.org_id, name: r.name, address: r.address ?? null,
    capacity: r.capacity ?? null, accessibilityNotes: r.accessibility_notes ?? null,
    parkingNotes: r.parking_notes ?? null, isPrimary: !!r.is_primary,
    spaceType: (r.space_type ?? "performance") as Venue["spaceType"],
    sortOrder: r.sort_order ?? 0, createdAt: r.created_at,
  };
}

function rowToOrgLeader(r: any): OrgLeader {
  return {
    id: r.id, orgId: r.org_id, name: r.name, title: r.title ?? null,
    photoUrl: r.photo_url ?? null, sortOrder: r.sort_order ?? 0, createdAt: r.created_at,
  };
}

function rowToOrgPhoto(r: any): OrgPhoto {
  return {
    id: r.id, orgId: r.org_id, storagePath: r.storage_path,
    caption: r.caption ?? null, kind: r.kind, sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at,
    publicUrl: getSupabase().storage.from("org-media").getPublicUrl(r.storage_path).data.publicUrl,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ORG_MEDIA_BUCKET = "org-media";

// ── Venues ──────────────────────────────────────────────────

export async function getVenues(orgId: string): Promise<Venue[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("venues").select("*").eq("org_id", orgId)
        .order("is_primary", { ascending: false }).order("sort_order");
      if (error) throw error;
      return (data ?? []).map(rowToVenue);
    } catch (e) {
      console.warn("getVenues — table may not exist yet (paste migration 007):", e);
      return [];
    }
  }
  await delay();
  return mockVenues
    .filter((v) => v.orgId === orgId)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
}

export async function createVenue(
  orgId: string,
  data: Omit<Venue, "id" | "orgId" | "createdAt" | "sortOrder">
): Promise<Venue> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    // Only one primary per org.
    if (data.isPrimary) {
      await supabase.from("venues").update({ is_primary: false }).eq("org_id", orgId);
    }
    const { count } = await supabase
      .from("venues").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    const { data: row, error } = await supabase
      .from("venues")
      .insert({
        org_id: orgId, name: data.name, address: data.address,
        capacity: data.capacity, accessibility_notes: data.accessibilityNotes,
        parking_notes: data.parkingNotes, is_primary: data.isPrimary,
        space_type: data.spaceType, sort_order: count ?? 0,
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    return rowToVenue(row);
  }
  await delay(300);
  if (data.isPrimary) {
    for (const v of mockVenues) if (v.orgId === orgId) v.isPrimary = false;
  }
  const venue: Venue = {
    id: `venue-${Date.now()}`,
    orgId,
    sortOrder: mockVenues.filter((v) => v.orgId === orgId).length,
    createdAt: new Date().toISOString(),
    ...data,
  };
  mockVenues.push(venue);
  return venue;
}

export async function updateVenue(
  venueId: string,
  orgId: string,
  data: Partial<Omit<Venue, "id" | "orgId" | "createdAt" | "sortOrder">>
): Promise<Venue> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    if (data.isPrimary) {
      await supabase.from("venues").update({ is_primary: false }).eq("org_id", orgId).neq("id", venueId);
    }
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.address !== undefined) row.address = data.address;
    if (data.capacity !== undefined) row.capacity = data.capacity;
    if (data.accessibilityNotes !== undefined) row.accessibility_notes = data.accessibilityNotes;
    if (data.parkingNotes !== undefined) row.parking_notes = data.parkingNotes;
    if (data.isPrimary !== undefined) row.is_primary = data.isPrimary;
    if (data.spaceType !== undefined) row.space_type = data.spaceType;
    const { data: updated, error } = await supabase
      .from("venues").update(row).eq("id", venueId).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Only the theatre's owner or admins can edit venues.");
    return rowToVenue(updated);
  }
  await delay(200);
  const venue = mockVenues.find((v) => v.id === venueId);
  if (!venue) throw new Error("Venue not found.");
  if (data.isPrimary) {
    for (const v of mockVenues) if (v.orgId === orgId) v.isPrimary = false;
  }
  Object.assign(venue, data);
  return venue;
}

export async function deleteVenue(venueId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase().from("venues").delete().eq("id", venueId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = mockVenues.findIndex((v) => v.id === venueId);
  if (idx !== -1) mockVenues.splice(idx, 1);
}

// ── Leadership (key people) ─────────────────────────────────

export async function getOrgLeadership(orgId: string): Promise<OrgLeader[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("org_leadership").select("*").eq("org_id", orgId).order("sort_order");
      if (error) throw error;
      return (data ?? []).map(rowToOrgLeader);
    } catch (e) {
      console.warn("getOrgLeadership — table may not exist yet (paste migration 007):", e);
      return [];
    }
  }
  await delay();
  return mockOrgLeadership
    .filter((l) => l.orgId === orgId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createOrgLeader(
  orgId: string,
  data: { name: string; title: string | null; photoUrl: string | null }
): Promise<OrgLeader> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { count } = await supabase
      .from("org_leadership").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    const { data: row, error } = await supabase
      .from("org_leadership")
      .insert({ org_id: orgId, name: data.name, title: data.title, photo_url: data.photoUrl, sort_order: count ?? 0 })
      .select("*").single();
    if (error) throw new Error(error.message);
    return rowToOrgLeader(row);
  }
  await delay(300);
  const leader: OrgLeader = {
    id: `leader-${Date.now()}`,
    orgId,
    name: data.name,
    title: data.title,
    photoUrl: data.photoUrl,
    sortOrder: mockOrgLeadership.filter((l) => l.orgId === orgId).length,
    createdAt: new Date().toISOString(),
  };
  mockOrgLeadership.push(leader);
  return leader;
}

export async function updateOrgLeader(
  leaderId: string,
  data: Partial<{ name: string; title: string | null; photoUrl: string | null }>
): Promise<OrgLeader> {
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.title !== undefined) row.title = data.title;
    if (data.photoUrl !== undefined) row.photo_url = data.photoUrl;
    const { data: updated, error } = await getSupabase()
      .from("org_leadership").update(row).eq("id", leaderId).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Only the theatre's owner or admins can edit leadership.");
    return rowToOrgLeader(updated);
  }
  await delay(200);
  const leader = mockOrgLeadership.find((l) => l.id === leaderId);
  if (!leader) throw new Error("Leader not found.");
  Object.assign(leader, data);
  return leader;
}

export async function deleteOrgLeader(leaderId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase().from("org_leadership").delete().eq("id", leaderId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = mockOrgLeadership.findIndex((l) => l.id === leaderId);
  if (idx !== -1) mockOrgLeadership.splice(idx, 1);
}

// ── Photos (venue + production gallery) ─────────────────────

export async function getOrgPhotos(orgId: string): Promise<OrgPhoto[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("org_photos").select("*").eq("org_id", orgId)
        .order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []).map(rowToOrgPhoto);
    } catch (e) {
      console.warn("getOrgPhotos — table may not exist yet (paste migration 007):", e);
      return [];
    }
  }
  await delay();
  // Mock mode has no storage, but a couple of placeholder photos let the public
  // gallery + lightbox be demonstrated locally for org-1.
  if (orgId === "org-1") {
    return [
      {
        id: "ophoto-1", orgId, storagePath: "mock/1",
        caption: "The Riverside Playhouse main stage", kind: "venue",
        sortOrder: 0, createdAt: "2024-02-01T00:00:00Z",
        publicUrl: "https://picsum.photos/seed/overture-venue/900/900",
      },
      {
        id: "ophoto-2", orgId, storagePath: "mock/2",
        caption: "Into the Woods, 2024 — Act I finale", kind: "production",
        sortOrder: 1, createdAt: "2024-02-01T00:00:00Z",
        publicUrl: "https://picsum.photos/seed/overture-prod1/900/900",
      },
      {
        id: "ophoto-3", orgId, storagePath: "mock/3",
        caption: "The Black Box studio", kind: "venue",
        sortOrder: 2, createdAt: "2024-02-01T00:00:00Z",
        publicUrl: "https://picsum.photos/seed/overture-venue2/900/900",
      },
    ];
  }
  return []; // No real mock photos for other orgs (no files to serve in mock mode).
}

/**
 * Upload an org photo to the public 'org-media' bucket (path `${orgId}/...`)
 * and record its metadata. Cloud-only — the hub keeps a "Coming soon in cloud"
 * note in mock mode since there's no storage to write to.
 */
export async function addOrgPhoto(
  orgId: string,
  file: File,
  data: { kind: "venue" | "production"; caption: string | null }
): Promise<OrgPhoto> {
  if (!isSupabaseConfigured) {
    throw new Error("Photo uploads are available once your theatre is on the cloud.");
  }
  const supabase = getSupabase();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${orgId}/${data.kind}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(ORG_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const { count } = await supabase
    .from("org_photos").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  const { data: row, error } = await supabase
    .from("org_photos")
    .insert({ org_id: orgId, storage_path: path, kind: data.kind, caption: data.caption, sort_order: count ?? 0 })
    .select("*").single();
  if (error) throw new Error(error.message);
  return rowToOrgPhoto(row);
}

export async function deleteOrgPhoto(photo: OrgPhoto): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("org_photos").delete().eq("id", photo.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(ORG_MEDIA_BUCKET).remove([photo.storagePath]);
}

/** Edit an org photo's caption and/or kind label (cloud-only). */
export async function updateOrgPhotoMeta(
  photoId: string,
  data: Partial<{ caption: string | null; kind: "venue" | "production" }>
): Promise<OrgPhoto> {
  if (!isSupabaseConfigured) {
    throw new Error("Photo editing is available once your theatre is on the cloud.");
  }
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row: Record<string, any> = {};
  if (data.caption !== undefined) row.caption = data.caption;
  if (data.kind !== undefined) row.kind = data.kind;
  const { data: updated, error } = await getSupabase()
    .from("org_photos").update(row).eq("id", photoId).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Only the theatre's owner or admins can edit photos.");
  return rowToOrgPhoto(updated);
}

// ── Past Productions (manual history — Build A) ─────────────

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function rowToPastProduction(r: any): OrgPastProduction {
  return {
    id: r.id, orgId: r.org_id, title: r.title, year: r.year ?? null,
    notes: r.notes ?? null, sortOrder: r.sort_order ?? 0, createdAt: r.created_at,
  };
}

export async function getOrgPastProductions(orgId: string): Promise<OrgPastProduction[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("org_past_productions").select("*").eq("org_id", orgId)
        .order("year", { ascending: false, nullsFirst: false }).order("sort_order");
      if (error) throw error;
      return (data ?? []).map(rowToPastProduction);
    } catch (e) {
      console.warn("getOrgPastProductions — table may not exist yet (paste PASTE_ME_NEXT.sql):", e);
      return [];
    }
  }
  await delay();
  return mockPastProductions
    .filter((p) => p.orgId === orgId)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.sortOrder - b.sortOrder);
}

export async function createOrgPastProduction(
  orgId: string,
  data: { title: string; year: number | null; notes: string | null }
): Promise<OrgPastProduction> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { count } = await supabase
      .from("org_past_productions").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    const { data: row, error } = await supabase
      .from("org_past_productions")
      .insert({ org_id: orgId, title: data.title, year: data.year, notes: data.notes, sort_order: count ?? 0 })
      .select("*").single();
    if (error) throw new Error(error.message);
    return rowToPastProduction(row);
  }
  await delay(300);
  const entry: OrgPastProduction = {
    id: `opp-${Date.now()}`,
    orgId,
    title: data.title,
    year: data.year,
    notes: data.notes,
    sortOrder: mockPastProductions.filter((p) => p.orgId === orgId).length,
    createdAt: new Date().toISOString(),
  };
  mockPastProductions.push(entry);
  return entry;
}

export async function updateOrgPastProduction(
  id: string,
  data: Partial<{ title: string; year: number | null; notes: string | null }>
): Promise<OrgPastProduction> {
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (data.title !== undefined) row.title = data.title;
    if (data.year !== undefined) row.year = data.year;
    if (data.notes !== undefined) row.notes = data.notes;
    const { data: updated, error } = await getSupabase()
      .from("org_past_productions").update(row).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Only the theatre's owner or admins can edit past productions.");
    return rowToPastProduction(updated);
  }
  await delay(200);
  const entry = mockPastProductions.find((p) => p.id === id);
  if (!entry) throw new Error("Past production not found.");
  Object.assign(entry, data);
  return entry;
}

export async function deleteOrgPastProduction(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase().from("org_past_productions").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = mockPastProductions.findIndex((p) => p.id === id);
  if (idx !== -1) mockPastProductions.splice(idx, 1);
}

// ============================================================
// ORG MEMBERS (theatre-level membership)
// ============================================================

// Pending org_invites surface in the members list with this id prefix so the
// role/remove mutations can route to the invites table instead.
const INVITE_ID_PREFIX = "invite:";

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from("org_members")
        .select("*, profiles:user_id(display_name, email)")
        .eq("org_id", orgId),
      // RLS limits invite rows to org admins — others just see none.
      supabase
        .from("org_invites")
        .select("*")
        .eq("org_id", orgId)
        .eq("status", "pending"),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (invitesRes.error) throw new Error(invitesRes.error.message);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const members: OrgMember[] = (membersRes.data ?? []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      name: r.profiles?.display_name ?? "",
      email: r.profiles?.email ?? "",
      role: r.role,
      status: "active",
      invitedAt: r.joined_at,
      joinedAt: r.joined_at,
    }));
    const invites: OrgMember[] = (invitesRes.data ?? []).map((r: any) => ({
      id: `${INVITE_ID_PREFIX}${r.id}`,
      orgId: r.org_id,
      userId: null,
      name: r.email.split("@")[0],
      email: r.email,
      role: r.role,
      status: "invited",
      invitedAt: r.created_at,
      joinedAt: null,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const rank = { owner: 0, admin: 1, member: 2 };
    return [...members, ...invites].sort((a, b) => rank[a.role] - rank[b.role]);
  }
  await delay();
  return orgMembers
    .filter((m) => m.orgId === orgId)
    .sort((a, b) => {
      const rank = { owner: 0, admin: 1, member: 2 };
      return rank[a.role] - rank[b.role];
    });
}

/**
 * Invite someone to the theatre.
 * Cloud: inserts an org_invites row; if the email already belongs to an
 * Overture account they also get an in-app notification (RPC, migration 006).
 * Acceptance happens automatically at their next sign-in (claimPendingInvites).
 * Mock: creates a pending membership record.
 */
export async function inviteOrgMember(
  orgId: string,
  data: { name: string; email: string; role: OrgMember["role"] }
): Promise<OrgMember> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const email = data.email.trim().toLowerCase();

    const [{ data: profileRow }, { data: pendingInvite, error: inviteCheckError }] =
      await Promise.all([
        supabase.from("profiles").select("id").ilike("email", email).maybeSingle(),
        supabase
          .from("org_invites").select("id")
          .eq("org_id", orgId).ilike("email", email).eq("status", "pending")
          .maybeSingle(),
      ]);
    if (inviteCheckError) throw new Error(inviteCheckError.message);
    if (pendingInvite) throw new Error("That email already has a pending invite.");
    if (profileRow) {
      const { data: existingMember } = await supabase
        .from("org_members").select("id")
        .eq("org_id", orgId).eq("user_id", profileRow.id).maybeSingle();
      if (existingMember) throw new Error("That person is already a member of this theatre.");
    }

    const { data: authData } = await supabase.auth.getUser();
    const { data: invite, error } = await supabase
      .from("org_invites")
      .insert({
        org_id: orgId,
        email,
        role: data.role,
        invited_by: authData.user?.id,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Existing Overture user? Tell them in-app (best-effort; RPC in 006).
    if (profileRow) {
      const { error: notifyError } = await supabase.rpc("notify_org_invite", {
        p_invite_id: invite.id,
      });
      if (notifyError) console.warn("Invite notification not created:", notifyError.message);
    }

    return {
      id: `${INVITE_ID_PREFIX}${invite.id}`,
      orgId,
      userId: null,
      name: data.name.trim() || email.split("@")[0],
      email,
      role: invite.role,
      status: "invited",
      invitedAt: invite.created_at,
      joinedAt: null,
    };
  }
  await delay(400);
  const existing = orgMembers.find(
    (m) => m.orgId === orgId && m.email.toLowerCase() === data.email.toLowerCase()
  );
  if (existing) throw new Error("That email is already a member or has a pending invite.");
  const member: OrgMember = {
    id: `om-${Date.now()}`,
    orgId,
    userId: null,
    name: data.name.trim(),
    email: data.email.trim(),
    role: data.role,
    status: "invited",
    invitedAt: new Date().toISOString(),
    joinedAt: null,
  };
  orgMembers.push(member);
  return member;
}

export async function updateOrgMemberRole(
  memberId: string,
  role: OrgMember["role"]
): Promise<OrgMember | null> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    if (memberId.startsWith(INVITE_ID_PREFIX)) {
      const inviteId = memberId.slice(INVITE_ID_PREFIX.length);
      const { data, error } = await supabase
        .from("org_invites").update({ role }).eq("id", inviteId).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("You don't have permission to change this invite.");
      return null;
    }
    const { data, error } = await supabase
      .from("org_members")
      .update({ role })
      .eq("id", memberId)
      .neq("role", "owner")
      .select("id");
    if (error) throw new Error(error.message);
    // RLS: only the org owner can change roles — a blocked update is empty.
    if (!data?.length) throw new Error("Only the theatre owner can change member roles.");
    return null;
  }
  await delay(200);
  const member = orgMembers.find((m) => m.id === memberId);
  if (!member) throw new Error("Member not found.");
  if (member.role === "owner") throw new Error("The owner's role can't be changed here.");
  member.role = role;
  return member;
}

export async function removeOrgMember(memberId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    if (memberId.startsWith(INVITE_ID_PREFIX)) {
      // "Removing" a pending invite revokes it.
      const inviteId = memberId.slice(INVITE_ID_PREFIX.length);
      const { data, error } = await supabase
        .from("org_invites").update({ status: "expired" }).eq("id", inviteId).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("You don't have permission to revoke this invite.");
      return;
    }
    const { data, error } = await supabase
      .from("org_members")
      .delete()
      .eq("id", memberId)
      .neq("role", "owner")
      .select("id");
    if (error) throw new Error(error.message);
    // Needs the admin-remove policy from migration 006.
    if (!data?.length) throw new Error("You don't have permission to remove this member.");
    return;
  }
  await delay(200);
  const member = orgMembers.find((m) => m.id === memberId);
  if (!member) throw new Error("Member not found.");
  if (member.role === "owner") throw new Error("The owner can't be removed.");
  const idx = orgMembers.findIndex((m) => m.id === memberId);
  orgMembers.splice(idx, 1);
}

// ============================================================
// AUDITIONS
// ============================================================

export async function getAuditionGroups(
  showId: string
): Promise<AuditionGroup[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("audition_groups").select("*").eq("show_id", showId).order("sort_order");
    if (error) throw new Error(error.message);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return (data ?? []).map((r: any) => ({
      id: r.id, showId: r.show_id, name: r.name, startTime: r.start_time,
      endTime: r.end_time, slotCount: r.slot_count, sortOrder: r.sort_order,
    }));
  }
  await delay();
  return auditionGroups
    .filter((g) => g.showId === showId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getAuditionSignups(
  showId: string
): Promise<AuditionSignup[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("audition_signups").select(SIGNUP_SELECT)
      .eq("show_id", showId).neq("status", "withdrawn");
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToSignup);
  }
  await delay();
  return auditionSignups.filter((s) => s.showId === showId);
}

/**
 * Conflict Calendar read model — every non-withdrawn signup for a show with
 * its structured conflict ranges (signup_conflicts, migration 009), actor
 * name/email, and signup status. Cloud reads are try/catch-wrapped → [] until
 * PASTE_ME_NEXT.sql is pasted.
 */
export async function getShowConflicts(
  showId: string
): Promise<ShowConflictEntry[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("audition_signups")
        .select(
          "id, actor_id, status, profiles:actor_id(display_name, email), signup_conflicts(start_date, end_date)"
        )
        .eq("show_id", showId)
        .neq("status", "withdrawn");
      if (error) throw new Error(error.message);
      /* eslint-disable @typescript-eslint/no-explicit-any */
      return (data ?? []).map((r: any) => ({
        signupId: r.id,
        actorId: r.actor_id,
        actorName: r.profiles?.display_name ?? "",
        actorEmail: r.profiles?.email ?? null,
        status: r.status,
        ranges: (r.signup_conflicts ?? [])
          .map((c: any) => ({ startDate: c.start_date, endDate: c.end_date }))
          .sort((a: ConflictRange, b: ConflictRange) =>
            a.startDate.localeCompare(b.startDate)
          ),
      }));
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch (e) {
      // signup_conflicts not migrated yet — degrade to empty, never crash.
      console.warn("Show conflicts unavailable (migration 009 pending?):", e);
      return [];
    }
  }
  await delay();
  return auditionSignups
    .filter((s) => s.showId === showId && s.status !== "withdrawn")
    .map((s) => ({
      signupId: s.id,
      actorId: s.actorId,
      actorName: s.actorName,
      actorEmail: actors.find((a) => a.id === s.actorId)?.email ?? null,
      status: s.status,
      ranges: (s.conflictDates ?? [])
        .slice()
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }));
}

export type DiscoverFilters = {
  radius: number | null; // null = anywhere
  showType: "all" | "musical" | "play" | "revue";
  sortBy: "suggested" | "newest" | "date" | "distance";
};

export async function getOpenAuditions(filters?: DiscoverFilters): Promise<Show[]> {
  let results: Show[];
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("shows").select(SHOW_SELECT).eq("status", "auditions_open");
    if (error) throw new Error(error.message);
    results = (data ?? []).map(rowToShow);
  } else {
    await delay();
    results = shows.filter((s) => s.status === "auditions_open");
  }

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
  if (isSupabaseConfigured) {
    return getActorFromSupabase(actorId);
  }
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

const NOTE_SELECT = "*, profiles:author_id(display_name)";

/** Map of user_id → role_title for a show's user-linked team members. */
async function getShowRoleTitleMap(showId: string): Promise<Map<string, string>> {
  const { data } = await getSupabase()
    .from("show_team_members")
    .select("user_id, show_team_roles(role_title)")
    .eq("show_id", showId)
    .not("user_id", "is", null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return new Map((data ?? []).map((m: any) => [
    m.user_id as string,
    (m.show_team_roles?.[0]?.role_title ?? "director") as string,
  ]));
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function rowToTeamNote(r: any, roleMap: Map<string, string>): TeamNote {
  return {
    id: r.id,
    showId: r.show_id,
    actorId: r.actor_id,
    authorId: r.author_id,
    authorName: r.profiles?.display_name ?? "",
    authorRole: (roleMap.get(r.author_id) ?? "director") as TeamNote["authorRole"],
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getTeamNotes(
  showId: string,
  actorId?: string
): Promise<TeamNote[]> {
  if (isSupabaseConfigured) {
    let q = getSupabase()
      .from("team_notes").select(NOTE_SELECT)
      .eq("show_id", showId)
      .order("created_at", { ascending: true });
    if (actorId) q = q.eq("actor_id", actorId);
    const [{ data, error }, roleMap] = await Promise.all([
      q,
      getShowRoleTitleMap(showId),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToTeamNote(r, roleMap));
  }
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("team_notes")
      .insert({
        show_id: note.showId,
        actor_id: note.actorId,
        author_id: note.authorId,
        body: note.body,
      })
      .select(NOTE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return rowToTeamNote(data, new Map([[note.authorId, note.authorRole]]));
  }
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("team_notes")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .select(NOTE_SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Only the note's author can edit it.");
    const roleMap = await getShowRoleTitleMap(data.show_id);
    return rowToTeamNote(data, roleMap);
  }
  await delay(200);
  const note = teamNotes.find((n) => n.id === noteId);
  if (!note) throw new Error("Note not found.");
  note.body = body;
  note.updatedAt = new Date().toISOString();
  return note;
}

export async function deleteTeamNote(noteId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("team_notes").delete().eq("id", noteId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = teamNotes.findIndex((n) => n.id === noteId);
  if (idx === -1) throw new Error("Note not found.");
  teamNotes.splice(idx, 1);
}

// ============================================================
// CALLBACKS
// ============================================================

export async function getCallbacks(showId: string): Promise<Callback[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("callbacks").select(CALLBACK_SELECT).eq("show_id", showId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToCallback(r));
  }
  await delay();
  return callbacks.filter((c) => c.showId === showId);
}

export async function getActorCallbacks(actorId: string): Promise<Callback[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("callbacks").select(CALLBACK_SELECT).eq("actor_id", actorId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToCallback(r, { actorFacing: true }));
  }
  await delay();
  return callbacks.filter((c) => c.actorId === actorId);
}

async function respondToCallback(
  callbackId: string,
  status: "accepted" | "declined"
): Promise<Callback> {
  const { data, error } = await getSupabase()
    .from("callbacks")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", callbackId)
    .in("status", ["pending", "notified"])
    .select(CALLBACK_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Callback already responded to.");
  return rowToCallback(data, { actorFacing: true });
}

export async function acceptCallback(callbackId: string): Promise<Callback> {
  if (isSupabaseConfigured) {
    return respondToCallback(callbackId, "accepted");
  }
  await delay(300);
  const cb = callbacks.find((c) => c.id === callbackId);
  if (!cb) throw new Error("Callback not found.");
  if (cb.status !== "pending") throw new Error("Callback already responded to.");
  cb.status = "accepted";
  cb.respondedAt = new Date().toISOString();
  return cb;
}

export async function declineCallback(callbackId: string): Promise<Callback> {
  if (isSupabaseConfigured) {
    return respondToCallback(callbackId, "declined");
  }
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("audition_signups").select(SIGNUP_SELECT)
      .eq("actor_id", actorId).neq("status", "withdrawn");
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToSignup);
  }
  await delay();
  return auditionSignups.filter((s) => s.actorId === actorId);
}

export async function getActorSignup(
  showId: string,
  actorId: string
): Promise<AuditionSignup | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("audition_signups").select(SIGNUP_SELECT)
      .eq("show_id", showId).eq("actor_id", actorId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.status === "withdrawn") return null;
    return rowToSignup(data);
  }
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
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    // SECURITY DEFINER counter (migration 005) — RLS hides other actors'
    // signup rows, so a plain query can't count taken slots.
    const { data, error } = await supabase.rpc("get_slot_availability", {
      p_show_id: showId,
    });
    if (!error) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      return (data ?? []).map((r: any) => ({ groupId: r.group_id, taken: r.taken }));
    }
    // Fallback if 005 isn't applied yet: count what's visible to this user
    // (RLS hides other actors' rows, so counts are optimistic lower bounds).
    console.warn("get_slot_availability RPC unavailable:", error.message);
    const [{ data: groups, error: groupsError }, { data: visible, error: visError }] =
      await Promise.all([
        supabase.from("audition_groups").select("id").eq("show_id", showId),
        supabase.from("audition_signups").select("group_id")
          .eq("show_id", showId).neq("status", "withdrawn"),
      ]);
    if (groupsError) throw new Error(groupsError.message);
    if (visError) throw new Error(visError.message);
    const counts = new Map<string, number>(
      (groups ?? []).map((g) => [g.id as string, 0])
    );
    for (const row of visible ?? []) {
      if (row.group_id) counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
    }
    return Array.from(counts, ([groupId, taken]) => ({ groupId, taken }));
  }
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
  /** Structured conflict ranges — persisted to signup_conflicts (migration 009). */
  conflictDates: ConflictRange[];
  // Acknowledgment fields (stored since migration 003 — fixes data loss)
  isMember: boolean | null;
  mailingList: boolean;
  referralSource: string;
  mediaConsent: boolean;
  commitmentAcknowledged: boolean;
}): Promise<AuditionSignup> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();

    // Chris Rule — production team members can't audition for their own show.
    const { data: teamRow, error: teamError } = await supabase
      .from("show_team_members").select("id")
      .eq("show_id", signup.showId).eq("user_id", signup.actorId).maybeSingle();
    if (teamError) throw new Error(teamError.message);
    if (teamRow) {
      throw new Error(
        "You cannot audition for a show you are on the production team for."
      );
    }

    // Already signed up? (Withdrawn rows are revived instead of re-inserted —
    // UNIQUE(show_id, actor_id) and no DELETE policy.)
    const { data: existing, error: existingError } = await supabase
      .from("audition_signups").select("id, status")
      .eq("show_id", signup.showId).eq("actor_id", signup.actorId).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing && existing.status !== "withdrawn") {
      throw new Error("You are already signed up for this audition.");
    }

    // Capacity check + slot position (best effort — see getSlotAvailability)
    const [{ data: group, error: groupError }, availability] = await Promise.all([
      supabase.from("audition_groups").select("slot_count").eq("id", signup.groupId).maybeSingle(),
      getSlotAvailability(signup.showId),
    ]);
    if (groupError) throw new Error(groupError.message);
    const taken = availability.find((a) => a.groupId === signup.groupId)?.taken ?? 0;
    if (group && taken >= group.slot_count) {
      throw new Error("This time slot is full. Please select a different one.");
    }

    const row = {
      show_id: signup.showId,
      actor_id: signup.actorId,
      group_id: signup.groupId,
      slot_position: taken + 1,
      roles_interested: signup.rolesInterested,
      open_to_other: signup.openToOther,
      will_crew: signup.willCrew,
      conflicts: signup.conflicts || null,
      status: "signed_up" as const,
      signed_up_at: new Date().toISOString(),
      is_member: signup.isMember === true,
      mailing_list: signup.mailingList,
      referral_source: signup.referralSource || null,
      media_consent: signup.mediaConsent,
      commitment_acknowledged: signup.commitmentAcknowledged,
    };

    const query = existing
      ? supabase.from("audition_signups").update(row).eq("id", existing.id)
      : supabase.from("audition_signups").insert(row);
    const { data, error } = await query.select(SIGNUP_SELECT).single();
    if (error) throw new Error(error.message);

    // Structured conflict ranges → signup_conflicts (migration 009).
    // Best-effort: the signup itself must never fail because the conflicts
    // table isn't migrated yet — the freetext column still has the data.
    try {
      if (existing) {
        // Revive after withdraw: replace stale ranges with the fresh ones.
        const { error: delError } = await supabase
          .from("signup_conflicts").delete().eq("signup_id", data.id);
        if (delError) console.warn("Old signup conflicts not cleared:", delError.message);
      }
      if (signup.conflictDates.length > 0) {
        const { error: confError } = await supabase.from("signup_conflicts").insert(
          signup.conflictDates.map((c) => ({
            signup_id: data.id,
            start_date: c.startDate,
            end_date: c.endDate,
          }))
        );
        if (confError) console.warn("Structured conflicts not saved:", confError.message);
      }
    } catch (e) {
      console.warn("Structured conflicts not saved:", e);
    }

    return rowToSignup(data);
  }

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
    conflictDates: signup.conflictDates,
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
  if (isSupabaseConfigured) {
    // No DELETE policy on audition_signups — withdraw is a status change.
    const { error } = await getSupabase()
      .from("audition_signups")
      .update({ status: "withdrawn" })
      .eq("show_id", showId).eq("actor_id", actorId);
    if (error) throw new Error(error.message);
    return;
  }
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
  if (isSupabaseConfigured) {
    const supabase = getSupabase();

    // Split updates across their home tables (only provided keys).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const profileRow: Record<string, any> = {};
    if (updates.bio !== undefined) profileRow.bio = updates.bio;
    if (updates.phone !== undefined) profileRow.phone = updates.phone;
    if (updates.locationCity !== undefined) profileRow.location_city = updates.locationCity;
    if (updates.locationState !== undefined) profileRow.location_state = updates.locationState;
    if (updates.travelRadius !== undefined) profileRow.travel_radius = updates.travelRadius;
    if (updates.isAvailable !== undefined) profileRow.is_available = updates.isAvailable;

    const detailsRow: Record<string, any> = {};
    if (updates.heightInches !== undefined) detailsRow.height_inches = updates.heightInches;
    if (updates.vocalRange !== undefined) detailsRow.vocal_range = updates.vocalRange;
    if (updates.danceStyles !== undefined) detailsRow.dance_styles = updates.danceStyles;
    if (updates.specialSkills !== undefined) detailsRow.special_skills = updates.specialSkills;
    if (updates.ageRangeLow !== undefined) detailsRow.age_range_low = updates.ageRangeLow;
    if (updates.ageRangeHigh !== undefined) detailsRow.age_range_high = updates.ageRangeHigh;
    if (updates.isMinor !== undefined) detailsRow.is_minor = updates.isMinor;
    if (updates.guardianName !== undefined) detailsRow.guardian_name = updates.guardianName;
    if (updates.guardianEmail !== undefined) detailsRow.guardian_email = updates.guardianEmail;
    if (updates.guardianPhone !== undefined) detailsRow.guardian_phone = updates.guardianPhone;
    if (updates.appearanceDescription !== undefined)
      detailsRow.appearance_description = updates.appearanceDescription;
    if (updates.accessibilityNeeds !== undefined)
      detailsRow.accessibility_needs = updates.accessibilityNeeds;
    if (updates.dealbreakers !== undefined) detailsRow.dealbreakers = updates.dealbreakers;
    if (updates.resumePdfUrl !== undefined) detailsRow.resume_pdf_url = updates.resumePdfUrl;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (Object.keys(profileRow).length > 0) {
      const { error } = await supabase.from("profiles").update(profileRow).eq("id", actorId);
      if (error) throw new Error(error.message);
    }
    if (Object.keys(detailsRow).length > 0) {
      const { error } = await supabase
        .from("actor_details")
        .upsert({ user_id: actorId, ...detailsRow });
      if (error) throw new Error(error.message);
    }
    if (updates.measurements !== undefined && updates.measurements) {
      const m = updates.measurements;
      const { error } = await supabase.from("actor_measurements").upsert({
        user_id: actorId,
        head_inches: m.headInches, neck_inches: m.neckInches,
        shoulders_inches: m.shouldersInches, chest_inches: m.chestInches,
        underbust_inches: m.underbustInches, waist_inches: m.waistInches,
        hips_inches: m.hipsInches, inseam_inches: m.inseamInches,
        outseam_inches: m.outseamInches, sleeve_inches: m.sleeveInches,
        rise_inches: m.riseInches, shoe_size: m.shoeSize,
        hat_size: m.hatSize, jacket_dress_size: m.jacketDressSize,
      });
      if (error) throw new Error(error.message);
    }
    if (updates.bucketListShows !== undefined) {
      const { error: delError } = await supabase
        .from("bucket_list_shows").delete().eq("user_id", actorId);
      if (delError) throw new Error(delError.message);
      if (updates.bucketListShows.length > 0) {
        const { error: insError } = await supabase.from("bucket_list_shows").insert(
          updates.bucketListShows.map((b, i) => ({
            user_id: actorId, title: b.title, role: b.role, sort_order: i,
          }))
        );
        if (insError) throw new Error(insError.message);
      }
    }

    const actor = await getActorFromSupabase(actorId);
    if (!actor) throw new Error("Actor not found.");
    return actor;
  }

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
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (updates.displayName !== undefined) row.display_name = updates.displayName;
    if (updates.pronouns !== undefined) row.pronouns = updates.pronouns;
    if (Object.keys(row).length > 0) {
      const { error } = await getSupabase().from("profiles").update(row).eq("id", actorId);
      if (error) throw new Error(error.message);
    }
    const actor = await getActorFromSupabase(actorId);
    if (!actor) throw new Error("Actor not found.");
    return actor;
  }

  await delay(300);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");

  Object.assign(actor, updates);
  return actor;
}

// ============================================================
// ONBOARDING (Account creation)
// ============================================================

/**
 * Create a brand-new actor record from the onboarding wizard.
 * Pushes an ActorWithProfile into the mock `actors` array so the
 * profile page (getActor) works immediately after onboarding.
 * If a record already exists for this user, its profile is updated instead.
 */
export async function createActorProfile(input: {
  user: Pick<User, "id" | "email" | "displayName" | "pronouns">;
  profile: Partial<ActorProfile>;
}): Promise<ActorWithProfile> {
  await delay(400);
  const now = new Date().toISOString();

  const existing = actors.find((a) => a.id === input.user.id);
  if (existing) {
    if (existing.profile) Object.assign(existing.profile, input.profile, { updatedAt: now });
    existing.displayName = input.user.displayName;
    existing.pronouns = input.user.pronouns;
    return existing;
  }

  const profile: ActorProfile = {
    userId: input.user.id,
    bio: "",
    heightInches: null,
    vocalRange: null,
    danceStyles: [],
    specialSkills: [],
    ageRangeLow: null,
    ageRangeHigh: null,
    locationCity: null,
    locationState: null,
    travelRadius: null,
    isAvailable: true,
    resumePdfUrl: null,
    isMinor: false,
    guardianName: null,
    guardianEmail: null,
    guardianPhone: null,
    phone: null,
    appearanceDescription: null,
    bucketListShows: [],
    accessibilityNeeds: null,
    dealbreakers: [],
    measurements: null,
    training: [],
    awards: [],
    createdAt: now,
    updatedAt: now,
    ...input.profile,
  };

  const newActor: ActorWithProfile = {
    id: input.user.id,
    email: input.user.email,
    displayName: input.user.displayName,
    avatarUrl: null,
    pronouns: input.user.pronouns,
    onboardingStep: "complete",
    createdAt: now,
    profile,
    credits: [],
    crewCredits: [],
    endorsements: [],
  };
  actors.push(newActor);
  return newActor;
}

/**
 * Create a new organization (theatre) from the onboarding wizard.
 */
export async function createOrg(data: {
  name: string;
  city: string | null;
  state: string | null;
}): Promise<Org> {
  await delay(400);
  const now = new Date().toISOString();
  const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const newOrg: Org = {
    id: `org-${Date.now()}`,
    name: data.name.trim(),
    slug: slug || `org-${Date.now()}`,
    logoUrl: null,
    description: null,
    city: data.city,
    state: data.state,
    websiteUrl: null,
    codeOfConduct: null,
    foundedYear: null,
    mission: null,
    facebookUrl: null,
    instagramUrl: null,
    ticketingUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  orgs.push(newOrg);
  return newOrg;
}

// ============================================================
// CREDITS / TRAINING / AWARDS (Actor-side)
// ============================================================

export async function addManualCredit(
  actorId: string,
  data: { showTitle: string; roleName: string; theatreName: string; year: number }
): Promise<ProductionCredit> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("production_credits")
      .insert({
        user_id: actorId, show_title: data.showTitle, role_name: data.roleName,
        theatre_name: data.theatreName, year: data.year,
        verified: false, credit_type: "performer",
      })
      .select(CREDIT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return rowToCredit(row);
  }
  await delay(300);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");
  const credit: ProductionCredit = {
    id: `cred-${Date.now()}`,
    ...data,
    verified: false,
    orgId: null,
    likeCount: 0,
    kudos: null,
  };
  actor.credits.push(credit);
  return credit;
}

export async function updateManualCredit(
  actorId: string,
  creditId: string,
  data: Partial<Pick<ProductionCredit, "showTitle" | "roleName" | "theatreName" | "year">>
): Promise<ProductionCredit> {
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (data.showTitle !== undefined) row.show_title = data.showTitle;
    if (data.roleName !== undefined) row.role_name = data.roleName;
    if (data.theatreName !== undefined) row.theatre_name = data.theatreName;
    if (data.year !== undefined) row.year = data.year;
    const { data: updated, error } = await getSupabase()
      .from("production_credits")
      .update(row)
      .eq("id", creditId)
      .eq("verified", false)
      .select(CREDIT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return rowToCredit(updated);
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");
  const credit = actor.credits.find((c) => c.id === creditId);
  if (!credit) throw new Error("Credit not found.");
  if (credit.verified) throw new Error("Cannot edit a verified credit.");
  Object.assign(credit, data);
  return credit;
}

export async function deleteManualCredit(
  actorId: string,
  creditId: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("production_credits")
      .delete()
      .eq("id", creditId)
      .eq("verified", false);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");
  const credit = actor.credits.find((c) => c.id === creditId);
  if (!credit) throw new Error("Credit not found.");
  if (credit.verified) throw new Error("Cannot delete a verified credit.");
  actor.credits = actor.credits.filter((c) => c.id !== creditId);
}

export async function addCrewCredit(
  actorId: string,
  data: { position: string; showTitle: string; theatreName: string; year: number }
): Promise<CrewCredit> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("production_credits")
      .insert({
        user_id: actorId, show_title: data.showTitle, role_name: data.position,
        theatre_name: data.theatreName, year: data.year,
        verified: false, credit_type: "crew",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToCrewCredit(row);
  }
  await delay(300);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");
  const credit: CrewCredit = {
    id: `crew-${Date.now()}`,
    ...data,
    verified: false,
    orgId: null,
  };
  actor.crewCredits.push(credit);
  return credit;
}

export async function updateCrewCredit(
  actorId: string,
  creditId: string,
  data: Partial<Pick<CrewCredit, "position" | "showTitle" | "theatreName" | "year">>
): Promise<CrewCredit> {
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (data.position !== undefined) row.role_name = data.position;
    if (data.showTitle !== undefined) row.show_title = data.showTitle;
    if (data.theatreName !== undefined) row.theatre_name = data.theatreName;
    if (data.year !== undefined) row.year = data.year;
    const { data: updated, error } = await getSupabase()
      .from("production_credits")
      .update(row)
      .eq("id", creditId)
      .eq("verified", false)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToCrewCredit(updated);
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");
  const credit = actor.crewCredits.find((c) => c.id === creditId);
  if (!credit) throw new Error("Credit not found.");
  if (credit.verified) throw new Error("Cannot edit a verified credit.");
  Object.assign(credit, data);
  return credit;
}

export async function deleteCrewCredit(
  actorId: string,
  creditId: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("production_credits")
      .delete()
      .eq("id", creditId)
      .eq("verified", false);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Actor not found.");
  const credit = actor.crewCredits.find((c) => c.id === creditId);
  if (!credit) throw new Error("Credit not found.");
  if (credit.verified) throw new Error("Cannot delete a verified credit.");
  actor.crewCredits = actor.crewCredits.filter((c) => c.id !== creditId);
}

export async function addTraining(
  actorId: string,
  data: { institution: string; description: string; years: string | null }
): Promise<Training> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("training")
      .insert({ user_id: actorId, ...data })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, institution: row.institution, description: row.description, years: row.years };
  }
  await delay(300);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor?.profile) throw new Error("Actor not found.");
  const entry: Training = { id: `train-${Date.now()}`, ...data };
  actor.profile.training.push(entry);
  return entry;
}

export async function updateTraining(
  actorId: string,
  trainingId: string,
  data: Partial<Pick<Training, "institution" | "description" | "years">>
): Promise<Training> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("training")
      .update(data)
      .eq("id", trainingId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, institution: row.institution, description: row.description, years: row.years };
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor?.profile) throw new Error("Actor not found.");
  const entry = actor.profile.training.find((t) => t.id === trainingId);
  if (!entry) throw new Error("Training not found.");
  Object.assign(entry, data);
  return entry;
}

export async function deleteTraining(
  actorId: string,
  trainingId: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase().from("training").delete().eq("id", trainingId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor?.profile) throw new Error("Actor not found.");
  actor.profile.training = actor.profile.training.filter((t) => t.id !== trainingId);
}

export async function addAward(
  actorId: string,
  data: { title: string; organization: string; year: number }
): Promise<Award> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("awards")
      .insert({ user_id: actorId, ...data })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, title: row.title, organization: row.organization, year: row.year };
  }
  await delay(300);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor?.profile) throw new Error("Actor not found.");
  const entry: Award = { id: `award-${Date.now()}`, ...data };
  actor.profile.awards.push(entry);
  return entry;
}

export async function updateAward(
  actorId: string,
  awardId: string,
  data: Partial<Pick<Award, "title" | "organization" | "year">>
): Promise<Award> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("awards")
      .update(data)
      .eq("id", awardId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, title: row.title, organization: row.organization, year: row.year };
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor?.profile) throw new Error("Actor not found.");
  const entry = actor.profile.awards.find((a) => a.id === awardId);
  if (!entry) throw new Error("Award not found.");
  Object.assign(entry, data);
  return entry;
}

export async function deleteAward(
  actorId: string,
  awardId: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase().from("awards").delete().eq("id", awardId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const actor = actors.find((a) => a.id === actorId);
  if (!actor?.profile) throw new Error("Actor not found.");
  actor.profile.awards = actor.profile.awards.filter((a) => a.id !== awardId);
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("notifications").select("*")
      .eq("user_id", actorId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return (data ?? []).map((r: any) => ({
      id: r.id,
      actorId: r.user_id,
      type: r.type,
      title: r.title,
      body: r.body,
      showTitle: r.show_title,
      linkUrl: r.link_url,
      isRead: r.is_read,
      createdAt: r.created_at,
    }));
  }
  await delay();
  return buildNotifications(actorId);
}

export async function markNotificationRead(notifId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("notifications").update({ is_read: true }).eq("id", notifId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(100);
  readNotifIds.add(notifId);
}

// ============================================================
// SHOW CRUD (Production-side)
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function showUpdatesToRow(updates: Partial<Show>): Record<string, any> {
  const row: Record<string, any> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.authorInfo !== undefined) row.author_info = updates.authorInfo;
  if (updates.showType !== undefined) row.show_type = updates.showType;
  if (updates.season !== undefined) row.season = updates.season;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.auditionStart !== undefined) row.audition_start = updates.auditionStart;
  if (updates.auditionEnd !== undefined) row.audition_end = updates.auditionEnd;
  if (updates.callbackDate !== undefined) row.callback_date = updates.callbackDate;
  if (updates.callbackStartTime !== undefined) row.callback_start_time = updates.callbackStartTime;
  if (updates.callbackEndTime !== undefined) row.callback_end_time = updates.callbackEndTime;
  if (updates.rehearsalStart !== undefined) row.rehearsal_start = updates.rehearsalStart;
  if (updates.showOpen !== undefined) row.show_open = updates.showOpen;
  if (updates.showClose !== undefined) row.show_close = updates.showClose;
  if (updates.auditionLocation !== undefined) row.audition_location = updates.auditionLocation;
  if (updates.auditionNotes !== undefined) row.audition_notes = updates.auditionNotes;
  if (updates.callbackLocation !== undefined) row.callback_location = updates.callbackLocation;
  if (updates.callbackNotes !== undefined) row.callback_notes = updates.callbackNotes;
  if (updates.performanceLocation !== undefined) row.performance_location = updates.performanceLocation;
  if (updates.callbackContactName !== undefined) row.callback_contact_name = updates.callbackContactName;
  if (updates.callbackContactPhone !== undefined) row.callback_contact_phone = updates.callbackContactPhone;
  if (updates.posterUrl !== undefined) row.poster_url = updates.posterUrl;
  if (updates.city !== undefined) row.city = updates.city;
  if (updates.state !== undefined) row.state = updates.state;
  return row;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function createShow(data: Omit<Show, "id" | "createdAt" | "updatedAt">): Promise<Show> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: showRow, error } = await supabase
      .from("shows")
      .insert({ org_id: data.orgId, is_promoted: false, ...showUpdatesToRow(data) })
      .select(SHOW_SELECT)
      .single();
    if (error) throw new Error(error.message);

    // Put the creator on the show team right away — show-team RLS (roles,
    // slots, notes) keys off this row, and the wizard already promises
    // "You're already added as director."
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data: tm, error: tmError } = await supabase
        .from("show_team_members")
        .insert({ show_id: showRow.id, user_id: authData.user.id, can_evaluate: true })
        .select("id")
        .single();
      if (tmError) {
        console.warn("Creator not added to show team:", tmError.message);
      } else {
        const { error: roleError } = await supabase.from("show_team_roles").insert({
          team_member_id: tm.id, department: "creative", role_title: "director",
        });
        if (roleError) console.warn("Creator team role not added:", roleError.message);
      }
    }
    return rowToShow(showRow);
  }
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("shows")
      .update({ ...showUpdatesToRow(updates), updated_at: new Date().toISOString() })
      .eq("id", showId)
      .select(SHOW_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return rowToShow(data);
  }
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

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function rowToShowRole(r: any): ShowRole {
  return {
    id: r.id, showId: r.show_id, name: r.name, roleType: r.role_type,
    gender: r.gender, ageRange: r.age_range, vocalRange: r.vocal_range,
    description: r.description, sortOrder: r.sort_order,
  };
}

export async function createShowRole(data: Omit<ShowRole, "id">): Promise<ShowRole> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("show_roles")
      .insert({
        show_id: data.showId, name: data.name, role_type: data.roleType,
        gender: data.gender, age_range: data.ageRange, vocal_range: data.vocalRange,
        description: data.description, sort_order: data.sortOrder,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToShowRole(row);
  }
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
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.roleType !== undefined) row.role_type = updates.roleType;
    if (updates.gender !== undefined) row.gender = updates.gender;
    if (updates.ageRange !== undefined) row.age_range = updates.ageRange;
    if (updates.vocalRange !== undefined) row.vocal_range = updates.vocalRange;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
    const { data, error } = await getSupabase()
      .from("show_roles").update(row).eq("id", roleId).select("*").single();
    if (error) throw new Error(error.message);
    return rowToShowRole(data);
  }
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
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("show_roles").delete().eq("id", roleId);
    if (error) throw new Error(error.message);
    return;
  }
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
  if (isSupabaseConfigured) {
    const supabase = getSupabase();

    // If the email belongs to an Overture account, link it; otherwise the
    // member is stored as a guest (name + email only, no login).
    let linkedUserId: string | null = null;
    let linkedName: string | null = null;
    if (data.email) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, display_name")
        .ilike("email", data.email.trim())
        .maybeSingle();
      if (profileRow) {
        linkedUserId = profileRow.id;
        linkedName = profileRow.display_name;
      }
    }

    const { data: tm, error } = await supabase
      .from("show_team_members")
      .insert({
        show_id: data.showId,
        user_id: linkedUserId,
        guest_name: linkedUserId ? null : data.userName,
        guest_email: linkedUserId ? null : data.email || null,
        can_evaluate: data.canEvaluate,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: roleError } = await supabase.from("show_team_roles").insert({
      team_member_id: tm.id,
      department: TEAM_ROLE_DEPARTMENT[data.role] ?? "production",
      role_title: data.role,
    });
    if (roleError) throw new Error(roleError.message);

    if (linkedUserId) {
      const showTitle = await getShowTitle(data.showId);
      await pushNotification({
        recipientId: linkedUserId,
        showId: data.showId,
        type: "system",
        title: "You've Joined a Production Team",
        body: `You've been added as ${data.role.replace(/_/g, " ")}${showTitle ? ` for ${showTitle}` : ""}.`,
        showTitle,
        linkUrl: `/shows/${data.showId}/setup`,
      });
    }

    return {
      id: tm.id,
      showId: data.showId,
      userId: linkedUserId ?? `guest-${tm.id}`,
      userName: linkedName ?? data.userName,
      role: data.role,
      canEvaluate: data.canEvaluate,
      email: data.email ?? null,
      phone: data.phone ?? null,
    };
  }
  await delay(300);
  const newMember: ShowTeamMember = {
    ...data,
    id: `tm-${Date.now()}`,
  };
  showTeam.push(newMember);
  return newMember;
}

export async function removeTeamMember(memberId: string): Promise<void> {
  if (isSupabaseConfigured) {
    // show_team_roles rows cascade with the member.
    const { error } = await getSupabase()
      .from("show_team_members").delete().eq("id", memberId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = showTeam.findIndex((t) => t.id === memberId);
  if (idx !== -1) {
    showTeam.splice(idx, 1);
  }
}

// ============================================================
// AUDITION GROUP MANAGEMENT (Production-side)
// ============================================================

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function rowToAuditionGroup(r: any): AuditionGroup {
  return {
    id: r.id, showId: r.show_id, name: r.name, startTime: r.start_time,
    endTime: r.end_time, slotCount: r.slot_count, sortOrder: r.sort_order,
  };
}

export async function createAuditionGroup(data: Omit<AuditionGroup, "id">): Promise<AuditionGroup> {
  if (isSupabaseConfigured) {
    const { data: row, error } = await getSupabase()
      .from("audition_groups")
      .insert({
        show_id: data.showId, name: data.name, start_time: data.startTime,
        end_time: data.endTime, slot_count: data.slotCount, sort_order: data.sortOrder,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToAuditionGroup(row);
  }
  await delay(300);
  const newGroup: AuditionGroup = {
    ...data,
    id: `grp-${Date.now()}`,
  };
  auditionGroups.push(newGroup);
  return newGroup;
}

export async function updateAuditionGroup(groupId: string, updates: Partial<AuditionGroup>): Promise<AuditionGroup> {
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.startTime !== undefined) row.start_time = updates.startTime;
    if (updates.endTime !== undefined) row.end_time = updates.endTime;
    if (updates.slotCount !== undefined) row.slot_count = updates.slotCount;
    if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
    const { data, error } = await getSupabase()
      .from("audition_groups").update(row).eq("id", groupId).select("*").single();
    if (error) throw new Error(error.message);
    return rowToAuditionGroup(data);
  }
  await delay(200);
  const group = auditionGroups.find((g) => g.id === groupId);
  if (!group) throw new Error("Audition group not found.");
  Object.assign(group, updates);
  return group;
}

export async function deleteAuditionGroup(groupId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("audition_groups").delete().eq("id", groupId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = auditionGroups.findIndex((g) => g.id === groupId);
  if (idx === -1) throw new Error("Audition group not found.");
  auditionGroups.splice(idx, 1);
}

// ============================================================
// SIGNUP STATUS (Production-side)
// ============================================================

export async function updateSignupStatus(signupId: string, status: SignupStatus): Promise<AuditionSignup> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("audition_signups")
      .update({ status })
      .eq("id", signupId)
      .select(SIGNUP_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return rowToSignup(data);
  }
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
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: existing, error: existingError } = await supabase
      .from("callbacks").select("id")
      .eq("show_id", data.showId).eq("actor_id", data.actorId).eq("role_id", data.roleId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) throw new Error("Callback already exists for this actor and role.");

    const { data: row, error } = await supabase
      .from("callbacks")
      .insert({
        show_id: data.showId, actor_id: data.actorId, role_id: data.roleId,
        prep_notes: data.prepNotes ?? null, status: "pending",
      })
      .select(CALLBACK_SELECT)
      .single();
    if (error) throw new Error(error.message);

    // Move the actor's signup forward to "callback" if it's in an earlier status
    const { error: signupError } = await supabase
      .from("audition_signups")
      .update({ status: "callback" })
      .eq("show_id", data.showId).eq("actor_id", data.actorId)
      .in("status", ["signed_up", "checked_in", "auditioned", "shortlisted"]);
    if (signupError) console.warn("Signup status not updated:", signupError.message);

    return rowToCallback(row);
  }
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
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("callbacks").delete().eq("id", callbackId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay(200);
  const idx = callbacks.findIndex((c) => c.id === callbackId);
  if (idx === -1) throw new Error("Callback not found.");
  callbacks.splice(idx, 1);
}

export async function notifyCallbacks(showId: string): Promise<number> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: pending, error } = await supabase
      .from("callbacks")
      .update({ status: "notified", notified_at: new Date().toISOString() })
      .eq("show_id", showId).eq("status", "pending")
      .select(CALLBACK_SELECT);
    if (error) throw new Error(error.message);

    if (pending && pending.length > 0) {
      const showTitle = await getShowTitle(showId);
      await Promise.all(
        pending.map((cb) =>
          pushNotification({
            recipientId: cb.actor_id,
            showId,
            type: "callback",
            title: "Callback Invitation",
            body: `You've been called back for ${cb.show_roles?.name ?? "a role"}!`,
            showTitle,
            linkUrl: `/auditions/${showId}`,
          })
        )
      );
    }
    return pending?.length ?? 0;
  }
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("cast_assignments").select(CAST_SELECT)
      .eq("show_id", showId).order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToCastAssignment);
  }
  await delay();
  return castAssignments
    .filter((a) => a.showId === showId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createCastAssignment(data: Omit<CastAssignment, "id">): Promise<CastAssignment> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: existing, error: existingError } = await supabase
      .from("cast_assignments").select("id")
      .eq("show_id", data.showId).eq("role_id", data.roleId)
      .eq("assignment_type", data.assignmentType).neq("status", "withdrawn")
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) throw new Error(`A ${data.assignmentType} is already assigned to this role.`);

    const { data: row, error } = await supabase
      .from("cast_assignments")
      .insert({
        show_id: data.showId, role_id: data.roleId, actor_id: data.actorId,
        assignment_type: data.assignmentType, status: data.status,
        sort_order: data.sortOrder,
      })
      .select(CAST_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return rowToCastAssignment(row);
  }
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
  if (isSupabaseConfigured) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.roleId !== undefined) row.role_id = updates.roleId;
    if (updates.actorId !== undefined) row.actor_id = updates.actorId;
    if (updates.assignmentType !== undefined) row.assignment_type = updates.assignmentType;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
    const { data, error } = await getSupabase()
      .from("cast_assignments")
      .update(row)
      .eq("id", assignmentId)
      .select(CAST_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return rowToCastAssignment(data);
  }
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
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("cast_assignments").select(CAST_SELECT).eq("id", assignmentId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToCastAssignment(data) : null;
  }
  await delay();
  return castAssignments.find((a) => a.id === assignmentId) ?? null;
}

export async function getActorCastAssignments(actorId: string): Promise<CastAssignment[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await getSupabase()
      .from("cast_assignments").select(CAST_SELECT)
      .eq("actor_id", actorId).neq("status", "withdrawn");
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToCastAssignment);
  }
  await delay();
  return castAssignments.filter((a) => a.actorId === actorId && a.status !== "withdrawn");
}

/**
 * Cloud helper: actor responds to a sent offer, then the show's director(s)
 * with user accounts get a notification.
 */
async function respondToCastOffer(
  assignmentId: string,
  status: "accepted" | "declined"
): Promise<CastAssignment> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("cast_assignments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", assignmentId).eq("status", "sent")
    .select(CAST_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This offer is no longer available.");
  const assignment = rowToCastAssignment(data);

  if (status === "accepted") {
    const { error: signupError } = await supabase
      .from("audition_signups")
      .update({ status: "cast" })
      .eq("show_id", assignment.showId).eq("actor_id", assignment.actorId);
    if (signupError) console.warn("Signup status not updated:", signupError.message);
  }

  // Tell the director(s) — only those with real user accounts.
  const [directorIds, showTitle] = await Promise.all([
    getShowDirectorUserIds(assignment.showId),
    getShowTitle(assignment.showId),
  ]);
  await Promise.all(
    directorIds
      .filter((id) => id !== assignment.actorId)
      .map((recipientId) =>
        pushNotification({
          recipientId,
          showId: assignment.showId,
          type: "cast",
          title: status === "accepted" ? "Offer Accepted" : "Offer Declined",
          body: `${assignment.actorName || "An actor"} ${status} the role of ${assignment.roleName}.`,
          showTitle,
          linkUrl: `/shows/${assignment.showId}/casting`,
        })
      )
  );

  return assignment;
}

export async function acceptCastOffer(assignmentId: string): Promise<CastAssignment> {
  if (isSupabaseConfigured) {
    return respondToCastOffer(assignmentId, "accepted");
  }
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
  if (isSupabaseConfigured) {
    return respondToCastOffer(assignmentId, "declined");
  }
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
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: sent, error } = await supabase
      .from("cast_assignments")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("show_id", showId).eq("status", "draft")
      .select(CAST_SELECT);
    if (error) throw new Error(error.message);

    if (sent && sent.length > 0) {
      const showTitle = await getShowTitle(showId);
      await Promise.all(
        sent.map((a) =>
          pushNotification({
            recipientId: a.actor_id,
            showId,
            type: "cast",
            title: "You've Been Cast!",
            body: `You've been offered the role of ${a.show_roles?.name ?? "a role"}!`,
            showTitle,
            linkUrl: `/offers/${a.id}`,
          })
        )
      );
    }
    return sent?.length ?? 0;
  }
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
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { data: assignments, error } = await supabase
      .from("cast_assignments").select("id, status")
      .eq("show_id", showId).neq("status", "withdrawn");
    if (error) throw new Error(error.message);
    if (!assignments || assignments.length === 0) {
      throw new Error("No cast assignments to publish.");
    }
    if (assignments.some((a) => a.status !== "accepted")) {
      throw new Error("All cast assignments must be accepted before publishing.");
    }
    const { error: showError } = await supabase
      .from("shows")
      .update({ status: "cast", updated_at: new Date().toISOString() })
      .eq("id", showId);
    if (showError) throw new Error(showError.message);
    return;
  }
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
  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("cast_assignments")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("show_id", showId).eq("status", "sent");
    if (error) throw new Error(error.message);
    const { error: showError } = await supabase
      .from("shows")
      .update({ status: "casting", updated_at: new Date().toISOString() })
      .eq("id", showId);
    if (showError) throw new Error(showError.message);
    return;
  }
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

// ============================================================
// ORG DASHBOARD — /shows command center aggregation
// ============================================================

/** Per-show rollup powering the /shows command center. */
export type ShowDashboardStats = {
  showId: string;
  /** Non-withdrawn audition signups. */
  signupCount: number;
  /** Total audition slot capacity across all blocks. */
  slotsTotal: number;
  /** Days from today until auditionStart; null when unset or already past. */
  daysUntilAuditions: number | null;
  callbacksTotal: number;
  /** Callbacks created but not yet notified — "ready to send". */
  callbacksPending: number;
  callbacksAccepted: number;
  offersDraft: number;
  /** Offers sent and still awaiting the actor's response. */
  offersSent: number;
  offersAccepted: number;
  offersDeclined: number;
  hasRoles: boolean;
  hasSchedule: boolean;
};

/** One non-draft cast offer for the offer-tracker table. */
export type DashboardOffer = {
  id: string;
  showId: string;
  showTitle: string;
  actorName: string;
  roleName: string;
  status: OfferStatus;
  respondedAt: string | null;
};

export type OrgDashboard = {
  /** One entry per ACTIVE show (setup → casting; cast/archived excluded). */
  stats: ShowDashboardStats[];
  /** Sent/accepted/declined offers across active shows, tracker-ready. */
  offers: DashboardOffer[];
};

/** Days from today (local midnight) until a date string; null if past/unset. */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

type ShowAggInput = {
  hasRoles: boolean;
  hasSchedule: boolean;
  slotsTotal: number;
  signupCount: number;
  callbackStatuses: CallbackStatus[];
  offerStatuses: OfferStatus[];
};

function buildShowStats(show: Show, input: ShowAggInput): ShowDashboardStats {
  const cb: Record<CallbackStatus, number> = {
    pending: 0, notified: 0, accepted: 0, declined: 0, no_response: 0,
  };
  for (const s of input.callbackStatuses) cb[s]++;
  const offer: Record<OfferStatus, number> = {
    draft: 0, sent: 0, accepted: 0, declined: 0, withdrawn: 0,
  };
  for (const s of input.offerStatuses) offer[s]++;
  return {
    showId: show.id,
    signupCount: input.signupCount,
    slotsTotal: input.slotsTotal,
    daysUntilAuditions: daysUntil(show.auditionStart),
    callbacksTotal: input.callbackStatuses.length,
    callbacksPending: cb.pending,
    callbacksAccepted: cb.accepted,
    offersDraft: offer.draft,
    offersSent: offer.sent,
    offersAccepted: offer.accepted,
    offersDeclined: offer.declined,
    hasRoles: input.hasRoles,
    hasSchedule: input.hasSchedule,
  };
}

/**
 * ONE dual-mode aggregation for the /shows command center: per-show stats +
 * the offer tracker across the org's ACTIVE shows. Cloud mode runs 5 batched
 * `.in("show_id", …)` queries (not per-show N+1); any failure degrades to an
 * empty dashboard — the LOCKED shows grid never depends on this call.
 */
export async function getOrgDashboard(orgId: string): Promise<OrgDashboard> {
  const orgShows = await getShows({ orgId });
  const active = orgShows.filter(
    (s) => s.status !== "cast" && s.status !== "archived"
  );
  if (active.length === 0) return { stats: [], offers: [] };
  const ids = active.map((s) => s.id);
  const titleById = new Map(active.map((s) => [s.id, s.title]));

  if (isSupabaseConfigured) {
    try {
      const supabase = getSupabase();
      const [rolesRes, groupsRes, signupsRes, callbacksRes, offersRes] =
        await Promise.all([
          supabase.from("show_roles").select("id, show_id").in("show_id", ids),
          supabase.from("audition_groups").select("id, show_id, slot_count").in("show_id", ids),
          supabase.from("audition_signups").select("id, show_id, status")
            .in("show_id", ids).neq("status", "withdrawn"),
          supabase.from("callbacks").select("id, show_id, status").in("show_id", ids),
          supabase.from("cast_assignments")
            .select("id, show_id, status, updated_at, show_roles:role_id(name), profiles:actor_id(display_name)")
            .in("show_id", ids),
        ]);
      const firstError =
        rolesRes.error ?? groupsRes.error ?? signupsRes.error ??
        callbacksRes.error ?? offersRes.error;
      if (firstError) throw new Error(firstError.message);

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const stats = active.map((show) =>
        buildShowStats(show, {
          hasRoles: (rolesRes.data ?? []).some((r: any) => r.show_id === show.id),
          hasSchedule: (groupsRes.data ?? []).some((g: any) => g.show_id === show.id),
          slotsTotal: (groupsRes.data ?? [])
            .filter((g: any) => g.show_id === show.id)
            .reduce((n: number, g: any) => n + (g.slot_count ?? 0), 0),
          signupCount: (signupsRes.data ?? []).filter((s: any) => s.show_id === show.id).length,
          callbackStatuses: (callbacksRes.data ?? [])
            .filter((c: any) => c.show_id === show.id)
            .map((c: any) => c.status as CallbackStatus),
          offerStatuses: (offersRes.data ?? [])
            .filter((a: any) => a.show_id === show.id)
            .map((a: any) => a.status as OfferStatus),
        })
      );
      const offers: DashboardOffer[] = (offersRes.data ?? [])
        .filter((a: any) => a.status !== "draft" && a.status !== "withdrawn")
        .map((a: any) => ({
          id: a.id,
          showId: a.show_id,
          showTitle: titleById.get(a.show_id) ?? "",
          actorName: a.profiles?.display_name ?? "",
          roleName: a.show_roles?.name ?? "",
          status: a.status as OfferStatus,
          respondedAt:
            a.status === "accepted" || a.status === "declined"
              ? a.updated_at ?? null
              : null,
        }));
      /* eslint-enable @typescript-eslint/no-explicit-any */
      return { stats, offers };
    } catch (e) {
      // The dashboard is additive — degrade to empty, never crash /shows.
      console.warn("Org dashboard aggregation unavailable:", e);
      return { stats: [], offers: [] };
    }
  }

  await delay();
  const stats = active.map((show) => {
    const groups = auditionGroups.filter((g) => g.showId === show.id);
    const signups = auditionSignups.filter(
      (s) => s.showId === show.id && s.status !== "withdrawn"
    );
    return buildShowStats(show, {
      hasRoles: (allShowRoles[show.id] ?? []).length > 0,
      hasSchedule: groups.length > 0,
      slotsTotal: groups.reduce((n, g) => n + g.slotCount, 0),
      signupCount: signups.length,
      callbackStatuses: callbacks
        .filter((c) => c.showId === show.id)
        .map((c) => c.status),
      offerStatuses: castAssignments
        .filter((a) => a.showId === show.id)
        .map((a) => a.status),
    });
  });
  const offers: DashboardOffer[] = castAssignments
    .filter(
      (a) =>
        titleById.has(a.showId) &&
        a.status !== "draft" &&
        a.status !== "withdrawn"
    )
    .map((a) => ({
      id: a.id,
      showId: a.showId,
      showTitle: titleById.get(a.showId)!,
      actorName: a.actorName,
      roleName: a.roleName,
      status: a.status,
      respondedAt: null, // mock offers don't track response timestamps
    }));
  return { stats, offers };
}

// ============================================================
// ACCOUNT SETTINGS (Week 4) — notification prefs + deletion
// ============================================================

// Mock-mode prefs live in memory so the settings toggles feel real in the
// demo (they reset on refresh — cloud mode persists to profiles).
let mockNotificationPrefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS };

export async function getNotificationPrefs(
  userId: string
): Promise<NotificationPrefs> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("notification_prefs")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const stored = ((data as any)?.notification_prefs ?? {}) as Partial<NotificationPrefs>;
      return { ...DEFAULT_NOTIFICATION_PREFS, ...stored };
    } catch (e) {
      // Column not migrated yet (migration 012) — defaults, never crash.
      console.warn("Notification prefs unavailable (migration 012 pending?):", e);
      return { ...DEFAULT_NOTIFICATION_PREFS };
    }
  }
  await delay();
  return { ...mockNotificationPrefs };
}

export async function updateNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase()
      .from("profiles")
      .update({ notification_prefs: prefs })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return;
  }
  await delay();
  mockNotificationPrefs = { ...prefs };
}

/**
 * Permanently delete the signed-in user's account via the SECURITY DEFINER
 * delete_my_account() RPC (migration 012). Deletes the auth.users row,
 * which cascades through profiles and everything referencing it.
 * Cloud-only — the settings page guards mock mode with a toast.
 */
export async function deleteMyAccount(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Account deletion is available with a cloud account.");
  }
  const { error } = await getSupabase().rpc("delete_my_account");
  if (error) throw new Error(error.message);
}

// ============================================================
// RESOURCE LEADS — /resources email capture (migration 012)
// ============================================================

export async function submitResourceLead(input: {
  name: string;
  email: string;
  /** Honeypot — hidden field; bots fill it, people don't. */
  website?: string;
}): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await getSupabase().rpc("submit_resource_lead", {
      p_name: input.name,
      p_email: input.email,
      p_website: input.website ?? "",
    });
    if (error) throw new Error(error.message);
    return;
  }
  // Mock mode: succeed without storing (demo-friendly).
  await delay(300);
}
