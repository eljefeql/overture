"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDirectCastMember,
  createShowRole,
  updateCastAssignment,
  sendCastInvites,
} from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Modal,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  Plus,
  Trash,
  PaperPlaneTilt,
  UsersThree,
  EnvelopeSimple,
  CheckCircle,
} from "@phosphor-icons/react";
import type { CastAssignment, ShowRole, RoleType } from "@/types";

/* ============================================================
   Precast cast section (spec Feature 2, migration 024) —
   bulk-add an existing cast: rows of role + name + email, roles
   created on the fly. Assignments are director-confirmed
   (status 'accepted', flagged added_directly).

   Invitations NEVER fire on row save (owner decision — typo
   protection): they batch behind the "Review & send invitations"
   confirm, which notifies linked accounts in-app and queues warm
   guest emails for everyone else.
   ============================================================ */

type DraftRow = { roleName: string; name: string; email: string };

const EMPTY_ROW: DraftRow = { roleName: "", name: "", email: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ensemble-ish names get an ensemble pot; everything else is supporting
 *  (announcement targeting treats lead/supporting as principals — "supporting"
 *  is the neutral default for roles we know nothing about). */
function inferRoleType(roleName: string): RoleType {
  return /ensemble|chorus/i.test(roleName) ? "ensemble" : "supporting";
}

export function PrecastCastSection({
  showId,
  roles,
  assignments,
}: {
  showId: string;
  roles: ShowRole[];
  assignments: CastAssignment[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = useState<DraftRow[]>([{ ...EMPTY_ROW }]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const cast = useMemo(
    () => assignments.filter((a) => a.status !== "withdrawn" && a.status !== "declined"),
    [assignments]
  );
  const pendingInvites = useMemo(
    () =>
      cast.filter((a) => a.addedDirectly && !a.invitedAt && a.status === "accepted"),
    [cast]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["showSetup", showId] });
    queryClient.invalidateQueries({ queryKey: ["castAssignments", showId] });
    queryClient.invalidateQueries({ queryKey: ["precastModules", showId] });
  };

  // Save every filled row sequentially: resolve each role by name
  // (case-insensitive) against existing roles — creating it on the fly when
  // it's new — then add the person. Rows that save are removed from the
  // drafts; on the first failure we stop so nothing is lost.
  const saveMutation = useMutation({
    mutationFn: async (rows: DraftRow[]) => {
      const roleByName = new Map<string, ShowRole>();
      for (const r of roles) roleByName.set(r.name.trim().toLowerCase(), r);
      let created = 0;
      let added = 0;
      for (const row of rows) {
        const key = row.roleName.trim().toLowerCase();
        let role = roleByName.get(key);
        if (!role) {
          role = await createShowRole({
            showId,
            name: row.roleName.trim(),
            roleType: inferRoleType(row.roleName),
            gender: "any",
            ageRange: null,
            vocalRange: null,
            description: null,
            sortOrder: roles.length + created,
          });
          roleByName.set(key, role);
          created++;
        }
        await addDirectCastMember({
          showId,
          roleId: role.id,
          roleName: role.name,
          name: row.name.trim(),
          email: row.email.trim(),
        });
        added++;
        // Drop the saved row from the drafts as we go, so a mid-batch error
        // leaves exactly the unsaved rows behind.
        setDrafts((prev) => {
          const next = prev.filter(
            (d) =>
              !(
                d.roleName === row.roleName &&
                d.name === row.name &&
                d.email === row.email
              )
          );
          return next.length > 0 ? next : [{ ...EMPTY_ROW }];
        });
      }
      return added;
    },
    onSuccess: (added) => {
      invalidate();
      toast(
        "success",
        `Added ${added} cast ${added === 1 ? "member" : "members"}. Review & send invitations when you're ready.`
      );
    },
    onError: (err: Error) => {
      invalidate(); // earlier rows may have saved
      toast("error", err.message);
    },
  });

  const removeMutation = useMutation({
    // No delete policy exists on cast_assignments — removal is the same
    // status flip the casting board uses.
    mutationFn: (assignmentId: string) =>
      updateCastAssignment(assignmentId, { status: "withdrawn" }),
    onSuccess: () => {
      invalidate();
      toast("info", "Cast member removed.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendCastInvites(showId),
    onSuccess: (count) => {
      invalidate();
      setReviewOpen(false);
      toast(
        "success",
        count > 0
          ? `Sent ${count} ${count === 1 ? "invitation" : "invitations"}!`
          : "Everyone has already been invited."
      );
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const filledDrafts = drafts.filter(
    (d) => d.roleName.trim() || d.name.trim() || d.email.trim()
  );
  const draftProblem = (() => {
    for (const d of filledDrafts) {
      if (!d.roleName.trim() || !d.name.trim() || !d.email.trim())
        return "Each row needs a role, a name, and an email.";
      if (!EMAIL_RE.test(d.email.trim()))
        return `"${d.email.trim()}" doesn't look like an email address.`;
    }
    return null;
  })();

  const submitDrafts = () => {
    if (filledDrafts.length === 0) {
      toast("error", "Add at least one cast member first.");
      return;
    }
    if (draftProblem) {
      toast("error", draftProblem);
      return;
    }
    saveMutation.mutate(filledDrafts);
  };

  const updateDraft = (i: number, patch: Partial<DraftRow>) =>
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const statusChip = (a: CastAssignment) => {
    if (a.actorId) {
      return (
        <Badge variant="success" size="sm">
          <CheckCircle className="w-3.5 h-3.5" weight="fill" />
          Joined
        </Badge>
      );
    }
    if (a.invitedAt) {
      return (
        <Badge variant="gold" size="sm">
          <EnvelopeSimple className="w-3.5 h-3.5" weight="duotone" />
          Invited
        </Badge>
      );
    }
    return (
      <Badge variant="muted" size="sm">
        Not invited yet
      </Badge>
    );
  };

  return (
    <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "125ms" }}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UsersThree className="w-5 h-5 text-stage-500" weight="duotone" />
          <CardTitle>Your Cast ({cast.length})</CardTitle>
        </div>
        {pendingInvites.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReviewOpen(true)}
            icon={<PaperPlaneTilt className="w-4 h-4 text-stage-500" weight="duotone" />}
          >
            Review &amp; send invitations ({pendingInvites.length})
          </Button>
        )}
      </CardHeader>
      <p className="text-sm text-clay-500 mb-4">
        Add everyone by role, name, and email — new roles are created as you
        go. Nothing is emailed when you save a row: invitations go out together
        when you hit &ldquo;Review &amp; send invitations.&rdquo;
      </p>

      {/* Current cast */}
      {cast.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {cast.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 py-2 border-b border-cream-100 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-curtain-900 truncate">
                  {a.actorName || a.guestName || a.guestEmail}
                </p>
                <p className="text-xs text-clay-500 truncate">
                  {a.roleName}
                  {!a.actorId && a.guestEmail ? ` · ${a.guestEmail}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {statusChip(a)}
                {a.addedDirectly && (
                  <button
                    onClick={() => removeMutation.mutate(a.id)}
                    className="text-clay-300 hover:text-ruby-500 transition p-1"
                    aria-label={`Remove ${a.actorName || a.guestName || "cast member"}`}
                  >
                    <Trash className="w-4 h-4" weight="bold" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk-add rows */}
      <div className="flex flex-col gap-3">
        {drafts.map((d, i) => (
          <Card key={i} variant="flat" padding="compact">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-end">
              <div>
                <label className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                  Role
                </label>
                <Input
                  list={`precast-roles-${showId}`}
                  value={d.roleName}
                  onChange={(e) => updateDraft(i, { roleName: e.target.value })}
                  placeholder="e.g. Tevye"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                  Name
                </label>
                <Input
                  value={d.name}
                  onChange={(e) => updateDraft(i, { name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                  Email
                </label>
                <Input
                  type="email"
                  value={d.email}
                  onChange={(e) => updateDraft(i, { email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <button
                onClick={() =>
                  setDrafts((prev) =>
                    prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ ...EMPTY_ROW }]
                  )
                }
                className="text-clay-300 hover:text-ruby-500 transition p-2 justify-self-end"
                aria-label={`Clear row ${i + 1}`}
              >
                <Trash className="w-4 h-4" weight="bold" />
              </button>
            </div>
          </Card>
        ))}
        {/* Existing role names as suggestions while typing */}
        <datalist id={`precast-roles-${showId}`}>
          {roles.map((r) => (
            <option key={r.id} value={r.name} />
          ))}
        </datalist>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <button
            onClick={() => setDrafts((prev) => [...prev, { ...EMPTY_ROW }])}
            className="flex items-center gap-1.5 text-xs font-semibold text-stage-600 hover:text-stage-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            Add another row
          </button>
          <Button
            size="sm"
            onClick={submitDrafts}
            loading={saveMutation.isPending}
            disabled={filledDrafts.length === 0}
          >
            Save Cast {filledDrafts.length > 1 ? `(${filledDrafts.length})` : "Member"}
          </Button>
        </div>
      </div>

      {/* ── Review & send invitations (the ONLY place emails fire) ── */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review & Send Invitations"
      >
        <div className="py-4 flex flex-col gap-4">
          <p className="text-sm text-clay-500">
            Double-check the emails below — this is your typo net. People with
            an Overture account get an in-app heads-up (plus email); everyone
            else gets a warm invitation to create their free account, which
            connects them to the cast automatically.
          </p>
          <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
            {pendingInvites.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-cream-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-curtain-900 truncate">
                    {a.actorName || a.guestName}
                  </p>
                  <p className="text-xs text-clay-500 truncate">{a.roleName}</p>
                </div>
                <span className="text-xs text-clay-500 truncate flex-shrink min-w-0">
                  {a.actorId ? "Has an account — notified in-app" : a.guestEmail}
                </span>
              </div>
            ))}
            {pendingInvites.length === 0 && (
              <p className="text-sm text-clay-500">Everyone has been invited already.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              disabled={pendingInvites.length === 0}
              icon={<PaperPlaneTilt className="w-4 h-4" weight="bold" />}
            >
              Send {pendingInvites.length}{" "}
              {pendingInvites.length === 1 ? "Invitation" : "Invitations"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
