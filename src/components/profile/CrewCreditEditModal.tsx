"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Input, Button, Card, VerifiedBadge, useToast } from "@/components/ui";
import { addCrewCredit, updateCrewCredit, deleteCrewCredit } from "@/lib/api/client";
import { Plus, PencilSimple, Trash, Lock } from "@phosphor-icons/react";
import type { ActorWithProfile, CrewCredit } from "@/types";

type Props = {
  actor: ActorWithProfile;
  open: boolean;
  onClose: () => void;
};

type FormState = {
  position: string;
  showTitle: string;
  theatreName: string;
  year: string;
};

const emptyForm: FormState = { position: "", showTitle: "", theatreName: "", year: "" };

export function CrewCreditEditModal({ actor, open, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["actor", actor.id] });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (data: { position: string; showTitle: string; theatreName: string; year: number }) =>
      addCrewCredit(actor.id, data),
    onSuccess: () => { invalidate(); toast("success", "Credit added!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ creditId, data }: { creditId: string; data: Partial<Pick<CrewCredit, "position" | "showTitle" | "theatreName" | "year">> }) =>
      updateCrewCredit(actor.id, creditId, data),
    onSuccess: () => { invalidate(); toast("success", "Credit updated!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (creditId: string) => deleteCrewCredit(actor.id, creditId),
    onSuccess: () => { invalidate(); toast("success", "Credit removed."); },
  });

  const isSaving = addMutation.isPending || updateMutation.isPending;

  function startEdit(credit: CrewCredit) {
    setEditingId(credit.id);
    setForm({
      position: credit.position,
      showTitle: credit.showTitle,
      theatreName: credit.theatreName,
      year: credit.year.toString(),
    });
    setConfirmDeleteId(null);
  }

  function startAdd() {
    setEditingId("new");
    setForm(emptyForm);
    setConfirmDeleteId(null);
  }

  function cancel() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    const year = parseInt(form.year);
    if (!form.position.trim() || !form.showTitle.trim() || !form.theatreName.trim() || isNaN(year)) return;

    try {
      const data = {
        position: form.position.trim(),
        showTitle: form.showTitle.trim(),
        theatreName: form.theatreName.trim(),
        year,
      };
      if (editingId === "new") {
        await addMutation.mutateAsync(data);
      } else if (editingId) {
        await updateMutation.mutateAsync({ creditId: editingId, data });
      }
      setEditingId(null);
      setForm(emptyForm);
    } catch {
      toast("error", "Something went wrong. Try again.");
    }
  }

  async function handleDelete(creditId: string) {
    try {
      await deleteMutation.mutateAsync(creditId);
      setConfirmDeleteId(null);
    } catch {
      toast("error", "Could not delete credit.");
    }
  }

  const isFormValid =
    form.position.trim() && form.showTitle.trim() && form.theatreName.trim() && !isNaN(parseInt(form.year));

  const verified = actor.crewCredits.filter((c) => c.verified);
  const manual = actor.crewCredits.filter((c) => !c.verified);

  return (
    <Modal open={open} onClose={onClose} title="Edit Production Work">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-clay-400">
          Behind-the-scenes and creative-team work — directing, stage management, design,
          choreography. Kept separate from your acting credits.
        </p>

        {/* Verified — read-only */}
        {verified.map((credit) => (
          <Card key={credit.id} variant="flat" padding="compact">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-display text-curtain-900 truncate">
                    {credit.showTitle}
                  </p>
                  <VerifiedBadge />
                </div>
                <p className="text-xs text-clay-500">
                  {credit.position} · {credit.theatreName} · {credit.year}
                </p>
              </div>
              <Lock className="w-4 h-4 text-clay-300 flex-shrink-0 mt-0.5" weight="duotone" />
            </div>
          </Card>
        ))}

        {verified.length > 0 && (manual.length > 0 || editingId) && (
          <hr className="border-cream-200" />
        )}

        {/* Manual — editable */}
        {manual.map((credit) =>
          editingId === credit.id ? (
            <InlineForm
              key={credit.id}
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onCancel={cancel}
              isSaving={isSaving}
              isValid={!!isFormValid}
              saveLabel="Update"
            />
          ) : confirmDeleteId === credit.id ? (
            <Card key={credit.id} variant="flat" padding="compact">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-curtain-800">
                  Remove <span className="font-semibold">{credit.showTitle}</span>?
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(credit.id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "..." : "Delete"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card key={credit.id} variant="flat" padding="compact">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display text-curtain-900 truncate">
                    {credit.showTitle}
                  </p>
                  <p className="text-xs text-clay-500">
                    {credit.position} · {credit.theatreName} · {credit.year}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(credit)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                    aria-label="Edit credit"
                  >
                    <PencilSimple className="w-4 h-4" weight="bold" />
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteId(credit.id); setEditingId(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors"
                    aria-label="Delete credit"
                  >
                    <Trash className="w-4 h-4" weight="bold" />
                  </button>
                </div>
              </div>
            </Card>
          )
        )}

        {editingId === "new" && (
          <InlineForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={cancel}
            isSaving={isSaving}
            isValid={!!isFormValid}
            saveLabel="Add Credit"
          />
        )}

        {editingId === null && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-cream-400 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            Add production work
          </button>
        )}
      </div>
    </Modal>
  );
}

function InlineForm({
  form,
  setForm,
  onSave,
  onCancel,
  isSaving,
  isValid,
  saveLabel,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isValid: boolean;
  saveLabel: string;
}) {
  return (
    <div className="bg-cream-50 rounded-xl border border-cream-200 p-4 animate-fade-up">
      <div className="flex flex-col gap-3">
        <Input
          label="Position"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
          placeholder="e.g. Stage Manager, Costume Designer"
        />
        <Input
          label="Show Title"
          value={form.showTitle}
          onChange={(e) => setForm({ ...form, showTitle: e.target.value })}
          placeholder="e.g. Into the Woods"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Theatre"
            value={form.theatreName}
            onChange={(e) => setForm({ ...form, theatreName: e.target.value })}
            placeholder="e.g. NCT"
          />
          <Input
            label="Year"
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })}
            placeholder="e.g. 2024"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <Button size="sm" onClick={onSave} disabled={isSaving || !isValid}>
          {isSaving ? "Saving..." : saveLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
