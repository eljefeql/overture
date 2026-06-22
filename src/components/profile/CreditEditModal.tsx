"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Input, Button, Card, VerifiedBadge, useToast } from "@/components/ui";
import { addManualCredit, updateManualCredit, deleteManualCredit } from "@/lib/api/client";
import { Plus, PencilSimple, Trash, Lock } from "@phosphor-icons/react";
import type { ActorWithProfile, ProductionCredit } from "@/types";

type Props = {
  actor: ActorWithProfile;
  open: boolean;
  onClose: () => void;
};

type FormState = {
  showTitle: string;
  roleName: string;
  theatreName: string;
  year: string;
};

const emptyForm: FormState = { showTitle: "", roleName: "", theatreName: "", year: "" };

export function CreditEditModal({ actor, open, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["actor", actor.id] });

  const [editingId, setEditingId] = useState<string | null>(null); // null = not editing, "new" = adding
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (data: { showTitle: string; roleName: string; theatreName: string; year: number }) =>
      addManualCredit(actor.id, data),
    onSuccess: () => { invalidate(); toast("success", "Credit added!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ creditId, data }: { creditId: string; data: Partial<Pick<ProductionCredit, "showTitle" | "roleName" | "theatreName" | "year">> }) =>
      updateManualCredit(actor.id, creditId, data),
    onSuccess: () => { invalidate(); toast("success", "Credit updated!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (creditId: string) => deleteManualCredit(actor.id, creditId),
    onSuccess: () => { invalidate(); toast("success", "Credit removed."); },
  });

  const isSaving = addMutation.isPending || updateMutation.isPending;

  function startEdit(credit: ProductionCredit) {
    setEditingId(credit.id);
    setForm({
      showTitle: credit.showTitle,
      roleName: credit.roleName,
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
    if (!form.showTitle.trim() || !form.roleName.trim() || !form.theatreName.trim() || isNaN(year)) return;

    try {
      if (editingId === "new") {
        await addMutation.mutateAsync({ showTitle: form.showTitle.trim(), roleName: form.roleName.trim(), theatreName: form.theatreName.trim(), year });
      } else if (editingId) {
        await updateMutation.mutateAsync({ creditId: editingId, data: { showTitle: form.showTitle.trim(), roleName: form.roleName.trim(), theatreName: form.theatreName.trim(), year } });
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

  const isFormValid = form.showTitle.trim() && form.roleName.trim() && form.theatreName.trim() && !isNaN(parseInt(form.year));

  const verifiedCredits = actor.credits.filter((c) => c.verified);
  const manualCredits = actor.credits.filter((c) => !c.verified);

  return (
    <Modal open={open} onClose={onClose} title="Edit Credits">
      <div className="flex flex-col gap-3">
        {/* Info about verified credits */}
        {verifiedCredits.length > 0 && (
          <p className="text-[11px] text-clay-400">
            Verified credits are added automatically when you&apos;re cast through Overture.
          </p>
        )}

        {/* Verified credits — read-only */}
        {verifiedCredits.map((credit) => (
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
                  {credit.roleName} · {credit.theatreName} · {credit.year}
                </p>
              </div>
              <Lock className="w-4 h-4 text-clay-300 flex-shrink-0 mt-0.5" weight="duotone" />
            </div>
          </Card>
        ))}

        {/* Divider if both types exist */}
        {verifiedCredits.length > 0 && (manualCredits.length > 0 || editingId) && (
          <hr className="border-cream-200" />
        )}

        {/* Manual credits — editable */}
        {manualCredits.map((credit) =>
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
                    {credit.roleName} · {credit.theatreName} · {credit.year}
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

        {/* Inline add form */}
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

        {/* Add button */}
        {editingId === null && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-cream-400 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            Add a credit
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
          label="Show Title"
          value={form.showTitle}
          onChange={(e) => setForm({ ...form, showTitle: e.target.value })}
          placeholder="e.g. Sweeney Todd"
        />
        <Input
          label="Role"
          value={form.roleName}
          onChange={(e) => setForm({ ...form, roleName: e.target.value })}
          placeholder="e.g. Mrs. Lovett"
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
