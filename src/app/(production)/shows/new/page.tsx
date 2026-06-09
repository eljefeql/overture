"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import {
  createShow,
  createShowRole,
  deleteShowRole,
  createAuditionGroup,
  addTeamMember,
} from "@/lib/api/client";
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  SectionHeader,
} from "@/components/ui";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { useToast } from "@/components/ui/Toast";
import {
  Trash,
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
} from "@phosphor-icons/react";
import type { Show, ShowRole, AuditionGroup, ShowTeamMember, ShowType, RoleType, GenderReq, TeamRole } from "@/types";

/* ============================================================
   Show Creation Wizard — 4-step guided flow
   ============================================================ */

const STEPS = ["Details", "Roles", "Schedule", "Team"];

type RoleDraft = {
  name: string;
  roleType: RoleType;
  gender: GenderReq;
  ageRange: string;
  vocalRange: string;
  description: string;
};

type GroupDraft = {
  name: string;
  startTime: string;
  endTime: string;
  slotCount: number;
};

type MemberDraft = {
  userName: string;
  email: string;
  role: TeamRole;
  canEvaluate: boolean;
  phone: string;
};

const emptyRole: RoleDraft = { name: "", roleType: "lead", gender: "any", ageRange: "", vocalRange: "", description: "" };
const emptyGroup: GroupDraft = { name: "", startTime: "", endTime: "", slotCount: 5 };
const emptyMember: MemberDraft = { userName: "", email: "", role: "director", canEvaluate: true, phone: "" };

