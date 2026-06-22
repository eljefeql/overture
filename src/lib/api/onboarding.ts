/**
 * Onboarding writes — the cloud counterpart of createActorProfile/createOrg
 * in client.ts. Used by the onboarding wizard when Supabase is configured;
 * the mock functions remain the fallback for unconfigured local dev.
 */

import { getSupabase } from "@/lib/supabase/client";
import { claimPendingInvites } from "@/lib/api/client";
import type { ActorProfile, BucketListShow, Org, Pronouns, User } from "@/types";

/**
 * Persist the actor onboarding wizard to Supabase:
 * profiles UPDATE + actor_details UPSERT + talent_roles INSERT + bucket list.
 */
export async function completeActorOnboarding(input: {
  user: Pick<User, "id" | "displayName" | "pronouns">;
  profile: Partial<ActorProfile>;
  bucketListShows?: BucketListShow[];
}): Promise<void> {
  const supabase = getSupabase();
  const { user, profile } = input;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: user.displayName,
      pronouns: user.pronouns,
      bio: profile.bio ?? null,
      phone: profile.phone ?? null,
      location_city: profile.locationCity ?? null,
      location_state: profile.locationState ?? null,
      travel_radius: profile.travelRadius ?? null,
      is_available: true,
      onboarding_step: "complete",
    })
    .eq("id", user.id);
  if (profileError) throw new Error(profileError.message);

  const { error: detailsError } = await supabase.from("actor_details").upsert({
    user_id: user.id,
    height_inches: profile.heightInches ?? null,
    vocal_range: profile.vocalRange ?? null,
    dance_styles: profile.danceStyles ?? [],
    special_skills: profile.specialSkills ?? [],
    age_range_low: profile.ageRangeLow ?? null,
    age_range_high: profile.ageRangeHigh ?? null,
    is_minor: profile.isMinor ?? false,
    guardian_name: profile.guardianName ?? null,
    guardian_email: profile.guardianEmail ?? null,
    guardian_phone: profile.guardianPhone ?? null,
    appearance_description: profile.appearanceDescription ?? null,
    accessibility_needs: profile.accessibilityNeeds ?? null,
    dealbreakers: profile.dealbreakers ?? [],
  });
  if (detailsError) throw new Error(detailsError.message);

  const { error: roleError } = await supabase
    .from("talent_roles")
    .upsert({ user_id: user.id, role_type: "actor" }, { onConflict: "user_id,role_type" });
  if (roleError) throw new Error(roleError.message);

  const bucketList = input.bucketListShows ?? [];
  if (bucketList.length > 0) {
    const { error: bucketError } = await supabase.from("bucket_list_shows").insert(
      bucketList.map((b, i) => ({
        user_id: user.id,
        title: b.title,
        role: b.role,
        sort_order: i,
      }))
    );
    if (bucketError) throw new Error(bucketError.message);
  }

  // A theatre may have invited this email before the account existed.
  await claimPendingInvites();
}

/**
 * Persist the theatre-maker onboarding wizard to Supabase:
 * orgs INSERT + org_members (owner) INSERT + profiles UPDATE.
 */
export async function completeMakerOnboarding(input: {
  user: Pick<User, "id" | "displayName"> & { pronouns: Pronouns | null };
  org: { name: string; city: string | null; state: string | null };
}): Promise<Org> {
  const supabase = getSupabase();
  const { user, org } = input;

  const baseSlug =
    org.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "theatre";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: orgRow, error: orgError } = await supabase
    .from("orgs")
    .insert({
      name: org.name.trim(),
      slug,
      city: org.city,
      state: org.state,
    })
    .select("*")
    .single();
  if (orgError) throw new Error(orgError.message);

  const { error: memberError } = await supabase.from("org_members").insert({
    org_id: orgRow.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) throw new Error(memberError.message);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: user.displayName,
      pronouns: user.pronouns,
      onboarding_step: "complete",
    })
    .eq("id", user.id);
  if (profileError) throw new Error(profileError.message);

  // A theatre may have invited this email before the account existed.
  await claimPendingInvites();

  return {
    id: orgRow.id,
    name: orgRow.name,
    slug: orgRow.slug,
    logoUrl: orgRow.logo_url,
    description: orgRow.description,
    city: orgRow.city,
    state: orgRow.state,
    websiteUrl: orgRow.website_url,
    codeOfConduct: orgRow.code_of_conduct,
    foundedYear: orgRow.founded_year ?? null,
    mission: orgRow.mission ?? null,
    facebookUrl: orgRow.facebook_url ?? null,
    instagramUrl: orgRow.instagram_url ?? null,
    ticketingUrl: orgRow.ticketing_url ?? null,
    createdAt: orgRow.created_at,
    updatedAt: orgRow.updated_at,
  };
}
