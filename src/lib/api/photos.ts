/**
 * Profile media — headshots, production photos, and resumes.
 * Cloud-only (Supabase Storage + profile_photos metadata table);
 * the profile page keeps its "Coming Soon" card in mock mode.
 */

import { getSupabase } from "@/lib/supabase/client";
import type { ID } from "@/types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export type ProfilePhoto = {
  id: ID;
  userId: ID;
  storagePath: string;
  kind: "headshot" | "production";
  caption: string | null;
  showTitle: string | null;
  sortOrder: number;
  createdAt: string;
  publicUrl: string;
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function rowToPhoto(r: any): ProfilePhoto {
  return {
    id: r.id,
    userId: r.user_id,
    storagePath: r.storage_path,
    kind: r.kind,
    caption: r.caption,
    showTitle: r.show_title,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    publicUrl: getSupabase().storage.from("photos").getPublicUrl(r.storage_path).data.publicUrl,
  };
}

function assertUploadable(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is over 10MB — try a smaller one.");
  }
}

export async function getProfilePhotos(userId: string): Promise<ProfilePhoto[]> {
  const { data, error } = await getSupabase()
    .from("profile_photos")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPhoto);
}

/**
 * Upload a new headshot: store the image, point profiles.avatar_url at it,
 * and replace any previous headshot metadata (old files are removed too).
 */
export async function uploadHeadshot(userId: string, file: File): Promise<ProfilePhoto> {
  assertUploadable(file);
  const supabase = getSupabase();
  const path = `${userId}/headshot-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const publicUrl = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;

  // Clean up the previous headshot (metadata + file), then record the new one.
  const { data: oldRows } = await supabase
    .from("profile_photos")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("kind", "headshot");
  if (oldRows && oldRows.length > 0) {
    await supabase.from("profile_photos").delete()
      .in("id", oldRows.map((r) => r.id));
    await supabase.storage.from("photos")
      .remove(oldRows.map((r) => r.storage_path));
  }

  const { data: row, error: metaError } = await supabase
    .from("profile_photos")
    .insert({ user_id: userId, storage_path: path, kind: "headshot" })
    .select("*")
    .single();
  if (metaError) throw new Error(metaError.message);

  const { error: avatarError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);
  if (avatarError) throw new Error(avatarError.message);

  return rowToPhoto(row);
}

export async function uploadProductionPhoto(
  userId: string,
  file: File,
  sortOrder: number
): Promise<ProfilePhoto> {
  assertUploadable(file);
  const supabase = getSupabase();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/production-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const { data: row, error: metaError } = await supabase
    .from("profile_photos")
    .insert({
      user_id: userId,
      storage_path: path,
      kind: "production",
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (metaError) throw new Error(metaError.message);
  return rowToPhoto(row);
}

export async function updatePhotoMeta(
  photoId: string,
  data: { caption: string | null; showTitle: string | null }
): Promise<ProfilePhoto> {
  const { data: row, error } = await getSupabase()
    .from("profile_photos")
    .update({ caption: data.caption, show_title: data.showTitle })
    .eq("id", photoId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToPhoto(row);
}

export async function deleteProfilePhoto(photo: ProfilePhoto): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("profile_photos").delete().eq("id", photo.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from("photos").remove([photo.storagePath]);
}

/**
 * Upload a resume PDF to the private bucket and save the storage PATH
 * (not a URL) on actor_details — reads go through short-lived signed URLs.
 */
export async function uploadResume(userId: string, file: File): Promise<string> {
  assertUploadable(file);
  const supabase = getSupabase();
  const path = `${userId}/resume-${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase
    .from("actor_details")
    .upsert({ user_id: userId, resume_pdf_url: path });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Upload a theatre logo to the public 'org-media' bucket and set orgs.logo_url.
 * Path `${orgId}/logo-${Date.now()}` keeps the first folder segment as the org
 * id so the org-media admin-write policy applies. Cloud-only — the hub guards
 * this in mock mode.
 */
export async function uploadOrgLogo(orgId: string, file: File): Promise<string> {
  assertUploadable(file);
  const supabase = getSupabase();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${orgId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("org-media")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const publicUrl = supabase.storage.from("org-media").getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("orgs").update({ logo_url: publicUrl }).eq("id", orgId);
  if (error) throw new Error(error.message);
  return publicUrl;
}

export async function getResumeSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from("resumes")
    .createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/**
 * Upload a show poster to the public 'org-media' bucket and set shows.poster_url.
 * Path convention `${orgId}/poster-${showId}-${Date.now()}` keeps the first
 * folder segment as the org id so the org-media admin-write policy applies.
 * Cloud-only — the show setup page hides this in mock mode.
 */
export async function uploadShowPoster(
  orgId: string,
  showId: string,
  file: File
): Promise<string> {
  assertUploadable(file);
  const supabase = getSupabase();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${orgId}/poster-${showId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("org-media")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const publicUrl = supabase.storage.from("org-media").getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("shows").update({ poster_url: publicUrl }).eq("id", showId);
  if (error) throw new Error(error.message);
  return publicUrl;
}
