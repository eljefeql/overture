"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShow,
  getShowRoles,
  getShowTeam,
  getAuditionGroups,
  getAuditionSignups,
  getCallbacks,
  updateShow,
  createShowRole,
  updateShowRole,
  deleteShowRole,
  addTeamMember,
  removeTeamMember,
  createAuditionGroup,
  updateAuditionGroup,
  deleteAuditionGroup,
} from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Pill,
  PageSkeleton,
  StatBlock,
  SectionHeader,
  EmptyState,
  Input,
  Textarea,
  Modal,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate, formatTeamRole } from "@/lib/utils";
import {
  PencilSimple,
  Plus,
  Trash,
  Play,
  Pause,
  ArrowRight,
  Warning,
  Calendar,
  MapPin,
  Users,
  MaskHappy,
} from "@phosphor-icons/react";
import { SHOW_STATUS_LABELS } from "@/lib/constants";
import type { ShowStatus, ShowType, RoleType, GenderReq, TeamRole } from "@/types";

/* ============================================================
   Show Setup — Home base for a show. View + edit all config.
   ============================================================ */

const NEXT_STATUS: Partial<Record<ShowStatus, { label: string; next: ShowStatus; confirm: string }>> = {
  setup: { label: "Open Auditions", next: "auditions_open", confirm: "Open auditions? Your show will appear in the Discover feed for actors." },
  auditions_open: { label: "Close Auditions", next: "auditions_closed", confirm: "Close auditions? No new signups will be accepted." },
  auditions_closed: { label: "Move to Callbacks", next: "callbacks", confirm: "Move to the callback phase?" },
  callbacks: { label: "Move to Casting", next: "casting", confirm: "Move to casting? Make sure all callbacks have been sent." },
  casting: { label: "Publish Cast List", next: "cast", confirm: "Publish the cast list? This will notify all actors." },
};

const SHOW_TYPES: { value: ShowType; label: string }[] = [
  { value: "musical", label: "Musical" },
  { value: "play", label: "Play" },
  { value: "revue", label: "Revue" },
];

const ROLE_TYPES: { value: RoleType; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "supporting", label: "Supporting" },
  { value: "featured_ensemble", label: "Featured Ensemble" },
  { value: "ensemble", label: "Ensemble" },
];

const GENDER_OPTIONS: { value: GenderReq; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
];

const TEAM_ROLES: { value: TeamRole; label: string }[] = [
  { value: "director", label: "Director" },
  { value: "music_director", label: "Music Director" },
  { value: "choreographer", label: "Choreographer" },
  { value: "stage_manager", label: "Stage Manager" },
  { value: "producer", label: "Producer" },
  { value: "asst_director", label: "Asst. Director" },
  { value: "asst_stage_manager", label: "Asst. SM" },
  { value: "accompanist", label: "Accompanist" },
];

