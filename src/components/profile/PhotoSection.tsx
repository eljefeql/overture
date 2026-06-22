"use client";

import {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import {
  getProfilePhotos,
  uploadHeadshot,
  uploadProductionPhoto,
  updatePhotoMeta,
  deleteProfilePhoto,
  uploadResume,
  getResumeSignedUrl,
  MAX_UPLOAD_BYTES,
  type ProfilePhoto,
} from "@/lib/api/photos";
import {
  Card,
  Button,
  Input,
  SectionHeader,
  PrivacyHeader,
  useToast,
} from "@/components/ui";
import {
  Camera,
  Images,
  Plus,
  Trash,
  PencilSimple,
  CircleNotch,
  FilePdf,
  ArrowSquareOut,
} from "@phosphor-icons/react";

export type PhotoSectionHandle = {
  openHeadshotPicker: () => void;
};

type Props = {
  userId: string;
  displayName: string;
};

function fileTooBig(file: File) {
  return file.size > MAX_UPLOAD_BYTES;
}

/**
 * Headshot + production photo management. Cloud-only — the profile page
 * renders the old "Coming Soon" card while in mock mode.
 */
export const PhotoSection = forwardRef<PhotoSectionHandle, Props>(
  function PhotoSection({ userId, displayName }, ref) {
    const { toast } = useToast();
    const { updateUser } = useAuth();
    const queryClient = useQueryClient();

    const headshotInputRef = useRef<HTMLInputElement>(null);
    const productionInputRef = useRef<HTMLInputElement>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [caption, setCaption] = useState("");
    const [showTitle, setShowTitle] = useState("");
    const [uploadingCount, setUploadingCount] = useState(0);

    useImperativeHandle(ref, () => ({
      openHeadshotPicker: () => headshotInputRef.current?.click(),
    }));

    const { data: photos = [], isLoading } = useQuery({
      queryKey: ["profilePhotos", userId],
      queryFn: () => getProfilePhotos(userId),
    });

    const headshot = photos.find((p) => p.kind === "headshot") ?? null;
    const productionPhotos = photos.filter((p) => p.kind === "production");

    function invalidate() {
      queryClient.invalidateQueries({ queryKey: ["profilePhotos", userId] });
      queryClient.invalidateQueries({ queryKey: ["actor", userId] });
    }

    const headshotMutation = useMutation({
      mutationFn: (file: File) => uploadHeadshot(userId, file),
      onSuccess: (photo) => {
        updateUser({ avatarUrl: photo.publicUrl });
        invalidate();
        toast("success", "Headshot updated!");
      },
      onError: (err) =>
        toast("error", err instanceof Error ? err.message : "Upload failed."),
    });

    const metaMutation = useMutation({
      mutationFn: (photo: ProfilePhoto) =>
        updatePhotoMeta(photo.id, {
          caption: caption.trim() || null,
          showTitle: showTitle.trim() || null,
        }),
      onSuccess: () => {
        setEditingId(null);
        invalidate();
        toast("success", "Photo details saved.");
      },
      onError: () => toast("error", "Couldn't save photo details."),
    });

    const deleteMutation = useMutation({
      mutationFn: (photo: ProfilePhoto) => deleteProfilePhoto(photo),
      onSuccess: () => {
        setConfirmDeleteId(null);
        invalidate();
        toast("success", "Photo deleted.");
      },
      onError: () => toast("error", "Couldn't delete that photo."),
    });

    function handleHeadshotFile(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (fileTooBig(file)) {
        toast("error", "That file is over 10MB — try a smaller one.");
        return;
      }
      headshotMutation.mutate(file);
    }

    async function handleProductionFiles(e: React.ChangeEvent<HTMLInputElement>) {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;
      const valid = files.filter((f) => {
        if (fileTooBig(f)) {
          toast("error", `${f.name} is over 10MB — skipped.`);
          return false;
        }
        return true;
      });
      setUploadingCount(valid.length);
      let lastUploaded: ProfilePhoto | null = null;
      try {
        for (let i = 0; i < valid.length; i++) {
          lastUploaded = await uploadProductionPhoto(
            userId,
            valid[i],
            productionPhotos.length + i
          );
          setUploadingCount(valid.length - i - 1);
        }
        invalidate();
        toast("success", valid.length === 1 ? "Photo uploaded!" : `${valid.length} photos uploaded!`);
        // Offer the caption form on the photo just added.
        if (lastUploaded && valid.length === 1) {
          setCaption("");
          setShowTitle("");
          setEditingId(lastUploaded.id);
        }
      } catch (err) {
        invalidate();
        toast("error", err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploadingCount(0);
      }
    }

    function startEditing(photo: ProfilePhoto) {
      setCaption(photo.caption ?? "");
      setShowTitle(photo.showTitle ?? "");
      setConfirmDeleteId(null);
      setEditingId(photo.id);
    }

    return (
      <div>
        <SectionHeader>Photos</SectionHeader>

        {/* Hidden file inputs */}
        <input
          ref={headshotInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleHeadshotFile}
        />
        <input
          ref={productionInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleProductionFiles}
        />

        {/* ── Headshot ── */}
        <Card variant="flat" padding="standard" className="mb-4">
          <div className="flex items-center gap-4">
            {headshot ? (
              <img
                src={headshot.publicUrl}
                alt={`${displayName} headshot`}
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                <Camera className="w-7 h-7 text-stage-500" weight="duotone" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-curtain-900">Headshot</p>
              <p className="text-xs text-clay-500 mb-2">
                {headshot
                  ? "Shown on your profile and audition signups."
                  : "Directors see this first — add a clear, recent photo."}
              </p>
              <Button
                size="sm"
                variant="outline"
                loading={headshotMutation.isPending}
                onClick={() => headshotInputRef.current?.click()}
                icon={<Camera className="w-4 h-4" weight="bold" />}
              >
                {headshot ? "Replace Headshot" : "Upload Headshot"}
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Production photos ── */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-clay-500">
            Production photos show directors your range on stage.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => productionInputRef.current?.click()}
            loading={uploadingCount > 0}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Add Photos
          </Button>
        </div>

        {isLoading ? (
          <Card variant="flat" className="text-center py-8">
            <CircleNotch className="w-6 h-6 text-stage-500 animate-spin mx-auto" weight="bold" />
          </Card>
        ) : productionPhotos.length === 0 && uploadingCount === 0 ? (
          <Card variant="sunken" className="text-center py-12">
            <Images className="w-12 h-12 text-clay-300 mx-auto mb-3" weight="duotone" />
            <p className="text-sm text-clay-500 mb-4 max-w-xs mx-auto">
              No production photos yet. Add shots from past shows and tag them
              with the production.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => productionInputRef.current?.click()}
            >
              Upload Your First Photo
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {productionPhotos.map((photo) => (
              <Card key={photo.id} variant="elevated" padding="compact">
                <img
                  src={photo.publicUrl}
                  alt={photo.caption ?? "Production photo"}
                  className="w-full aspect-square rounded-lg object-cover mb-2"
                />

                {editingId === photo.id ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      label="Caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="As Éponine, Act II"
                    />
                    <Input
                      label="Show"
                      value={showTitle}
                      onChange={(e) => setShowTitle(e.target.value)}
                      placeholder="Les Misérables"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={metaMutation.isPending}
                        onClick={() => metaMutation.mutate(photo)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : confirmDeleteId === photo.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-curtain-800">Delete this photo?</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(photo)}
                      >
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {photo.caption && (
                        <p className="text-xs text-curtain-800 truncate">
                          {photo.caption}
                        </p>
                      )}
                      {photo.showTitle && (
                        <p className="text-xs font-display text-curtain-900 truncate">
                          {photo.showTitle}
                        </p>
                      )}
                      {!photo.caption && !photo.showTitle && (
                        <button
                          onClick={() => startEditing(photo)}
                          className="text-xs text-clay-400 hover:text-curtain-700 transition-colors"
                        >
                          Add caption
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEditing(photo)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                        aria-label="Edit photo details"
                      >
                        <PencilSimple className="w-3.5 h-3.5" weight="bold" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setConfirmDeleteId(photo.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-600 hover:bg-cream-100 transition-colors"
                        aria-label="Delete photo"
                      >
                        <Trash className="w-3.5 h-3.5" weight="bold" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {uploadingCount > 0 && (
              <Card variant="flat" padding="compact" className="flex items-center justify-center aspect-square">
                <div className="text-center">
                  <CircleNotch className="w-6 h-6 text-stage-500 animate-spin mx-auto mb-2" weight="bold" />
                  <p className="text-xs text-clay-500">
                    Uploading{uploadingCount > 1 ? ` (${uploadingCount} left)` : ""}&hellip;
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  }
);

/**
 * Resume upload + signed-URL view link. Lives in the Private section of the
 * profile (the resumes bucket is private; reads use 60s signed URLs).
 */
export function ResumeSection({
  userId,
  resumePath,
}: {
  userId: string;
  resumePath: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadResume(userId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actor", userId] });
      toast("success", "Resume uploaded!");
    },
    onError: (err) =>
      toast("error", err instanceof Error ? err.message : "Upload failed."),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast("error", "That file is over 10MB — try a smaller one.");
      return;
    }
    uploadMutation.mutate(file);
  }

  async function handleView() {
    if (!resumePath) return;
    setViewLoading(true);
    try {
      const url = await getResumeSignedUrl(resumePath);
      window.open(url, "_blank", "noopener");
    } catch {
      toast("error", "Couldn't open your resume. Try again.");
    } finally {
      setViewLoading(false);
    }
  }

  return (
    <div>
      <PrivacyHeader title="Resume" />
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />
      <Card variant="flat" padding="compact">
        <div className="flex items-center gap-3">
          <FilePdf className="w-5 h-5 text-stage-500 flex-shrink-0" weight="duotone" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-curtain-900">
              {resumePath ? "Resume on file" : "No resume yet"}
            </p>
            <p className="text-xs text-clay-500">
              {resumePath
                ? "Shared with production teams for shows you join."
                : "Upload a PDF resume for production teams."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {resumePath && (
              <Button
                size="sm"
                variant="ghost"
                loading={viewLoading}
                onClick={handleView}
                icon={<ArrowSquareOut className="w-4 h-4" weight="bold" />}
              >
                View
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              loading={uploadMutation.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {resumePath ? "Replace" : "Upload PDF"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
