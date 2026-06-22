"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Input, Button, Card, useToast } from "@/components/ui";
import { addAward, updateAward, deleteAward } from "@/lib/api/client";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import type { ActorWithProfile, Award } from "@/types";

type Props = {
  actor: ActorWithProfile;
  open: boolean;
  onClose: () => void;
};

type FormState = {
  title: string;
  organization: string;
  year: string;
};

const emptyForm: FormState = { title: "", organization: "", year: "" };

export function AwardEditModal({ actor, open, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["actor", actor.id] });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (data: { title: string; organization: string; year: number }) =>
      addAward(actor.id, data),
    onSuccess: () => { invalidate(); toast("success", "Award added!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Award, "title" | "organization" | "year">> }) =>
      updateAward(actor.id, id, data),
    onSuccess: () => { invalidate(); toast("success", "Award updated!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAward(actor.id, id),
    onSuccess: () => { invalidate(); toast("success", "Award removed."); },
  });

  const isSaving = addMutation.isPending || updateMutation.isPending;
  const awards = actor.profile?.awards ?? [];

  function startEdit(entry: Award) {
    setEditingId(entry.id);
    setForm({ title: entry.title, organization: entry.organization, year: entry.year.toString() });
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
    if (!form.title.trim() || !form.organization.trim() || isNaN(year)) return;
    try {
      const data = { title: form.title.trim(), organization: form.organization.trim(), year };
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
      toast("error", "Could not delete award.");
    }
  }

  const isFormValid = form.title.trim() && form.organization.trim() && !isNaN(parseInt(form.year));

  return (
    <Modal open={open} onClose={onClose} title="Edit Awards">
      <div className="flex flex-col gap-3">
        {awards.map((entry) =>
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
                  Remove <span className="font-semibold">{entry.title}</span>?
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
                    {entry.title}
                  </p>
                  <p className="text-xs text-clay-500">
                    {entry.organization} · {entry.year}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(entry)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                    aria-label="Edit award"
                  >
                    <PencilSimple className="w-4 h-4" weight="bold" />
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteId(entry.id); setEditingId(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors"
                    aria-label="Delete award"
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
            saveLabel="Add Award"
          />
        )}

        {editingId === null && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-cream-400 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            Add an award
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
          label="Award Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Best Actress in a Musical"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Organization"
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            placeholder="e.g. Inland Theatre League"
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
