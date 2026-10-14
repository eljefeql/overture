"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Textarea, Card } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  createVolunteerEvent,
  saveVolunteerEvent,
  deleteVolunteerEvent,
  type VolunteerEventInput,
} from "@/lib/api/hub";
import { Plus, Trash, X, Clock } from "@phosphor-icons/react";
import type { VolunteerEvent, VolunteerNeed } from "@/types";

/* ============================================================
   "Add volunteer event" builder (QC #14). Event (title · date ·
   location · notes) → shifts added manually (start/end, optional
   label) → roles added manually inside each shift (name + spots).
   Edit reopens the same builder pre-filled; removing a shift or
   role that already has signups asks for an inline confirm first
   — those people lose their spots, and we say so.
   ============================================================ */

type RoleDraft = {
  id?: string;
  key: string;
  label: string;
  slots: string;
  signups: number;
};

type ShiftDraft = {
  id?: string;
  key: string;
  label: string;
  start: string; // HH:MM or ""
  end: string;
  roles: RoleDraft[];
};

type Draft = {
  title: string;
  eventDate: string;
  location: string;
  notes: string;
  shifts: ShiftDraft[];
};

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

const DEFAULT_ROLE_NAMES = ["Carpentry", "Painting", "Misc / runner"];

function emptyRole(label = ""): RoleDraft {
  return { key: nextKey(), label, slots: "2", signups: 0 };
}

function emptyShift(): ShiftDraft {
  return { key: nextKey(), label: "", start: "", end: "", roles: [emptyRole()] };
}

function emptyDraft(): Draft {
  return { title: "", eventDate: "", location: "", notes: "", shifts: [emptyShift()] };
}

