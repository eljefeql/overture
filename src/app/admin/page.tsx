"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  isPlatformAdmin,
  getAdminDirectory,
  adminUpdateOrg,
  adminArchiveOrg,
  adminDeleteOrg,
  adminDeleteUser,
  adminRemoveOrgMember,
  sendPasswordResetEmail,
  normalizeOrgName,
  type AdminTheatreRow,
  type AdminPersonRow,
  type AdminShowRow,
} from "@/lib/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageSkeleton,
  useToast,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  Archive,
  ArrowCounterClockwise,
  Buildings,
  Compass,
  CopySimple,
  EnvelopeSimple,
  MagnifyingGlass,
  MaskHappy,
  PencilSimple,
  Trash,
  UsersThree,
  X,
} from "@phosphor-icons/react";

/* ============================================================
   Platform admin — "god mode" v1 (QC #28, owner-approved).

   Gated on the is_platform_admin() RPC (migration 021; SQL-only
   membership). Non-admins see a "page not found" empty state so
   the route advertises nothing. Three directory sections —
   Theatres / People / Shows — with search, possible-duplicate
   badges, and guarded repair actions (edit basics, archive,
   hard delete, remove membership, delete user, password reset).

   Mock mode renders the directory read-only for development;
   every action is cloud-only and says so in a toast.
   ============================================================ */

type TabKey = "theatres" | "people" | "shows";

const SHOW_STATUS_LABEL: Record<string, string> = {
  setup: "Setup",
  auditions_open: "Auditions open",
  auditions_closed: "Auditions closed",
  callbacks: "Callbacks",
  casting: "Casting",
  cast: "Cast",
  archived: "Archived",
};

const SHOW_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "gold" | "muted"
> = {
  setup: "muted",
  auditions_open: "success",
  auditions_closed: "warning",
  callbacks: "gold",
  casting: "gold",
  cast: "default",
  archived: "muted",
};