export default function ShowSetupPage() {
  const { showId } = useParams<{ showId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Edit details form
  const [editForm, setEditForm] = useState({
    title: "", authorInfo: "", showType: "musical" as ShowType,
    season: "", city: "", state: "", auditionLocation: "",
    auditionStart: "", auditionEnd: "", callbackDate: "",
    callbackLocation: "", auditionNotes: "",
    rehearsalStart: "", showOpen: "", showClose: "",
  });

  // Add role form
  const [roleDraft, setRoleDraft] = useState({
    name: "", roleType: "lead" as RoleType, gender: "any" as GenderReq,
    ageRange: "", vocalRange: "", description: "",
  });

  // Edit role form
  const [editRoleDraft, setEditRoleDraft] = useState({
    name: "", roleType: "lead" as RoleType, gender: "any" as GenderReq,
    ageRange: "", vocalRange: "", description: "",
  });

  // Add slot form — date is the audition day, times are HH:MM
  const [slotDraft, setSlotDraft] = useState({
    name: "", date: "", startTime: "", endTime: "", slotCount: 5,
  });

  // Add member form
  const [memberDraft, setMemberDraft] = useState({
    name: "", email: "", role: "stage_manager" as TeamRole, canEvaluate: false, phone: "",
  });

  // ── Data fetching ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["showSetup", showId],
    queryFn: async () => {
      const [show, roles, team, groups, signups, cbs] = await Promise.all([
        getShow(showId),
        getShowRoles(showId),
        getShowTeam(showId),
        getAuditionGroups(showId),
        getAuditionSignups(showId),
        getCallbacks(showId),
      ]);
      return { show, roles, team, groups, signups, callbacks: cbs };
    },
  });

  // ── Mutations ──
  const statusMutation = useMutation({
    mutationFn: (newStatus: ShowStatus) => updateShow(showId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Show status updated!");
      setConfirmOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const updateShowMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => updateShow(showId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      queryClient.invalidateQueries({ queryKey: ["show", showId] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Show details updated!");
      setEditDetailsOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const addRoleMutation = useMutation({
    mutationFn: createShowRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", "Role added!");
      setRoleDraft({ name: "", roleType: "lead", gender: "any", ageRange: "", vocalRange: "", description: "" });
      setAddRoleOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const editRoleMutation = useMutation({
    mutationFn: ({ roleId, updates }: { roleId: string; updates: Record<string, unknown> }) =>
      updateShowRole(roleId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", "Role updated!");
      setEditRoleOpen(false);
      setEditRoleId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteShowRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("info", "Role removed.");
    },
  });

  const addSlotMutation = useMutation({
    mutationFn: createAuditionGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", "Time slot added!");
      setSlotDraft({ name: "", date: "", startTime: "", endTime: "", slotCount: 5 });
      setAddSlotOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteAuditionGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("info", "Time slot removed.");
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: addTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("success", "Team member added!");
      setMemberDraft({ name: "", email: "", role: "stage_manager", canEvaluate: false, phone: "" });
      setAddMemberOpen(false);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
      toast("info", "Team member removed.");
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.show) return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <EmptyState
        icon={<Warning className="w-12 h-12" weight="duotone" />}
        title="Unable to load show"
        description="Something went wrong loading this show. Please try again."
        action={<Button onClick={() => window.location.reload()}>Reload Page</Button>}
      />
    </div>
  );

  const { show, roles, team, groups, signups, callbacks: cbs } = data;
  const nextAction = NEXT_STATUS[show.status];

  // Stats
  const signupCount = signups.length;
  const checkedIn = signups.filter((s) => s.status === "checked_in").length;
  const auditioned = signups.filter((s) => s.status === "auditioned").length;
  const callbackCount = cbs.length;
  const accepted = cbs.filter((c) => c.status === "accepted").length;

  // Open edit details with current values pre-filled
  const openEditDetails = () => {
    setEditForm({
      title: show.title,
      authorInfo: show.authorInfo ?? "",
      showType: show.showType,
      season: show.season ?? "",
      city: show.city,
      state: show.state,
      auditionLocation: show.auditionLocation ?? "",
      auditionStart: show.auditionStart ?? "",
      auditionEnd: show.auditionEnd ?? "",
      callbackDate: show.callbackDate ?? "",
      callbackLocation: show.callbackLocation ?? "",
      auditionNotes: show.auditionNotes ?? "",
      rehearsalStart: show.rehearsalStart ?? "",
      showOpen: show.showOpen ?? "",
      showClose: show.showClose ?? "",
    });
    setEditDetailsOpen(true);
  };

  const submitEditDetails = () => {
    if (!editForm.title.trim()) {
      toast("error", "Show title is required.");
      return;
    }
    if (!editForm.city.trim()) {
      toast("error", "City is required.");
      return;
    }
    // Date validation
    if (editForm.auditionStart && editForm.auditionEnd && editForm.auditionEnd < editForm.auditionStart) {
      toast("error", "Audition end date must be after start date.");
      return;
    }
    if (editForm.auditionEnd && editForm.callbackDate && editForm.callbackDate < editForm.auditionEnd) {
      toast("error", "Callback date should be after auditions end.");
      return;
    }
    if (editForm.showOpen && editForm.showClose && editForm.showClose < editForm.showOpen) {
      toast("error", "Show close date must be after opening date.");
      return;
    }
    if (editForm.rehearsalStart && editForm.showOpen && editForm.rehearsalStart > editForm.showOpen) {
      toast("error", "Rehearsal should start before opening night.");
      return;
    }
    updateShowMutation.mutate(editForm);
  };

  const openEditRole = (role: typeof roles[0]) => {
    setEditRoleId(role.id);
    setEditRoleDraft({
      name: role.name,
      roleType: role.roleType,
      gender: role.gender ?? "any",
      ageRange: role.ageRange ?? "",
      vocalRange: role.vocalRange ?? "",
      description: role.description ?? "",
    });
    setEditRoleOpen(true);
  };

  const submitEditRole = () => {
    if (!editRoleId || !editRoleDraft.name.trim()) {
      toast("error", "Role name is required.");
      return;
    }
    editRoleMutation.mutate({
      roleId: editRoleId,
      updates: {
        name: editRoleDraft.name.trim(),
        roleType: editRoleDraft.roleType,
        gender: editRoleDraft.gender,
        ageRange: editRoleDraft.ageRange || null,
        vocalRange: editRoleDraft.vocalRange || null,
        description: editRoleDraft.description || null,
      },
    });
  };

  const submitRole = () => {
    if (!roleDraft.name.trim()) {
      toast("error", "Role name is required.");
      return;
    }
    addRoleMutation.mutate({
      showId,
      name: roleDraft.name.trim(),
      roleType: roleDraft.roleType,
      gender: roleDraft.gender,
      ageRange: roleDraft.ageRange || null,
      vocalRange: roleDraft.vocalRange || null,
      description: roleDraft.description || null,
      sortOrder: roles.length,
    });
  };

  // Build the list of audition dates available based on show.auditionStart/auditionEnd
  const auditionDates = (() => {
    const dates: string[] = [];
    if (!show.auditionStart) return dates;
    const start = new Date(show.auditionStart + "T00:00:00");
    const endStr = show.auditionEnd ?? show.auditionStart;
    const end = new Date(endStr + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  })();
  const singleAuditionDate = auditionDates.length === 1 ? auditionDates[0] : null;

  const submitSlot = () => {
    if (!slotDraft.name.trim() || !slotDraft.startTime || !slotDraft.endTime) {
      toast("error", "Name, start time, and end time are required.");
      return;
    }
    if (slotDraft.endTime <= slotDraft.startTime) {
      toast("error", "End time must be after start time.");
      return;
    }
    // Date: prefer slotDraft.date, then single audition date, then auditionStart
    const dateStr =
      slotDraft.date || singleAuditionDate || show.auditionStart || "";
    if (!dateStr) {
      toast("error", "Set the audition date in show details before adding time slots.");
      return;
    }
    // Combine date + time into a local ISO string
    const startISO = new Date(`${dateStr}T${slotDraft.startTime}:00`).toISOString();
    const endISO = new Date(`${dateStr}T${slotDraft.endTime}:00`).toISOString();
    addSlotMutation.mutate({
      showId,
      name: slotDraft.name.trim(),
      startTime: startISO,
      endTime: endISO,
      slotCount: slotDraft.slotCount,
      sortOrder: groups.length,
    });
  };

  const submitMember = () => {
    if (!memberDraft.name.trim()) {
      toast("error", "Name is required.");
      return;
    }
    addMemberMutation.mutate({
      showId,
      userId: `user-${Date.now()}`,
      userName: memberDraft.name.trim(),
      role: memberDraft.role,
      canEvaluate: memberDraft.canEvaluate,
      email: memberDraft.email || null,
      phone: memberDraft.phone || null,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ── Show Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-display text-curtain-900">{show.title}</h1>
            <Badge variant={show.status === "auditions_open" || show.status === "cast" ? "success" : "default"} size="md">
              {SHOW_STATUS_LABELS[show.status]}
            </Badge>
          </div>
          {show.authorInfo && (
            <p className="text-sm text-clay-500">{show.authorInfo}</p>
          )}
          <div className="flex items-center gap-3 text-sm text-clay-500 mt-1">
            <Pill variant="status" className="cursor-default">{show.showType === "musical" ? "Musical" : show.showType === "play" ? "Play" : "Revue"}</Pill>
            {show.season && <span>{show.season}</span>}
          </div>
        </div>

        {nextAction && (
          <Button
            onClick={() => setConfirmOpen(true)}
            icon={show.status === "auditions_open" ? <Pause className="w-4 h-4" weight="bold" /> : <Play className="w-4 h-4" weight="bold" />}
          >
            {nextAction.label}
          </Button>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
        <StatBlock label="Signups" value={String(signupCount)} />
        <StatBlock label="Checked In" value={String(checkedIn)} />
        <StatBlock label="Auditioned" value={String(auditioned)} />
        <StatBlock label="Callbacks" value={String(callbackCount)} />
        <StatBlock label="Accepted" value={String(accepted)} />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Details Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle>Show Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={openEditDetails} icon={<PencilSimple className="w-4 h-4" weight="bold" />}>
                Edit
              </Button>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {show.auditionStart && (
                <div className="flex items-center gap-2 text-curtain-800">
                  <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
                  Auditions: {formatDate(show.auditionStart)}{show.auditionEnd && show.auditionEnd !== show.auditionStart ? ` – ${formatDate(show.auditionEnd)}` : ""}
                </div>
              )}
              {show.callbackDate && (
                <div className="flex items-center gap-2 text-curtain-800">
                  <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
                  Callbacks: {formatDate(show.callbackDate)}
                </div>
              )}
              {show.auditionLocation && (
                <div className="flex items-center gap-2 text-curtain-800 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-stage-500" weight="duotone" />
                  {show.auditionLocation}
                </div>
              )}
              {show.auditionNotes && (
                <p className="text-xs text-clay-500 sm:col-span-2 mt-2">
                  {show.auditionNotes}
                </p>
              )}
            </div>
          </Card>

          {/* Roles Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "150ms" }}>
            <CardHeader>
              <CardTitle>Roles ({roles.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddRoleOpen(true)} icon={<Plus className="w-4 h-4" weight="bold" />}>
                Add
              </Button>
            </CardHeader>
            {roles.length > 0 ? (
              <div className="flex flex-col gap-2">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                    <button
                      onClick={() => openEditRole(role)}
                      className="flex items-center gap-2 hover:opacity-70 transition text-left"
                    >
                      <span className="text-sm font-semibold text-curtain-900">{role.name}</span>
                      <Badge variant="default" size="sm">{role.roleType}</Badge>
                      {role.gender && (
                        <span className="text-xs text-clay-400">{role.gender === "any" ? "any gender" : role.gender}</span>
                      )}
                      <PencilSimple className="w-3 h-3 text-clay-300" weight="bold" />
                    </button>
                    <button
                      onClick={() => deleteRoleMutation.mutate(role.id)}
                      className="text-clay-300 hover:text-ruby-500 transition p-1"
                    >
                      <Trash className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay-500">No roles defined yet.</p>
            )}
          </Card>

          {/* Schedule Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle>Audition Schedule ({groups.length} slots)</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddSlotOpen(true)} icon={<Plus className="w-4 h-4" weight="bold" />}>
                Add
              </Button>
            </CardHeader>
            {groups.length > 0 ? (
              <div className="flex flex-col gap-2">
                {groups.map((group) => {
                  const filled = signups.filter((s) => s.groupId === group.id).length;
                  return (
                    <div key={group.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                      <div>
                        <span className="text-sm font-semibold text-curtain-900">{group.name}</span>
                        <span className="text-xs text-clay-500 ml-2">
                          {new Date(group.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {" – "}
                          {new Date(group.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${filled >= group.slotCount ? "text-ruby-500" : "text-clay-500"}`}>
                          {filled}/{group.slotCount} filled{filled >= group.slotCount ? " · Full" : ""}
                        </span>
                        <button
                          onClick={() => deleteGroupMutation.mutate(group.id)}
                          className="text-clay-300 hover:text-ruby-500 transition p-1"
                        >
                          <Trash className="w-4 h-4" weight="bold" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-clay-500">No time slots defined yet.</p>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Team Card */}
          <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle>Team ({team.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddMemberOpen(true)} icon={<Plus className="w-4 h-4" weight="bold" />}>
                Add
              </Button>
            </CardHeader>
            {team.length > 0 ? (
              <div className="flex flex-col gap-3">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-curtain-900">{member.userName}</span>
                      </div>
                      <p className="text-xs text-clay-500">{formatTeamRole(member.role)}{member.canEvaluate ? " · Evaluator" : ""}</p>
                    </div>
                    <button
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      className="text-clay-300 hover:text-ruby-500 transition p-1"
                    >
                      <Trash className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay-500">No team members yet.</p>
            )}
          </Card>

          {/* Quick Actions */}
          <Card variant="flat" className="animate-fade-up" style={{ animationDelay: "150ms" }}>
            <SectionHeader>Quick Actions</SectionHeader>
            <div className="flex flex-col gap-2">
              {show.status === "setup" && nextAction && (
                <Button size="sm" className="w-full justify-center" onClick={() => setConfirmOpen(true)} icon={<Play className="w-4 h-4" weight="bold" />}>
                  {nextAction.label}
                </Button>
              )}
              {(show.status === "auditions_open" || show.status === "auditions_closed") && (
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => router.push(`/shows/${showId}/auditions`)} icon={<Users className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  View Audition Schedule
                </Button>
              )}
              {show.status === "callbacks" && (
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => router.push(`/shows/${showId}/callbacks`)} icon={<MaskHappy className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  Manage Callbacks
                </Button>
              )}
              {show.status === "casting" && (
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => router.push(`/shows/${showId}/casting`)} icon={<MaskHappy className="w-4 h-4 text-stage-500" weight="duotone" />}>
                  Go to Casting Board
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Status Transition Confirmation Modal ── */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Status Change">
        <div className="flex flex-col items-center text-center py-4">
          <Warning className="w-12 h-12 text-stage-500 mb-3" weight="duotone" />
          <p className="text-sm text-curtain-800 mb-4">
            {nextAction?.confirm}
          </p>
          {/* Guardrails — warn about missing prerequisites */}
          {show.status === "setup" && roles.length === 0 && (
            <p className="text-xs text-ruby-500 mb-2">You haven&apos;t defined any roles yet. Actors won&apos;t know what to audition for.</p>
          )}
          {show.status === "setup" && groups.length === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No audition time slots defined. Actors won&apos;t be able to sign up.</p>
          )}
          {show.status === "auditions_closed" && signupCount === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No actors have signed up yet. Are you sure you want to move to callbacks?</p>
          )}
          {show.status === "callbacks" && callbackCount === 0 && (
            <p className="text-xs text-ruby-500 mb-2">No callbacks have been created yet. Moving to casting with no callback pool.</p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => nextAction && statusMutation.mutate(nextAction.next)}
              loading={statusMutation.isPending}
            >
              {nextAction?.label}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Show Details Modal ── */}
      <Modal open={editDetailsOpen} onClose={() => setEditDetailsOpen(false)} title="Edit Show Details">
        <div className="py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Title *</label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Author / Composer</label>
              <Input value={editForm.authorInfo} onChange={(e) => setEditForm({ ...editForm, authorInfo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Show Type *</label>
              <select
                value={editForm.showType}
                onChange={(e) => setEditForm({ ...editForm, showType: e.target.value as ShowType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {SHOW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Season</label>
              <Input value={editForm.season} onChange={(e) => setEditForm({ ...editForm, season: e.target.value })} placeholder="e.g. 2026-2027" />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">City *</label>
              <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">State</label>
              <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </div>
          </div>

          <hr className="border-cream-100" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Start</label>
              <Input type="date" value={editForm.auditionStart} onChange={(e) => setEditForm({ ...editForm, auditionStart: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition End</label>
              <Input type="date" value={editForm.auditionEnd} onChange={(e) => setEditForm({ ...editForm, auditionEnd: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Callback Date</label>
              <Input type="date" value={editForm.callbackDate} onChange={(e) => setEditForm({ ...editForm, callbackDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Rehearsal Start</label>
              <Input type="date" value={editForm.rehearsalStart} onChange={(e) => setEditForm({ ...editForm, rehearsalStart: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Show Opens</label>
              <Input type="date" value={editForm.showOpen} onChange={(e) => setEditForm({ ...editForm, showOpen: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Show Closes</label>
              <Input type="date" value={editForm.showClose} onChange={(e) => setEditForm({ ...editForm, showClose: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Location</label>
              <Input value={editForm.auditionLocation} onChange={(e) => setEditForm({ ...editForm, auditionLocation: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Callback Location</label>
              <Input value={editForm.callbackLocation} onChange={(e) => setEditForm({ ...editForm, callbackLocation: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Notes</label>
              <Textarea value={editForm.auditionNotes} onChange={(e) => setEditForm({ ...editForm, auditionNotes: e.target.value })} rows={3} placeholder="Preparation instructions, what to bring, etc." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditDetailsOpen(false)}>Cancel</Button>
            <Button onClick={submitEditDetails} loading={updateShowMutation.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Role Modal ── */}
      <Modal open={addRoleOpen} onClose={() => setAddRoleOpen(false)} title="Add Role">
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Role Name *</label>
            <Input value={roleDraft.name} onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })} placeholder="e.g. Baker" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Type</label>
              <select
                value={roleDraft.roleType}
                onChange={(e) => setRoleDraft({ ...roleDraft, roleType: e.target.value as RoleType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {ROLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Gender</label>
              <select
                value={roleDraft.gender}
                onChange={(e) => setRoleDraft({ ...roleDraft, gender: e.target.value as GenderReq })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Age Range</label>
              <Input value={roleDraft.ageRange} onChange={(e) => setRoleDraft({ ...roleDraft, ageRange: e.target.value })} placeholder="e.g. 30-50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Vocal Range</label>
              <Input value={roleDraft.vocalRange} onChange={(e) => setRoleDraft({ ...roleDraft, vocalRange: e.target.value })} placeholder="e.g. Baritone" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Description</label>
            <Textarea value={roleDraft.description} onChange={(e) => setRoleDraft({ ...roleDraft, description: e.target.value })} rows={2} placeholder="Brief character description" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddRoleOpen(false)}>Cancel</Button>
            <Button onClick={submitRole} loading={addRoleMutation.isPending}>Add Role</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Time Slot Modal ── */}
      <Modal open={addSlotOpen} onClose={() => setAddSlotOpen(false)} title="Add Time Slot">
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Slot Name *</label>
            <Input value={slotDraft.name} onChange={(e) => setSlotDraft({ ...slotDraft, name: e.target.value })} placeholder="e.g. Group 3" />
          </div>
          {/* Date selection — only shown when there are multiple audition dates */}
          {auditionDates.length > 1 ? (
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Date *</label>
              <select
                value={slotDraft.date}
                onChange={(e) => setSlotDraft({ ...slotDraft, date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                <option value="">Select a date</option>
                {auditionDates.map((d) => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
            </div>
          ) : auditionDates.length === 1 ? (
            <div className="text-xs text-clay-500">
              <span className="font-semibold text-curtain-700">Date:</span> {formatDate(auditionDates[0])}
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Audition Date *</label>
              <Input
                type="date"
                value={slotDraft.date}
                onChange={(e) => setSlotDraft({ ...slotDraft, date: e.target.value })}
              />
              <p className="text-[11px] text-clay-400 mt-1">Set audition dates in show details to skip this step.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Start Time *</label>
              <Input type="time" value={slotDraft.startTime} onChange={(e) => setSlotDraft({ ...slotDraft, startTime: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">End Time *</label>
              <Input type="time" value={slotDraft.endTime} onChange={(e) => setSlotDraft({ ...slotDraft, endTime: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Slot Count</label>
            <Input type="number" min={1} max={50} value={slotDraft.slotCount} onChange={(e) => setSlotDraft({ ...slotDraft, slotCount: parseInt(e.target.value) || 5 })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddSlotOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitSlot} loading={addSlotMutation.isPending}>Add Slot</Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Role Modal ── */}
      <Modal open={editRoleOpen} onClose={() => { setEditRoleOpen(false); setEditRoleId(null); }} title="Edit Role">
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Role Name *</label>
            <Input value={editRoleDraft.name} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Type</label>
              <select
                value={editRoleDraft.roleType}
                onChange={(e) => setEditRoleDraft({ ...editRoleDraft, roleType: e.target.value as RoleType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {ROLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Gender</label>
              <select
                value={editRoleDraft.gender}
                onChange={(e) => setEditRoleDraft({ ...editRoleDraft, gender: e.target.value as GenderReq })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Age Range</label>
              <Input value={editRoleDraft.ageRange} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, ageRange: e.target.value })} placeholder="e.g. 30-50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Vocal Range</label>
              <Input value={editRoleDraft.vocalRange} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, vocalRange: e.target.value })} placeholder="e.g. Baritone" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Description</label>
            <Textarea value={editRoleDraft.description} onChange={(e) => setEditRoleDraft({ ...editRoleDraft, description: e.target.value })} rows={2} placeholder="Brief character description" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setEditRoleOpen(false); setEditRoleId(null); }}>Cancel</Button>
            <Button onClick={submitEditRole} loading={editRoleMutation.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Team Member Modal ── */}
      <Modal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Add Team Member">
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Name *</label>
            <Input value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Email</label>
            <Input type="email" value={memberDraft.email} onChange={(e) => setMemberDraft({ ...memberDraft, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Role</label>
              <select
                value={memberDraft.role}
                onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value as TeamRole })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900"
              >
                {TEAM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">Phone</label>
              <Input type="tel" value={memberDraft.phone} onChange={(e) => setMemberDraft({ ...memberDraft, phone: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={memberDraft.canEvaluate} onChange={(e) => setMemberDraft({ ...memberDraft, canEvaluate: e.target.checked })} className="accent-stage-500 w-4 h-4" />
            <span className="text-sm text-curtain-800">Can evaluate actors (leave notes, shortlist)</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={submitMember} loading={addMemberMutation.isPending}>Add Member</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