const toHHMM = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function draftFromExisting(event: VolunteerEvent, roles: VolunteerNeed[]): Draft {
  return {
    title: event.title,
    eventDate: event.eventDate ?? "",
    location: event.location ?? "",
    notes: event.notes ?? "",
    shifts: event.shifts.map((s) => ({
      id: s.id,
      key: nextKey(),
      label: s.label ?? "",
      start: toHHMM(s.startTime),
      end: toHHMM(s.endTime),
      roles: roles
        .filter((r) => r.shiftId === s.id)
        .map((r) => ({
          id: r.id,
          key: nextKey(),
          label: r.roleLabel ?? r.label,
          slots: String(r.slots),
          signups: r.signups.length,
        })),
    })),
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  showId: string;
  /** Editing: the event + ALL needs on the show (roles are filtered here). */
  existing: { event: VolunteerEvent; needs: VolunteerNeed[] } | null;
  /** Query keys to invalidate after any write. */
  onSaved: () => void;
};

export function VolunteerEventModal(props: Props) {
  // Mount the builder fresh each time it opens so its draft state starts
  // from `existing` (or empty) without a setState-in-effect.
  if (!props.open) return null;
  return <VolunteerEventModalInner {...props} />;
}

function VolunteerEventModalInner({ open, onClose, showId, existing, onSaved }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? draftFromExisting(existing.event, existing.needs.filter((n) => n.eventId === existing.event.id))
      : emptyDraft()
  );
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const existingSignups = existing
    ? existing.needs
        .filter((n) => n.eventId === existing.event.id)
        .reduce((sum, n) => sum + n.signups.length, 0)
    : 0;

  const buildInput = (): VolunteerEventInput | null => {
    if (!draft.title.trim()) {
      toast("error", 'Give the event a title — e.g. "Set build Saturday".');
      return null;
    }
    if (draft.shifts.length === 0) {
      toast("error", "Add at least one shift.");
      return null;
    }
    const anyTimes = draft.shifts.some((s) => s.start || s.end);
    if (anyTimes && !draft.eventDate) {
      toast("error", "Add the event date for those shift times.");
      return null;
    }
    const iso = (hhmm: string) =>
      hhmm && draft.eventDate ? new Date(`${draft.eventDate}T${hhmm}:00`).toISOString() : null;
    const shifts: VolunteerEventInput["shifts"] = [];
    for (const s of draft.shifts) {
      if (s.end && !s.start) {
        toast("error", "A shift with an end time needs a start time too.");
        return null;
      }
      if (s.start && s.end && s.end <= s.start) {
        toast("error", "Each shift's end time must be after its start.");
        return null;
      }
      if (s.roles.length === 0) {
        toast("error", "Every shift needs at least one role — e.g. \"Carpentry\".");
        return null;
      }
      const roles: VolunteerEventInput["shifts"][number]["roles"] = [];
      for (const r of s.roles) {
        if (!r.label.trim()) {
          toast("error", "Every role needs a name — e.g. \"Painting\".");
          return null;
        }
        const slots = parseInt(r.slots, 10);
        if (!Number.isFinite(slots) || slots < 1) {
          toast("error", `"${r.label.trim()}" needs at least 1 spot.`);
          return null;
        }
        roles.push({ id: r.id, label: r.label.trim(), slots });
      }
      shifts.push({
        id: s.id,
        startTime: iso(s.start),
        endTime: iso(s.end),
        label: s.label.trim() || null,
        roles,
      });
    }
    return {
      showId,
      title: draft.title.trim(),
      eventDate: draft.eventDate || null,
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
      shifts,
    };
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["hubVolunteers", showId] });
    queryClient.invalidateQueries({ queryKey: ["hubVolunteerEvents", showId] });
    queryClient.invalidateQueries({ queryKey: ["volunteerBoard", showId] });
    onSaved();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = buildInput();
      if (!input) throw new Error("__validation__");
      if (existing) await saveVolunteerEvent(existing.event.id, input, existing.event);
      else await createVolunteerEvent(input);
    },
    onSuccess: () => {
      invalidate();
      toast("success", existing ? "Volunteer event updated!" : "Volunteer event added!");
      onClose();
    },
    onError: (err: Error) => {
      if (err.message !== "__validation__") toast("error", err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVolunteerEvent(existing!.event.id),
    onSuccess: () => {
      invalidate();
      toast("info", "Volunteer event removed.");
      onClose();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  /* ── draft helpers ── */
  const updateShift = (key: string, patch: Partial<ShiftDraft>) =>
    setDraft((d) => ({
      ...d,
      shifts: d.shifts.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }));
  const updateRole = (shiftKey: string, roleKey: string, patch: Partial<RoleDraft>) =>
    setDraft((d) => ({
      ...d,
      shifts: d.shifts.map((s) =>
        s.key === shiftKey
          ? { ...s, roles: s.roles.map((r) => (r.key === roleKey ? { ...r, ...patch } : r)) }
          : s
      ),
    }));
  const addShift = () => {
    setDraft((d) => {
      // Default the new shift to start where the last one ended — the
      // "two shifts in a day" case the owner described.
      const last = d.shifts[d.shifts.length - 1];
      const s = emptyShift();
      if (last?.end) s.start = last.end;
      // Mirror the previous shift's role names so 9–12 and 12–3 match.
      if (last && last.roles.length > 0) {
        s.roles = last.roles.map((r) => emptyRole(r.label));
        s.roles.forEach((r, i) => (r.slots = last.roles[i].slots));
      }
      return { ...d, shifts: [...d.shifts, s] };
    });
  };
  const removeShift = (key: string) =>
    setDraft((d) => ({ ...d, shifts: d.shifts.filter((s) => s.key !== key) }));
  const addRole = (shiftKey: string) =>
    setDraft((d) => ({
      ...d,
      shifts: d.shifts.map((s) => {
        if (s.key !== shiftKey) return s;
        const used = new Set(s.roles.map((r) => r.label.trim().toLowerCase()));
        const suggestion = DEFAULT_ROLE_NAMES.find((n) => !used.has(n.toLowerCase())) ?? "";
        return { ...s, roles: [...s.roles, emptyRole(s.roles.length === 0 ? "" : suggestion)] };
      }),
    }));
  const removeRole = (shiftKey: string, roleKey: string) =>
    setDraft((d) => ({
      ...d,
      shifts: d.shifts.map((s) =>
        s.key === shiftKey ? { ...s, roles: s.roles.filter((r) => r.key !== roleKey) } : s
      ),
    }));

  const shiftSignups = (s: ShiftDraft) => s.roles.reduce((sum, r) => sum + r.signups, 0);

  /** Remove with an inline confirm when signups would be lost. */
  const requestRemove = (id: string, signups: number, doRemove: () => void) => {
    if (signups > 0 && pendingRemove !== id) {
      setPendingRemove(id);
      return;
    }
    setPendingRemove(null);
    doRemove();
  };

  const labelCls = "text-xs font-semibold text-curtain-700 uppercase tracking-wide";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? "Edit Volunteer Event" : "Add a Volunteer Event"}
    >
      <div className="py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-xs text-clay-500 -mt-1">
          One event, as many shifts as you need, and the roles inside each shift —
          e.g. Set build Saturday → 9–12 and 12–3 → carpentry, painting, misc.
        </p>

        {/* ── Event ── */}
        <div>
          <label className={labelCls}>Event title *</label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder='e.g. "Set build Saturday"'
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Date</label>
            <Input
              type="date"
              value={draft.eventDate}
              onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <Input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="Scene shop, back entrance"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <Textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={2}
            placeholder="Anything volunteers should know — what to wear, where to park, snacks…"
          />
        </div>

        {/* ── Shifts ── */}
        <div className="flex items-center justify-between gap-2">
          <h3 className={labelCls}>Shifts</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={addShift}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Add shift
          </Button>
        </div>
        {draft.shifts.length === 0 && (
          <Card variant="flat" padding="compact">
            <p className="text-xs text-clay-500">
              No shifts yet — add one (a single 9–3 shift is fine too).
            </p>
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {draft.shifts.map((shift, si) => {
            const removeId = `shift-${shift.key}`;
            const lost = shiftSignups(shift);
            return (
              <Card key={shift.key} variant="flat" padding="compact">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-curtain-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-stage-500" weight="duotone" />
                    Shift {si + 1}
                  </p>
                  {pendingRemove === removeId ? (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-xs text-ruby-500 font-medium">
                        {lost} signed up — they&apos;ll lose their spot{lost === 1 ? "" : "s"}.
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => requestRemove(removeId, lost, () => removeShift(shift.key))}
                      >
                        Remove anyway
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingRemove(null)}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => requestRemove(removeId, lost, () => removeShift(shift.key))}
                      className="text-clay-300 hover:text-ruby-500 transition p-1"
                      aria-label={`Remove shift ${si + 1}`}
                    >
                      <X className="w-4 h-4" weight="bold" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Start</label>
                    <Input
                      type="time"
                      value={shift.start}
                      onChange={(e) => updateShift(shift.key, { start: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>End</label>
                    <Input
                      type="time"
                      value={shift.end}
                      onChange={(e) => updateShift(shift.key, { end: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>Label (optional)</label>
                    <Input
                      value={shift.label}
                      onChange={(e) => updateShift(shift.key, { label: e.target.value })}
                      placeholder="Morning"
                    />
                  </div>
                </div>

                {/* Roles */}
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                      Roles in this shift
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addRole(shift.key)}
                      icon={<Plus className="w-4 h-4" weight="bold" />}
                    >
                      Add role
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {shift.roles.map((role) => {
                      const roleRemoveId = `role-${role.key}`;
                      return (
                        <div key={role.key} className="flex flex-col gap-1">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                              <Input
                                value={role.label}
                                onChange={(e) =>
                                  updateRole(shift.key, role.key, { label: e.target.value })
                                }
                                placeholder='Role — e.g. "Carpentry"'
                                aria-label="Role name"
                              />
                            </div>
                            <div className="w-20 flex-shrink-0">
                              <Input
                                type="number"
                                min={1}
                                value={role.slots}
                                onChange={(e) =>
                                  updateRole(shift.key, role.key, { slots: e.target.value })
                                }
                                aria-label="Spots"
                              />
                            </div>
                            <button
                              onClick={() =>
                                requestRemove(roleRemoveId, role.signups, () =>
                                  removeRole(shift.key, role.key)
                                )
                              }
                              className="text-clay-300 hover:text-ruby-500 transition p-2 flex-shrink-0"
                              aria-label={`Remove role ${role.label || ""}`}
                            >
                              <X className="w-4 h-4" weight="bold" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 px-0.5">
                            <span className="text-[11px] text-clay-400">
                              {role.signups > 0
                                ? `${role.signups} signed up`
                                : "spots"}
                            </span>
                            {pendingRemove === roleRemoveId && (
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                <span className="text-xs text-ruby-500 font-medium">
                                  {role.signups} will lose their spot{role.signups === 1 ? "" : "s"}.
                                </span>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    requestRemove(roleRemoveId, role.signups, () =>
                                      removeRole(shift.key, role.key)
                                    )
                                  }
                                >
                                  Remove anyway
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setPendingRemove(null)}>
                                  Keep
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
          {existing ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-ruby-500 font-medium">
                  Remove this event?
                  {existingSignups > 0
                    ? ` ${existingSignups} ${existingSignups === 1 ? "person has" : "people have"} signed up — they'll lose their spots.`
                    : " Its shifts and roles go with it."}
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deleteMutation.mutate()}
                  loading={deleteMutation.isPending}
                >
                  Yes, remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                icon={<Trash className="w-4 h-4" weight="bold" />}
              >
                Remove event
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {existing ? "Save Changes" : "Add Event"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
