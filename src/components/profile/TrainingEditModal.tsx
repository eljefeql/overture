"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Input, Button, Card, useToast } from "@/components/ui";
import { addTraining, updateTraining, deleteTraining } from "@/lib/api/client";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import type { ActorWithProfile, Training } from "@/types";

type Props = {
  actor: ActorWithProfile;
  open: boolean;
  onClose: () => void;
};

type FormState = {
  institution: string;
  description: string;
  years: string;
};

const emptyForm: FormState = { institution: "", description: "", years: "" };

export function TrainingEditModal({ actor, open, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["actor", actor.id] });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (data: { institution: string; description: string; years: string | null }) =>
      addTraining(actor.id, data),
    onSuccess: () => { invalidate(); toast("success", "Training added!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Training, "institution" | "description" | "years">> }) =>
      updateTraining(actor.id, id, data),
    onSuccess: () => { invalidate(); toast("success", "Training updated!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTraining(actor.id, id),
    onSuccess: () => { invalidate(); toast("success", "Training removed."); },
  });

  const isSaving = addMutation.isPending || updateMutation.isPending;
  const training = actor.profile?.training ?? [];

  function startEdit(entry: Training) {
    setEditingId(entry.id);
    setForm({ institution: entry.institution, description: entry.description, years: entry.years ?? "" });
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
    if (!form.institution.trim() || !form.description.trim()) return;
    try {
      const data = { institution: form.institution.trim(), description: form.description.trim(), years: form.years.trim() || null };
      if (editingId === "new") {
        await addMutation.mutateAsync(data);
      } else if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data });
      }
      setEditingId(null);
      setForm(emptyForm);
    } catch {
      toast("error", "Something went wrong. Try again.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch {
      toast("error", "Could not delete training.");
    }
  }

  const isFormValid = form.institution.trim() && form.description.trim();

  return (
    <Modal open={open} onClose={onClose} title="Edit Training">
      <div className="flex flex-col gap-3">
        {training.map((entry) =>
          editingId === entry.id ? (
            <InlineForm
              key={entry.id}
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onCancel={cancel}
              isSaving={isSaving}
              isValid={!!isFormValid}
              saveLabel="Update"
            />
          ) : confirmDeleteId === entry.id ? (
            <Card key={entry.id} variant="flat" padding="compact">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-curtain-800">
                  Remove <span className="font-semibold">{entry.institution}</span>?
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(entry.id)}
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
            <Card key={entry.id} variant="flat" padding="compact">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-curtain-900">
                    {entry.institution}
                  </p>
                  <p className="text-xs text-clay-500">
                    {entry.description}
                    {entry.years && ` · ${entry.years}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(entry)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                    aria-label="Edit training"
                  >
                    <PencilSimple className="w-4 h-4" weight="bold" />
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteId(entry.id); setEditingId(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors"
                    aria-label="Delete training"
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
            saveLabel="Add Training"
          />
        )}

        {editingId === null && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-cream-400 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            Add training
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
          label="Institution"
          value={form.institution}
          onChange={(e) => setForm({ ...form, institution: e.target.value })}
          placeholder="e.g. Cal State Fullerton"
        />
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g. BFA Musical Theatre"
        />
        <Input
          label="Years (optional)"
          value={form.years}
          onChange={(e) => setForm({ ...form, years: e.target.value })}
          placeholder="e.g. 2018–2022"
        />
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