export default function NewShowPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [showId, setShowId] = useState<string | null>(null);

  // Step 1 — Details
  const [title, setTitle] = useState("");
  const [showType, setShowType] = useState<ShowType>("musical");
  const [authorInfo, setAuthorInfo] = useState("");
  const [season, setSeason] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [auditionLocation, setAuditionLocation] = useState("");
  const [auditionNotes, setAuditionNotes] = useState("");
  const [auditionStart, setAuditionStart] = useState("");
  const [auditionEnd, setAuditionEnd] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [rehearsalStart, setRehearsalStart] = useState("");
  const [showOpen, setShowOpen] = useState("");
  const [showClose, setShowClose] = useState("");

  // Step 2 — Roles
  const [roles, setRoles] = useState<(ShowRole)[]>([]);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(emptyRole);
  const [addingRole, setAddingRole] = useState(false);

  // Step 3 — Schedule
  const [groups, setGroups] = useState<(AuditionGroup)[]>([]);
  const [groupDraft, setGroupDraft] = useState<GroupDraft>(emptyGroup);
  const [addingGroup, setAddingGroup] = useState(false);

  // Step 4 — Team
  const [members, setMembers] = useState<(ShowTeamMember)[]>([]);
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(emptyMember);
  const [addingMember, setAddingMember] = useState(false);

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // ── Mutations ──

  const createShowMutation = useMutation({
    mutationFn: () =>
      createShow({
        orgId: user?.id?.startsWith("user-team") ? "org-1" : "org-1", // TODO: derive from auth context org membership
        orgName: "North County Theatre", // TODO: derive from org data
        title,
        authorInfo: authorInfo || null,
        showType,
        season: season || null,
        status: "setup",
        auditionStart: auditionStart || null,
        auditionEnd: auditionEnd || null,
        callbackDate: callbackDate || null,
        callbackStartTime: null,
        callbackEndTime: null,
        rehearsalStart: rehearsalStart || null,
        showOpen: showOpen || null,
        showClose: showClose || null,
        auditionLocation: auditionLocation || null,
        auditionNotes: auditionNotes || null,
        callbackLocation: null,
        callbackNotes: null,
        performanceLocation: null,
        callbackContactName: null,
        callbackContactPhone: null,
        city,
        state,
        distanceMiles: null,
        isPromoted: false,
      }),
    onSuccess: (newShow) => {
      setShowId(newShow.id);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast("success", "Show created!");
      setStep(1);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const createRoleMutation = useMutation({
    mutationFn: (draft: RoleDraft) =>
      createShowRole({
        showId: showId!,
        name: draft.name,
        roleType: draft.roleType,
        gender: draft.gender,
        ageRange: draft.ageRange || null,
        vocalRange: draft.vocalRange || null,
        description: draft.description || null,
        sortOrder: roles.length,
      }),
    onSuccess: (newRole) => {
      setRoles((prev) => [...prev, newRole]);
      setRoleDraft(emptyRole);
      setAddingRole(false);
      toast("success", "Role added!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteShowRole,
    onSuccess: (_, roleId) => {
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      toast("info", "Role removed.");
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (draft: GroupDraft) =>
      createAuditionGroup({
        showId: showId!,
        name: draft.name,
        startTime: draft.startTime,
        endTime: draft.endTime,
        slotCount: draft.slotCount,
        sortOrder: groups.length,
      }),
    onSuccess: (newGroup) => {
      setGroups((prev) => [...prev, newGroup]);
      setGroupDraft(emptyGroup);
      setAddingGroup(false);
      toast("success", "Time slot added!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const addMemberMutation = useMutation({
    mutationFn: (draft: MemberDraft) =>
      addTeamMember({
        showId: showId!,
        userId: `user-${Date.now()}`,
        userName: draft.userName,
        role: draft.role,
        canEvaluate: draft.canEvaluate,
        email: draft.email || null,
        phone: draft.phone || null,
      }),
    onSuccess: (newMember) => {
      setMembers((prev) => [...prev, newMember]);
      setMemberDraft(emptyMember);
      setAddingMember(false);
      toast("success", "Team member added!");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  // ── Step 1 validation ──

  const step1Valid = title.trim() !== "" && city.trim() !== "" && state.trim() !== "";

  function handleStep1Submit() {
    setHasAttemptedSubmit(true);
    if (!step1Valid) return;

    // Date validation
    if (auditionStart && auditionEnd && auditionEnd < auditionStart) {
      toast("error", "Audition end date must be after start date.");
      return;
    }
    if (auditionEnd && callbackDate && callbackDate < auditionEnd) {
      toast("error", "Callback date should be after auditions end.");
      return;
    }
    if (showOpen && showClose && showClose < showOpen) {
      toast("error", "Show close date must be after opening date.");
      return;
    }
    if (rehearsalStart && showOpen && rehearsalStart > showOpen) {
      toast("error", "Rehearsal should start before opening night.");
      return;
    }

    createShowMutation.mutate();
  }

  // ── Render ──

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <StepIndicator steps={STEPS} currentStep={step} />

      {/* ═══════════════════════════════════════════
          STEP 1 — Show Details
          ═══════════════════════════════════════════ */}
      {step === 0 && (
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display text-curtain-900 mb-1">
            Create a Show
          </h1>
          <p className="text-sm text-clay-500 mb-6">
            Start with the basics. You can always edit these later.
          </p>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Show Title *"
                placeholder="Into the Woods"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={hasAttemptedSubmit && !title.trim() ? "Title is required" : undefined}
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-curtain-700 tracking-wide">
                  Show Type *
                </label>
                <select
                  value={showType}
                  onChange={(e) => setShowType(e.target.value as ShowType)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300"
                >
                  <option value="musical">Musical</option>
                  <option value="play">Play</option>
                  <option value="revue">Revue</option>
                </select>
              </div>
            </div>

            <Input
              label="Author / Composer Info"
              placeholder="Music & Lyrics: Stephen Sondheim, Book: James Lapine"
              value={authorInfo}
              onChange={(e) => setAuthorInfo(e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="City *"
                placeholder="Riverside"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                error={hasAttemptedSubmit && !city.trim() ? "City is required" : undefined}
              />
              <Input
                label="State *"
                placeholder="CA"
                value={state}
                onChange={(e) => setState(e.target.value)}
                error={hasAttemptedSubmit && !state.trim() ? "State is required" : undefined}
              />
              <Input
                label="Season"
                placeholder="2026-2027"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              />
            </div>

            <Input
              label="Audition Location"
              placeholder="NCT Main Stage, 1234 Oak Ave, Riverside"
              value={auditionLocation}
              onChange={(e) => setAuditionLocation(e.target.value)}
            />

            <Textarea
              label="Audition Notes"
              placeholder="What should actors prepare? What to bring?"
              rows={3}
              value={auditionNotes}
              onChange={(e) => setAuditionNotes(e.target.value)}
            />

            <SectionHeader>Key Dates</SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Input label="Audition Start" type="date" value={auditionStart} onChange={(e) => setAuditionStart(e.target.value)} />
              <Input label="Audition End" type="date" value={auditionEnd} onChange={(e) => setAuditionEnd(e.target.value)} />
              <Input label="Callback Date" type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)} />
              <Input label="Rehearsal Start" type="date" value={rehearsalStart} onChange={(e) => setRehearsalStart(e.target.value)} />
              <Input label="Show Opens" type="date" value={showOpen} onChange={(e) => setShowOpen(e.target.value)} />
              <Input label="Show Closes" type="date" value={showClose} onChange={(e) => setShowClose(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => router.push("/shows")}>
              Cancel
            </Button>
            <Button
              onClick={handleStep1Submit}
              loading={createShowMutation.isPending}
              icon={<ArrowRight className="w-4 h-4" weight="bold" />}
            >
              Save & Continue
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 2 — Roles
          ═══════════════════════════════════════════ */}
      {step === 1 && (
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display text-curtain-900 mb-1">
            Add Roles
          </h1>
          <p className="text-sm text-clay-500 mb-6">
            Define the characters for your show. You can add more later.
          </p>

          {/* Existing roles */}
          {roles.length > 0 && (
            <div className="flex flex-col gap-3 mb-6">
              {roles.map((role) => (
                <Card key={role.id} variant="flat" padding="compact">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-curtain-900">{role.name}</span>
                        <Badge variant="default" size="sm">{role.roleType}</Badge>
                      </div>
                      {role.description && (
                        <p className="text-xs text-clay-500 mt-0.5 line-clamp-1">{role.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRoleMutation.mutate(role.id)}
                      icon={<Trash className="w-4 h-4" weight="bold" />}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Add role form */}
          {addingRole ? (
            <Card variant="flat" className="mb-6">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Role Name *" placeholder="Baker" value={roleDraft.name} onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })} />
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-curtain-700 tracking-wide">Role Type</label>
                    <select value={roleDraft.roleType} onChange={(e) => setRoleDraft({ ...roleDraft, roleType: e.target.value as RoleType })} className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200">
                      <option value="lead">Lead</option>
                      <option value="supporting">Supporting</option>
                      <option value="featured_ensemble">Featured Ensemble</option>
                      <option value="ensemble">Ensemble</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-curtain-700 tracking-wide">Gender</label>
                    <select value={roleDraft.gender} onChange={(e) => setRoleDraft({ ...roleDraft, gender: e.target.value as GenderReq })} className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200">
                      <option value="any">Any</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non_binary">Non-Binary</option>
                    </select>
                  </div>
                  <Input label="Age Range" placeholder="25-45" value={roleDraft.ageRange} onChange={(e) => setRoleDraft({ ...roleDraft, ageRange: e.target.value })} />
                  <Input label="Vocal Range" placeholder="Baritone" value={roleDraft.vocalRange} onChange={(e) => setRoleDraft({ ...roleDraft, vocalRange: e.target.value })} />
                </div>
                <Textarea label="Description" placeholder="Brief character description..." rows={2} value={roleDraft.description} onChange={(e) => setRoleDraft({ ...roleDraft, description: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { if (roleDraft.name.trim()) createRoleMutation.mutate(roleDraft); }} loading={createRoleMutation.isPending}>
                    Add Role
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setAddingRole(false); setRoleDraft(emptyRole); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingRole(true)}
              icon={<Plus className="w-4 h-4" weight="bold" />}
              className="mb-6"
            >
              Add Role
            </Button>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep(0)} icon={<ArrowLeft className="w-4 h-4" weight="bold" />}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Skip for Now
              </Button>
              <Button onClick={() => setStep(2)} icon={<ArrowRight className="w-4 h-4" weight="bold" />}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 3 — Schedule
          ═══════════════════════════════════════════ */}
      {step === 2 && (
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display text-curtain-900 mb-1">
            Audition Schedule
          </h1>
          <p className="text-sm text-clay-500 mb-6">
            Set up time slots for your auditions. Actors will sign up for a slot when they register.
          </p>

          {/* Existing groups */}
          {groups.length > 0 && (
            <div className="flex flex-col gap-3 mb-6">
              {groups.map((group) => (
                <Card key={group.id} variant="flat" padding="compact">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-curtain-900">{group.name}</span>
                      <span className="text-xs text-clay-500 ml-2">
                        {new Date(group.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {" – "}
                        {new Date(group.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <Badge variant="default" size="sm" className="ml-2">{group.slotCount} slots</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Add group form */}
          {addingGroup ? (
            <Card variant="flat" className="mb-6">
              <div className="flex flex-col gap-3">
                <Input label="Group Name" placeholder="Group 1" value={groupDraft.name} onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Start Time *" type="datetime-local" value={groupDraft.startTime} onChange={(e) => setGroupDraft({ ...groupDraft, startTime: e.target.value })} />
                  <Input label="End Time *" type="datetime-local" value={groupDraft.endTime} onChange={(e) => setGroupDraft({ ...groupDraft, endTime: e.target.value })} />
                  <Input label="Number of Slots" type="number" value={String(groupDraft.slotCount)} onChange={(e) => setGroupDraft({ ...groupDraft, slotCount: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { if (groupDraft.startTime && groupDraft.endTime) createGroupMutation.mutate(groupDraft); }} loading={createGroupMutation.isPending}>
                    Add Time Slot
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setAddingGroup(false); setGroupDraft(emptyGroup); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingGroup(true)}
              icon={<Plus className="w-4 h-4" weight="bold" />}
              className="mb-6"
            >
              Add Time Slot
            </Button>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep(1)} icon={<ArrowLeft className="w-4 h-4" weight="bold" />}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Skip for Now
              </Button>
              <Button onClick={() => setStep(3)} icon={<ArrowRight className="w-4 h-4" weight="bold" />}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 4 — Team
          ═══════════════════════════════════════════ */}
      {step === 3 && (
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display text-curtain-900 mb-1">
            Production Team
          </h1>
          <p className="text-sm text-clay-500 mb-6">
            Add the people who&apos;ll be running this production. You&apos;re already added as director.
          </p>

          {/* Team list — always show current user first */}
          <div className="flex flex-col gap-3 mb-6">
            <Card variant="flat" padding="compact">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-curtain-900">{user?.displayName}</span>
                  <Badge variant="success" size="sm">Director</Badge>
                  <Badge variant="default" size="sm">You</Badge>
                </div>
              </div>
            </Card>

            {members.map((member) => (
              <Card key={member.id} variant="flat" padding="compact">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-curtain-900">{member.userName}</span>
                      <Badge variant="default" size="sm">{member.role.replace("_", " ")}</Badge>
                      {member.canEvaluate && <Badge variant="success" size="sm">Evaluator</Badge>}
                    </div>
                    {member.email && <p className="text-xs text-clay-500 mt-0.5">{member.email}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Add member form */}
          {addingMember ? (
            <Card variant="flat" className="mb-6">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Name *" placeholder="Angela Davis" value={memberDraft.userName} onChange={(e) => setMemberDraft({ ...memberDraft, userName: e.target.value })} />
                  <Input label="Email" placeholder="angela@email.com" value={memberDraft.email} onChange={(e) => setMemberDraft({ ...memberDraft, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-curtain-700 tracking-wide">Role</label>
                    <select value={memberDraft.role} onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value as TeamRole })} className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 outline-none focus:ring-2 focus:ring-curtain-200">
                      <option value="director">Director</option>
                      <option value="music_director">Music Director</option>
                      <option value="choreographer">Choreographer</option>
                      <option value="stage_manager">Stage Manager</option>
                      <option value="producer">Producer</option>
                      <option value="asst_director">Asst. Director</option>
                      <option value="accompanist">Accompanist</option>
                    </select>
                  </div>
                  <Input label="Phone" placeholder="(555) 555-0100" value={memberDraft.phone} onChange={(e) => setMemberDraft({ ...memberDraft, phone: e.target.value })} />
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm text-curtain-700 cursor-pointer">
                      <input type="checkbox" checked={memberDraft.canEvaluate} onChange={(e) => setMemberDraft({ ...memberDraft, canEvaluate: e.target.checked })} className="rounded border-cream-300" />
                      Can evaluate actors
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { if (memberDraft.userName.trim()) addMemberMutation.mutate(memberDraft); }} loading={addMemberMutation.isPending}>
                    Add Member
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setAddingMember(false); setMemberDraft(emptyMember); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingMember(true)}
              icon={<Plus className="w-4 h-4" weight="bold" />}
              className="mb-6"
            >
              Add Team Member
            </Button>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep(2)} icon={<ArrowLeft className="w-4 h-4" weight="bold" />}>
              Back
            </Button>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["shows"] });
                toast("success", "Show setup complete!");
                router.push(`/shows/${showId}/setup`);
              }}
              icon={<Check className="w-4 h-4" weight="bold" />}
            >
              Finish Setup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