const VISIBLE_CAP = 40;

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>("theatres");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Theatre action state
  const [editOrg, setEditOrg] = useState<AdminTheatreRow | null>(null);
  const [archiveOrg, setArchiveOrg] = useState<AdminTheatreRow | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<AdminTheatreRow | null>(null);
  // People action state
  const [deletePerson, setDeletePerson] = useState<AdminPersonRow | null>(null);
  const [removeMembership, setRemoveMembership] = useState<{
    person: AdminPersonRow;
    memberRowId: string;
    orgName: string;
  } | null>(null);
  const [resetsSent, setResetsSent] = useState<Record<string, boolean>>({});

  const { data: isAdmin, isLoading: gateLoading } = useQuery({
    queryKey: ["isPlatformAdmin", user?.id],
    queryFn: isPlatformAdmin,
    enabled: !!user,
  });

  const { data: directory, isLoading: dirLoading } = useQuery({
    queryKey: ["adminDirectory"],
    queryFn: getAdminDirectory,
    enabled: isAdmin === true,
  });

  // Possible duplicates: theatres sharing a normalized name in the same state.
  const duplicateIds = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const t of directory?.theatres ?? []) {
      const key = `${normalizeOrgName(t.name)}|${(t.state ?? "").trim().toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), t.id]);
    }
    const dupes = new Set<string>();
    for (const ids of groups.values()) {
      if (ids.length > 1) ids.forEach((id) => dupes.add(id));
    }
    return dupes;
  }, [directory?.theatres]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["adminDirectory"] });

  const archiveMutation = useMutation({
    mutationFn: ({ orgId, archived }: { orgId: string; archived: boolean }) =>
      adminArchiveOrg(orgId, archived),
    onSuccess: (_d, vars) => {
      invalidate();
      setArchiveOrg(null);
      toast(
        "success",
        vars.archived ? "Theatre archived — hidden from public pages." : "Theatre restored."
      );
    },
    onError: (e: Error) => toast("error", e.message),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (orgId: string) => adminDeleteOrg(orgId),
    onSuccess: () => {
      invalidate();
      setDeleteOrg(null);
      toast("success", "Theatre permanently deleted.");
    },
    onError: (e: Error) => toast("error", e.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminDeleteUser(userId),
    onSuccess: () => {
      invalidate();
      setDeletePerson(null);
      toast("success", "Account permanently deleted.");
    },
    onError: (e: Error) => toast("error", e.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberRowId: string) => adminRemoveOrgMember(memberRowId),
    onSuccess: () => {
      invalidate();
      setRemoveMembership(null);
      toast("success", "Membership removed.");
    },
    onError: (e: Error) => toast("error", e.message),
  });

  const resetMutation = useMutation({
    mutationFn: (email: string) => sendPasswordResetEmail(email),
    onSuccess: (_d, email) => {
      setResetsSent((prev) => ({ ...prev, [email]: true }));
      toast("success", "Password reset email sent.");
    },
    onError: (e: Error) => toast("error", e.message),
  });

  if (!user || gateLoading) return <PageSkeleton />;

  // Non-admins get a 404-style state — the page is never advertised.
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <EmptyState
          icon={<Compass className="w-12 h-12" weight="duotone" />}
          title="Page not found"
          description="There's nothing at this address."
        />
      </div>
    );
  }

  if (dirLoading || !directory) return <PageSkeleton />;

  const q = search.trim().toLowerCase();
  const matches = (...fields: Array<string | null>) =>
    !q || fields.some((f) => (f ?? "").toLowerCase().includes(q));

  const theatres = directory.theatres.filter((t) =>
    matches(t.name, t.city, t.state, t.ownerName, t.ownerEmail)
  );
  const people = directory.people.filter((p) =>
    matches(p.displayName, p.email, ...p.memberships.map((m) => m.orgName))
  );
  const adminShows = directory.shows.filter((s) =>
    matches(s.title, s.orgName, SHOW_STATUS_LABEL[s.status] ?? s.status)
  );

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "theatres", label: "Theatres", count: theatres.length },
    { key: "people", label: "People", count: people.length },
    { key: "shows", label: "Shows", count: adminShows.length },
  ];

  const capped = <T,>(list: T[]): { visible: T[]; hidden: number } =>
    showAll || list.length <= VISIBLE_CAP
      ? { visible: list, hidden: 0 }
      : { visible: list.slice(0, VISIBLE_CAP), hidden: list.length - VISIBLE_CAP };

  const theatreList = capped(theatres);
  const peopleList = capped(people);
  const showList = capped(adminShows);
  const hiddenCount =
    tab === "theatres"
      ? theatreList.hidden
      : tab === "people"
        ? peopleList.hidden
        : showList.hidden;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-display text-curtain-900">Platform Admin</h1>
        <p className="text-sm text-clay-500 mt-1">
          Every theatre, person, and show on Overture.
          {!isSupabaseConfigured && " Mock data — admin actions are cloud-only."}
        </p>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setShowAll(false);
              }}
              className={
                tab === t.key
                  ? "px-4 py-2 rounded-xl bg-curtain-800 text-white text-sm font-semibold"
                  : "px-4 py-2 rounded-xl bg-cream-100 text-curtain-700 text-sm font-semibold hover:bg-cream-200 transition"
              }
            >
              {t.label}
              <span className={tab === t.key ? "ml-1.5 opacity-70" : "ml-1.5 text-clay-400"}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 md:max-w-xs md:ml-auto">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clay-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}...`}
            aria-label={`Search ${tab}`}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 placeholder:text-clay-400 outline-none focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300 transition-colors"
          />
        </div>
      </div>

      {/* ── Theatres ─────────────────────────────────────────── */}
      {tab === "theatres" && (
        <div className="flex flex-col gap-3">
          {theatreList.visible.length === 0 && (
            <EmptyState
              icon={<Buildings className="w-12 h-12" weight="duotone" />}
              title={q ? "No theatres match" : "No theatres yet"}
              description={q ? "Try a different search." : undefined}
            />
          )}
          {theatreList.visible.map((t) => (
            <Card key={t.id} variant="elevated" padding="standard">
              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-display text-curtain-900">{t.name}</h3>
                    {t.isArchived && <Badge variant="muted">Archived</Badge>}
                    {duplicateIds.has(t.id) && (
                      <Badge variant="warning">
                        <CopySimple className="w-3.5 h-3.5" weight="duotone" />
                        Possible duplicate
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-clay-500 mt-0.5">
                    {[t.city, t.state].filter(Boolean).join(", ") || "No location"}
                    {" · "}created {formatDate(t.createdAt)}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-curtain-700 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <UsersThree className="w-4 h-4 text-stage-500" weight="duotone" />
                      {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MaskHappy className="w-4 h-4 text-stage-500" weight="duotone" />
                      {t.showCount} show{t.showCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-xs text-clay-500 mt-2">
                    Owner:{" "}
                    {t.ownerName ? (
                      <>
                        <span className="font-semibold text-curtain-700">{t.ownerName}</span>
                        {t.ownerEmail && <> · {t.ownerEmail}</>}
                      </>
                    ) : (
                      "none on record"
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap md:flex-col md:items-end">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<PencilSimple className="w-3.5 h-3.5" weight="duotone" />}
                    onClick={() => setEditOrg(t)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={
                      t.isArchived ? (
                        <ArrowCounterClockwise className="w-3.5 h-3.5" weight="duotone" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" weight="duotone" />
                      )
                    }
                    onClick={() => setArchiveOrg(t)}
                  >
                    {t.isArchived ? "Restore" : "Archive"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-ruby-500 hover:text-ruby-600"
                    icon={<Trash className="w-3.5 h-3.5" weight="duotone" />}
                    onClick={() => setDeleteOrg(t)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── People ───────────────────────────────────────────── */}
      {tab === "people" && (
        <div className="flex flex-col gap-3">
          {peopleList.visible.length === 0 && (
            <EmptyState
              icon={<UsersThree className="w-12 h-12" weight="duotone" />}
              title={q ? "No people match" : "No people yet"}
              description={q ? "Try a different search." : undefined}
            />
          )}
          {peopleList.visible.map((p) => (
            <Card key={p.id} variant="elevated" padding="standard">
              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-display text-curtain-900">{p.displayName}</h3>
                    {p.id === user.id && <Badge variant="gold">You</Badge>}
                  </div>
                  <p className="text-sm text-clay-500 mt-0.5">
                    {p.email} · joined {formatDate(p.createdAt)}
                  </p>
                  {p.memberships.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {p.memberships.map((m) => (
                        <span
                          key={m.memberRowId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream-100 border border-cream-200 text-xs font-semibold text-curtain-700"
                        >
                          {m.orgName}
                          <span className="text-clay-400 font-normal">{m.role}</span>
                          <button
                            onClick={() =>
                              setRemoveMembership({
                                person: p,
                                memberRowId: m.memberRowId,
                                orgName: m.orgName,
                              })
                            }
                            className="text-clay-400 hover:text-ruby-500 transition"
                            aria-label={`Remove ${p.displayName} from ${m.orgName}`}
                          >
                            <X className="w-3.5 h-3.5" weight="bold" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap md:flex-col md:items-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!resetsSent[p.email] || resetMutation.isPending}
                    icon={<EnvelopeSimple className="w-3.5 h-3.5" weight="duotone" />}
                    onClick={() => resetMutation.mutate(p.email)}
                  >
                    {resetsSent[p.email] ? "Reset sent" : "Send password reset"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-ruby-500 hover:text-ruby-600"
                    disabled={p.id === user.id}
                    icon={<Trash className="w-3.5 h-3.5" weight="duotone" />}
                    onClick={() => setDeletePerson(p)}
                  >
                    Delete account
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Shows ────────────────────────────────────────────── */}
      {tab === "shows" && (
        <div className="flex flex-col gap-3">
          {showList.visible.length === 0 && (
            <EmptyState
              icon={<MaskHappy className="w-12 h-12" weight="duotone" />}
              title={q ? "No shows match" : "No shows yet"}
              description={q ? "Try a different search." : undefined}
            />
          )}
          {showList.visible.map((s) => (
            <Card key={s.id} variant="elevated" padding="standard">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-display text-curtain-900">{s.title}</h3>
                  <p className="text-sm text-clay-500 mt-0.5">
                    {s.orgName} · created {formatDate(s.createdAt)}
                  </p>
                </div>
                <Badge variant={SHOW_STATUS_VARIANT[s.status] ?? "default"}>
                  {SHOW_STATUS_LABEL[s.status] ?? s.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Show all ({hiddenCount} more)
          </Button>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      {editOrg && (
        <EditTheatreModal
          theatre={editOrg}
          onClose={() => setEditOrg(null)}
          onSaved={() => {
            invalidate();
            setEditOrg(null);
            toast("success", "Theatre updated.");
          }}
          onError={(msg) => toast("error", msg)}
        />
      )}

      {archiveOrg && (
        <Modal
          open
          onClose={() => setArchiveOrg(null)}
          title={archiveOrg.isArchived ? "Restore theatre?" : "Archive theatre?"}
        >
          <p className="text-sm text-curtain-700 mb-6">
            {archiveOrg.isArchived ? (
              <>
                <span className="font-semibold">{archiveOrg.name}</span> will show up again on
                browse, discover, and its public page.
              </>
            ) : (
              <>
                <span className="font-semibold">{archiveOrg.name}</span> will be hidden from
                browse, discover, and its public page. Nothing is deleted — members can still
                reach their theatre hub, and you can restore it any time.
              </>
            )}
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setArchiveOrg(null)}>
              Cancel
            </Button>
            <Button
              loading={archiveMutation.isPending}
              onClick={() =>
                archiveMutation.mutate({
                  orgId: archiveOrg.id,
                  archived: !archiveOrg.isArchived,
                })
              }
            >
              {archiveOrg.isArchived ? "Restore" : "Archive"}
            </Button>
          </div>
        </Modal>
      )}

      {deleteOrg && (
        <TypeToConfirmModal
          title="Delete theatre forever?"
          warning={
            <>
              This permanently deletes <span className="font-semibold">{deleteOrg.name}</span> and
              everything inside it — its shows, auditions, signups, memberships, and invites.
              Member accounts are kept. This cannot be undone.
            </>
          }
          confirmWord={deleteOrg.name}
          confirmLabel="Delete theatre"
          pending={deleteOrgMutation.isPending}
          onClose={() => setDeleteOrg(null)}
          onConfirm={() => deleteOrgMutation.mutate(deleteOrg.id)}
        />
      )}

      {deletePerson && (
        <TypeToConfirmModal
          title="Delete account forever?"
          warning={
            <>
              This permanently deletes{" "}
              <span className="font-semibold">{deletePerson.displayName}</span>&apos;s account (
              {deletePerson.email}) — their profile, credits, signups, and memberships. This
              cannot be undone. Platform admins can never be deleted.
            </>
          }
          confirmWord={deletePerson.displayName}
          confirmLabel="Delete account"
          pending={deleteUserMutation.isPending}
          onClose={() => setDeletePerson(null)}
          onConfirm={() => deleteUserMutation.mutate(deletePerson.id)}
        />
      )}

      {removeMembership && (
        <Modal open onClose={() => setRemoveMembership(null)} title="Remove membership?">
          <p className="text-sm text-curtain-700 mb-6">
            Remove <span className="font-semibold">{removeMembership.person.displayName}</span>{" "}
            from <span className="font-semibold">{removeMembership.orgName}</span>? Their account
            is kept — they just lose access to this theatre.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setRemoveMembership(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeMemberMutation.isPending}
              onClick={() => removeMemberMutation.mutate(removeMembership.memberRowId)}
            >
              Remove
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Edit theatre modal (basic fixes: name / city / state) ───── */

function EditTheatreModal({
  theatre,
  onClose,
  onSaved,
  onError,
}: {
  theatre: AdminTheatreRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(theatre.name);
  const [city, setCity] = useState(theatre.city ?? "");
  const [state, setState] = useState(theatre.state ?? "");

  const mutation = useMutation({
    mutationFn: () => adminUpdateOrg(theatre.id, { name, city, state }),
    onSuccess: onSaved,
    onError: (e: Error) => onError(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Edit theatre">
      <div className="flex flex-col gap-4">
        <Input
          label="Theatre name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            maxLength={2}
            placeholder="CA"
          />
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!name.trim()}
            onClick={() => mutation.mutate()}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Type-the-name destructive confirmation ──────────────────── */

function TypeToConfirmModal({
  title,
  warning,
  confirmWord,
  confirmLabel,
  pending,
  onClose,
  onConfirm,
}: {
  title: string;
  warning: React.ReactNode;
  confirmWord: string;
  confirmLabel: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmWord.trim();

  return (
    <Modal open onClose={onClose} title={title}>
      <p className="text-sm text-curtain-700 mb-4">{warning}</p>
      <Input
        label={`Type "${confirmWord}" to confirm`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={confirmWord}
      />
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={!matches} loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
