"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/features/auth/useOrg";
import {
  getOrg,
  getShows,
  getShowTeam,
  getOrgMembers,
  updateOrg,
  inviteOrgMember,
  updateOrgMemberRole,
  removeOrgMember,
  getVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  getOrgLeadership,
  createOrgLeader,
  updateOrgLeader,
  deleteOrgLeader,
  getOrgPhotos,
  addOrgPhoto,
  deleteOrgPhoto,
} from "@/lib/api/client";
import {
  getOrgPastProductions,
  createOrgPastProduction,
  updateOrgPastProduction,
  deleteOrgPastProduction,
  updateOrgPhotoMeta,
} from "@/lib/api/client";
import { uploadOrgLogo } from "@/lib/api/photos";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  Card,
  Badge,
  Button,
  Avatar,
  Input,
  Textarea,
  Modal,
  SectionHeader,
  PageSkeleton,
  RichTextEditor,
  Markdown,
  useToast,
} from "@/components/ui";
import { formatTeamRole } from "@/lib/utils";
import {
  PencilSimple,
  Plus,
  Trash,
  MapPin,
  Globe,
  ArrowSquareOut,
  EnvelopeSimple,
  ShieldCheck,
  UsersThree,
  Scroll,
  Buildings,
  Wheelchair,
  Car,
  Armchair,
  Star,
  Images,
  CircleNotch,
  FacebookLogo,
  InstagramLogo,
  Ticket,
  CalendarStar,
  Camera,
  MaskHappy,
} from "@phosphor-icons/react";
import type { OrgMember, ShowTeamMember, Show, Venue, OrgLeader, OrgPhoto, SpaceType, OrgPastProduction } from "@/types";

const ROLE_LABELS: Record<OrgMember["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_DESCRIPTIONS: Record<"admin" | "member", string> = {
  admin: "Can manage the theatre, create shows, and see every production.",
  member: "Can see the theatre; production access comes from being added to a show's team.",
};

export default function TheatreHubPage() {
  const { org: myOrg, isLoading: orgLoading } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const orgId = myOrg?.id ?? "";

  const { data: org, isLoading } = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => getOrg(orgId),
    enabled: !!orgId,
  });

  const { data: members } = useQuery({
    queryKey: ["orgMembers", orgId],
    queryFn: () => getOrgMembers(orgId),
    enabled: !!orgId,
  });

  const { data: shows } = useQuery({
    queryKey: ["shows", orgId],
    queryFn: () => getShows({ orgId }),
    enabled: !!orgId,
  });

  // Show-scoped collaborators: everyone on any of this org's show teams
  const { data: collaborators } = useQuery({
    queryKey: ["orgCollaborators", orgId, shows?.length],
    queryFn: async () => {
      const teams = await Promise.all((shows ?? []).map((s) => getShowTeam(s.id)));
      return teams.flat();
    },
    enabled: !!shows && shows.length > 0,
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [conductOpen, setConductOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Logo upload (cloud-only)
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isSupabaseConfigured) {
      toast("info", "Logo upload is available once your theatre is on the cloud.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("error", "That file is over 10MB — try a smaller one.");
      return;
    }
    setLogoUploading(true);
    try {
      await uploadOrgLogo(orgId, file);
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      queryClient.invalidateQueries({ queryKey: ["myOrg"] });
      toast("success", "Logo updated!");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeOrgMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgMembers", orgId] });
      toast("info", "Member removed.");
      setConfirmRemoveId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgMember["role"] }) =>
      updateOrgMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgMembers", orgId] });
      toast("success", "Role updated.");
    },
    onError: (err: Error) => toast("error", err.message),
  });

  if (orgLoading || isLoading || !org) return <PageSkeleton />;

  // Group show-scoped collaborators by person across shows
  const collaboratorsByPerson = new Map<
    string,
    { name: string; entries: { member: ShowTeamMember; show: Show | undefined }[] }
  >();
  for (const member of collaborators ?? []) {
    // Skip people who are already org members
    if (members?.some((m) => m.userId === member.userId)) continue;
    const key = member.userId;
    const entry = collaboratorsByPerson.get(key) ?? { name: member.userName, entries: [] };
    entry.entries.push({ member, show: shows?.find((s) => s.id === member.showId) });
    collaboratorsByPerson.set(key, entry);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* ===== Header ===== */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="block rounded-full focus:outline-none focus:ring-2 focus:ring-stage-300"
              aria-label="Change theatre logo"
            >
              <Avatar
                name={org.name}
                imageUrl={org.logoUrl}
                variant="org"
                size="lg"
                className="bg-stage-100 text-stage-700"
              />
            </button>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-cream-300 shadow-sm hover:bg-cream-50 transition-colors"
              aria-label="Change theatre logo"
            >
              {logoUploading ? (
                <CircleNotch className="w-3.5 h-3.5 text-stage-500 animate-spin" weight="bold" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
              )}
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />
          </div>
          <div>
            <h1 className="text-3xl font-display text-curtain-900">{org.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-clay-500">
              {(org.city || org.state) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                  {[org.city, org.state].filter(Boolean).join(", ")}
                </span>
              )}
              <Link
                href={`/theatres/${org.id}`}
                className="flex items-center gap-1.5 hover:text-curtain-800 transition"
              >
                <ArrowSquareOut className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                View public page
              </Link>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDetailsOpen(true)}
          icon={<PencilSimple className="w-4 h-4" weight="bold" />}
        >
          Edit
        </Button>
      </div>

      {/* ===== Details ===== */}
      <div className="mb-8">
        <SectionHeader>About</SectionHeader>
        <Card variant="flat">
          {org.mission || org.description ? (
            <Markdown>{org.mission ?? org.description}</Markdown>
          ) : (
            <p className="text-sm text-clay-400">
              No mission yet. Tell actors and directors who you are — it leads your public page.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-sm text-clay-500">
            {org.foundedYear && (
              <span className="flex items-center gap-1.5">
                <CalendarStar className="w-4 h-4 text-stage-500" weight="duotone" />
                Est. {org.foundedYear}
              </span>
            )}
            {org.websiteUrl && (
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-stage-500" weight="duotone" />
                Website
              </span>
            )}
            {org.ticketingUrl && (
              <span className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-stage-500" weight="duotone" />
                Ticketing
              </span>
            )}
            {org.facebookUrl && (
              <span className="flex items-center gap-1.5">
                <FacebookLogo className="w-4 h-4 text-stage-500" weight="duotone" />
                Facebook
              </span>
            )}
            {org.instagramUrl && (
              <span className="flex items-center gap-1.5">
                <InstagramLogo className="w-4 h-4 text-stage-500" weight="duotone" />
                Instagram
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* ===== Performance Spaces ===== */}
      <VenuesSection orgId={orgId} />

      {/* ===== Key People ===== */}
      <LeadershipSection orgId={orgId} />

      {/* ===== Photos ===== */}
      <OrgPhotosSection orgId={orgId} />

      {/* ===== Past Productions ===== */}
      <PastProductionsSection orgId={orgId} />

      {/* ===== Code of Conduct ===== */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader className="mb-0">Code of Conduct</SectionHeader>
          <button
            onClick={() => setConductOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
            aria-label="Edit code of conduct"
          >
            <PencilSimple className="w-3.5 h-3.5" weight="bold" />
          </button>
        </div>
        {org.codeOfConduct ? (
          <Card variant="flat">
            <div className="flex items-start gap-3">
              <Scroll className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
              <Markdown className="flex-1">{org.codeOfConduct}</Markdown>
            </div>
          </Card>
        ) : (
          <Card variant="sunken" className="text-center py-8">
            <Scroll className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
            <p className="text-sm text-clay-500 mb-4 max-w-sm mx-auto">
              Set expectations for your company. Your code of conduct appears on your
              public theatre page and is shown to actors when they accept a role.
            </p>
            <Button size="sm" variant="outline" onClick={() => setConductOpen(true)}>
              Add Code of Conduct
            </Button>
          </Card>
        )}
      </div>

      {/* ===== Theatre Members ===== */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader className="mb-0">Theatre Members</SectionHeader>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInviteOpen(true)}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Invite
          </Button>
        </div>
        <p className="text-xs text-clay-500 mb-3">
          Members belong to the theatre itself. Admins can manage the theatre and create
          shows; members see the theatre and join productions they&apos;re added to.
        </p>
        <div className="flex flex-col gap-3">
          {(members ?? []).map((member) =>
            confirmRemoveId === member.id ? (
              <Card key={member.id} variant="flat" padding="compact">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-curtain-800">
                    Remove <span className="font-semibold">{member.name}</span> from the theatre?
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeMutation.mutate(member.id)}
                      disabled={removeMutation.isPending}
                    >
                      {removeMutation.isPending ? "..." : "Remove"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card key={member.id} variant="flat" padding="compact">
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-curtain-900 truncate">
                        {member.name}
                      </p>
                      {member.role === "owner" && (
                        <ShieldCheck className="w-4 h-4 text-stage-500" weight="duotone" />
                      )}
                      {member.status === "invited" && (
                        <Badge variant="warning" size="sm">Invited</Badge>
                      )}
                    </div>
                    <p className="text-xs text-clay-500 truncate">{member.email}</p>
                  </div>
                  {member.role === "owner" ? (
                    <Badge variant="gold" size="sm">Owner</Badge>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          roleMutation.mutate({
                            memberId: member.id,
                            role: e.target.value as OrgMember["role"],
                          })
                        }
                        className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-cream-300 bg-cream-50 text-curtain-700 outline-none focus:ring-2 focus:ring-curtain-200"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                      <button
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors"
                        aria-label={`Remove ${member.name}`}
                      >
                        <Trash className="w-4 h-4" weight="bold" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            )
          )}
        </div>
      </div>

      {/* ===== Show Collaborators (show-scoped) ===== */}
      <div className="mb-8">
        <SectionHeader>Show Collaborators</SectionHeader>
        <p className="text-xs text-clay-500 mb-3">
          Invited to a single production from its Setup page — directors, SMs,
          choreographers, designers. They see only the shows they&apos;re part of.
        </p>
        {collaboratorsByPerson.size > 0 ? (
          <div className="flex flex-col gap-3">
            {[...collaboratorsByPerson.entries()].map(([userId, person]) => (
              <Card key={userId} variant="flat" padding="compact">
                <div className="flex items-start gap-3">
                  <Avatar name={person.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-curtain-900">{person.name}</p>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {person.entries.map(({ member, show }) => (
                        <p key={member.id} className="text-xs text-clay-500">
                          {formatTeamRole(member.role)}
                          <span className="text-clay-400"> · </span>
                          <span className="font-display text-curtain-700">
                            {show?.title ?? "Unknown show"}
                          </span>
                          {member.canEvaluate && (
                            <span className="text-stage-600"> · evaluator</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card variant="sunken" className="text-center py-8">
            <UsersThree className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
            <p className="text-sm text-clay-500 max-w-sm mx-auto">
              No show-scoped collaborators yet. Add them from a show&apos;s Setup page —
              they&apos;ll appear here across all your productions.
            </p>
          </Card>
        )}
      </div>

      {/* Modals */}
      <TheatreDetailsModal org={org} open={detailsOpen} onClose={() => setDetailsOpen(false)} />
      <CodeOfConductModal org={org} open={conductOpen} onClose={() => setConductOpen(false)} />
      <InviteMemberModal orgId={orgId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

/* ============================================================
   Theatre Details Modal
   ============================================================ */

function TheatreDetailsModal({
  org,
  open,
  onClose,
}: {
  org: NonNullable<Awaited<ReturnType<typeof getOrg>>>;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [mission, setMission] = useState(org.mission ?? "");
  const [city, setCity] = useState(org.city ?? "");
  const [stateVal, setStateVal] = useState(org.state ?? "");
  const [foundedYear, setFoundedYear] = useState(org.foundedYear ? String(org.foundedYear) : "");
  const [websiteUrl, setWebsiteUrl] = useState(org.websiteUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(org.facebookUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(org.instagramUrl ?? "");
  const [ticketingUrl, setTicketingUrl] = useState(org.ticketingUrl ?? "");

  const mutation = useMutation({
    mutationFn: () => {
      const yearNum = foundedYear.trim() ? parseInt(foundedYear.trim(), 10) : null;
      return updateOrg(org.id, {
        name: name.trim(),
        description: description.trim() || null,
        mission: mission.trim() || null,
        city: city.trim() || null,
        state: stateVal.trim() || null,
        foundedYear: yearNum && !Number.isNaN(yearNum) ? yearNum : null,
        websiteUrl: websiteUrl.trim() || null,
        facebookUrl: facebookUrl.trim() || null,
        instagramUrl: instagramUrl.trim() || null,
        ticketingUrl: ticketingUrl.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", org.id] });
      queryClient.invalidateQueries({ queryKey: ["myOrg"] });
      toast("success", "Theatre updated!");
      onClose();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Edit Theatre">
      <div className="flex flex-col gap-4">
        <Input label="Theatre Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea
          label="Description"
          rows={2}
          placeholder="A short line for cards and search results..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <RichTextEditor
          label="Mission / About"
          rows={5}
          placeholder="Who you are, what you produce, and what it's like to work with your company. This is the heart of your public page — actors and directors read it to decide whether to join you."
          value={mission}
          onChange={setMission}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label="State" placeholder="CA" value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
          <Input
            label="Founded"
            type="number"
            placeholder="1985"
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
          />
        </div>
        <Input
          label="Website"
          placeholder="https://..."
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
        />
        <Input
          label="Ticketing Link"
          placeholder="https://..."
          value={ticketingUrl}
          onChange={(e) => setTicketingUrl(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Facebook"
            placeholder="https://facebook.com/..."
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
          />
          <Input
            label="Instagram"
            placeholder="https://instagram.com/..."
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim()}
        >
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================================================
   Code of Conduct Modal
   ============================================================ */

function CodeOfConductModal({
  org,
  open,
  onClose,
}: {
  org: NonNullable<Awaited<ReturnType<typeof getOrg>>>;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState(org.codeOfConduct ?? "");

  const mutation = useMutation({
    mutationFn: () => updateOrg(org.id, { codeOfConduct: text.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", org.id] });
      toast("success", "Code of conduct saved!");
      onClose();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Code of Conduct">
      <p className="text-xs text-clay-500 mb-4">
        Shown on your public theatre page. Sets expectations for everyone in your company —
        actors, crew, and volunteers.
      </p>
      <RichTextEditor
        rows={10}
        placeholder="Our company is committed to..."
        value={text}
        onChange={setText}
      />
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================================================
   Invite Member Modal
   ============================================================ */

function InviteMemberModal({
  orgId,
  open,
  onClose,
}: {
  orgId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  const mutation = useMutation({
    mutationFn: () => inviteOrgMember(orgId, { name, email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgMembers", orgId] });
      toast("success", `Invite recorded for ${name.trim()}.`);
      setName("");
      setEmail("");
      setRole("member");
      onClose();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const isValid = name.trim() && email.trim().includes("@");

  return (
    <Modal open={open} onClose={onClose} title="Invite to Theatre">
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Email"
          type="email"
          placeholder="them@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Role picker with explanations */}
        <div>
          <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
            Theatre Role
          </label>
          <div className="flex flex-col gap-2">
            {(["admin", "member"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                  role === r
                    ? "border-stage-400 bg-stage-50"
                    : "border-cream-300 bg-white hover:border-cream-400"
                }`}
              >
                <p className="text-sm font-semibold text-curtain-900">{ROLE_LABELS[r]}</p>
                <p className="text-xs text-clay-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-cream-50 border border-cream-200">
          <EnvelopeSimple className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
          <p className="text-[11px] text-clay-500 leading-relaxed">
            They&apos;ll appear as pending, and anyone who signs in or signs up with this
            email joins automatically. Invite emails are coming soon — for now, let them
            know directly.
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !isValid}
        >
          {mutation.isPending ? "Sending..." : "Send Invite"}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================================================
   Performance Spaces (venues)
   ============================================================ */

const EMPTY_VENUE = {
  name: "",
  address: "",
  capacity: "",
  accessibilityNotes: "",
  parkingNotes: "",
  isPrimary: false,
  spaceType: "performance" as SpaceType,
};

const SPACE_TYPES: { value: SpaceType; label: string }[] = [
  { value: "performance", label: "Performance" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "other", label: "Other" },
];

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  performance: "Performance",
  rehearsal: "Rehearsal",
  other: "Other",
};

function VenuesSection({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Venue | "new" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: venues } = useQuery({
    queryKey: ["venues", orgId],
    queryFn: () => getVenues(orgId),
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues", orgId] });
      toast("info", "Space removed.");
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const list = venues ?? [];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader className="mb-0">Spaces</SectionHeader>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing("new")}
          icon={<Plus className="w-4 h-4" weight="bold" />}
        >
          Add Space
        </Button>
      </div>
      <p className="text-xs text-clay-500 mb-3">
        Where you rehearse and perform. Address, capacity, and accessibility help actors
        and designers decide whether they can work with you — they show on your public page.
      </p>

      {list.length > 0 ? (
        <div className="flex flex-col gap-3">
          {list.map((venue) =>
            confirmDeleteId === venue.id ? (
              <Card key={venue.id} variant="flat" padding="compact">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-curtain-800">
                    Remove <span className="font-semibold">{venue.name}</span>?
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(venue.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Remove
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card key={venue.id} variant="flat">
                <div className="flex items-start gap-3">
                  <Buildings className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-display text-curtain-900">{venue.name}</p>
                      {venue.isPrimary && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-stage-600 tracking-wide uppercase">
                          <Star className="w-3 h-3" weight="fill" />
                          Main
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                        {SPACE_TYPE_LABELS[venue.spaceType]}
                      </span>
                    </div>
                    {venue.address && (
                      <p className="text-sm text-clay-500 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                        {venue.address}
                      </p>
                    )}
                    <div className="flex flex-col gap-1 mt-2">
                      {venue.capacity != null && (
                        <p className="flex items-center gap-2 text-sm text-curtain-800">
                          <Armchair className="w-4 h-4 text-stage-500 flex-shrink-0" weight="duotone" />
                          Seats {venue.capacity}
                        </p>
                      )}
                      {venue.accessibilityNotes && (
                        <p className="flex items-start gap-2 text-sm text-curtain-800">
                          <Wheelchair className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                          <span>{venue.accessibilityNotes}</span>
                        </p>
                      )}
                      {venue.parkingNotes && (
                        <p className="flex items-start gap-2 text-sm text-curtain-800">
                          <Car className="w-4 h-4 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                          <span>{venue.parkingNotes}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditing(venue)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                      aria-label={`Edit ${venue.name}`}
                    >
                      <PencilSimple className="w-4 h-4" weight="bold" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(venue.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors"
                      aria-label={`Remove ${venue.name}`}
                    >
                      <Trash className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          )}
        </div>
      ) : (
        <Card variant="sunken" className="text-center py-8">
          <Buildings className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
          <p className="text-sm text-clay-500 mb-4 max-w-sm mx-auto">
            Add your stage(s) and rehearsal spaces. New shows pre-fill their audition and
            performance locations from your main space.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            Add Your First Space
          </Button>
        </Card>
      )}

      <VenueModal
        orgId={orgId}
        venue={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function VenueModal({
  orgId,
  venue,
  open,
  onClose,
}: {
  orgId: string;
  venue: Venue | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_VENUE });

  // Sync the form whenever the target venue changes (open for add vs edit).
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const key = venue?.id ?? "new";
  if (open && syncedFor !== key) {
    setForm(
      venue
        ? {
            name: venue.name,
            address: venue.address ?? "",
            capacity: venue.capacity != null ? String(venue.capacity) : "",
            accessibilityNotes: venue.accessibilityNotes ?? "",
            parkingNotes: venue.parkingNotes ?? "",
            isPrimary: venue.isPrimary,
            spaceType: venue.spaceType,
          }
        : { ...EMPTY_VENUE }
    );
    setSyncedFor(key);
  }
  if (!open && syncedFor !== null) setSyncedFor(null);

  const mutation = useMutation({
    mutationFn: () => {
      const cap = form.capacity.trim() ? parseInt(form.capacity.trim(), 10) : null;
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        capacity: cap && !Number.isNaN(cap) ? cap : null,
        accessibilityNotes: form.accessibilityNotes.trim() || null,
        parkingNotes: form.parkingNotes.trim() || null,
        isPrimary: form.isPrimary,
        spaceType: form.spaceType,
      };
      return venue ? updateVenue(venue.id, orgId, payload) : createVenue(orgId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues", orgId] });
      toast("success", venue ? "Space updated." : "Space added.");
      onClose();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={venue ? "Edit Space" : "Add a Space"}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          placeholder="The Riverside Playhouse"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div>
          <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
            Type
          </label>
          <div className="flex gap-2">
            {SPACE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm({ ...form, spaceType: t.value })}
                className={`flex-1 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                  form.spaceType === t.value
                    ? "border-stage-400 bg-stage-50 text-curtain-900"
                    : "border-cream-300 bg-white text-clay-500 hover:border-cream-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="Address"
          placeholder="412 Main Street, Riverside, CA 92501"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Input
          label="Capacity (seats)"
          type="number"
          placeholder="220"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
        />
        <Textarea
          label="Accessibility"
          rows={3}
          placeholder="Step-free entrance, wheelchair seating, accessible restrooms, assistive listening..."
          value={form.accessibilityNotes}
          onChange={(e) => setForm({ ...form, accessibilityNotes: e.target.value })}
        />
        <Textarea
          label="Parking"
          rows={2}
          placeholder="Free municipal lot behind the theatre; ADA spaces by the stage door."
          value={form.parkingNotes}
          onChange={(e) => setForm({ ...form, parkingNotes: e.target.value })}
        />
        <button
          onClick={() => setForm({ ...form, isPrimary: !form.isPrimary })}
          className={`flex items-center gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
            form.isPrimary ? "border-stage-400 bg-stage-50" : "border-cream-300 bg-white hover:border-cream-400"
          }`}
        >
          <Star
            className={form.isPrimary ? "w-5 h-5 text-stage-500" : "w-5 h-5 text-clay-300"}
            weight={form.isPrimary ? "fill" : "duotone"}
          />
          <span>
            <span className="block text-sm font-semibold text-curtain-900">Main stage</span>
            <span className="block text-xs text-clay-500">
              New shows default their locations to this space.
            </span>
          </span>
        </button>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name.trim()}
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================================================
   Key People (org leadership)
   ============================================================ */

function LeadershipSection({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<OrgLeader | "new" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: leaders } = useQuery({
    queryKey: ["orgLeadership", orgId],
    queryFn: () => getOrgLeadership(orgId),
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrgLeader(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgLeadership", orgId] });
      toast("info", "Removed.");
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const list = leaders ?? [];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader className="mb-0">Key People</SectionHeader>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing("new")}
          icon={<Plus className="w-4 h-4" weight="bold" />}
        >
          Add Person
        </Button>
      </div>
      <p className="text-xs text-clay-500 mb-3">
        Your artistic and managing leadership, board, or resident staff. Shown publicly so
        people know who runs the company. They don&apos;t need Overture accounts.
      </p>

      {list.length > 0 ? (
        <div className="flex flex-col gap-3">
          {list.map((leader) =>
            confirmDeleteId === leader.id ? (
              <Card key={leader.id} variant="flat" padding="compact">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-curtain-800">
                    Remove <span className="font-semibold">{leader.name}</span>?
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(leader.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Remove
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card key={leader.id} variant="flat" padding="compact">
                <div className="flex items-center gap-3">
                  <Avatar name={leader.name} imageUrl={leader.photoUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-curtain-900 truncate">{leader.name}</p>
                    {leader.title && (
                      <p className="text-xs text-clay-500 truncate">{leader.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditing(leader)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                      aria-label={`Edit ${leader.name}`}
                    >
                      <PencilSimple className="w-4 h-4" weight="bold" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(leader.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors"
                      aria-label={`Remove ${leader.name}`}
                    >
                      <Trash className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          )}
        </div>
      ) : (
        <Card variant="sunken" className="text-center py-8">
          <UsersThree className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
          <p className="text-sm text-clay-500 mb-4 max-w-sm mx-auto">
            Introduce the people who lead your company. A familiar face or a respected
            artistic director makes a theatre feel trustworthy to join.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            Add Your First Person
          </Button>
        </Card>
      )}

      <LeaderModal
        orgId={orgId}
        leader={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function LeaderModal({
  orgId,
  leader,
  open,
  onClose,
}: {
  orgId: string;
  leader: OrgLeader | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");

  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const key = leader?.id ?? "new";
  if (open && syncedFor !== key) {
    setName(leader?.name ?? "");
    setTitle(leader?.title ?? "");
    setSyncedFor(key);
  }
  if (!open && syncedFor !== null) setSyncedFor(null);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), title: title.trim() || null, photoUrl: leader?.photoUrl ?? null };
      return leader ? updateOrgLeader(leader.id, payload) : createOrgLeader(orgId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgLeadership", orgId] });
      toast("success", leader ? "Updated." : "Added.");
      onClose();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={leader ? "Edit Person" : "Add a Person"}>
      <div className="flex flex-col gap-4">
        <Input label="Name" placeholder="Sarah Mitchell" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Title / Role"
          placeholder="Artistic Director"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim()}
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================================================
   Photos (venue + production gallery) — cloud-only upload
   ============================================================ */

function OrgPhotosSection({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const venueInputRef = useRef<HTMLInputElement>(null);
  const productionInputRef = useRef<HTMLInputElement>(null);
  const [uploadingKind, setUploadingKind] = useState<"venue" | "production" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [captionEdit, setCaptionEdit] = useState<{ id: string; value: string } | null>(null);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["orgPhotos", orgId],
    queryFn: () => getOrgPhotos(orgId),
    enabled: !!orgId,
  });

  const captionMutation = useMutation({
    mutationFn: ({ id, caption }: { id: string; caption: string | null }) =>
      updateOrgPhotoMeta(id, { caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgPhotos", orgId] });
      toast("success", "Caption saved.");
      setCaptionEdit(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (photo: OrgPhoto) => deleteOrgPhoto(photo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgPhotos", orgId] });
      toast("info", "Photo removed.");
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  async function handleFiles(kind: "venue" | "production", e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingKind(kind);
    try {
      for (const file of files) {
        await addOrgPhoto(orgId, file, { kind, caption: null });
      }
      queryClient.invalidateQueries({ queryKey: ["orgPhotos", orgId] });
      toast("success", files.length === 1 ? "Photo uploaded!" : `${files.length} photos uploaded!`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingKind(null);
    }
  }

  const list = photos ?? [];

  // Mock mode: storage uploads aren't available. Show a clear note (no dead button).
  if (!isSupabaseConfigured) {
    return (
      <div className="mb-8">
        <SectionHeader>Photos</SectionHeader>
        <Card variant="sunken" className="text-center py-8">
          <Images className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
          <p className="text-sm text-clay-500 max-w-sm mx-auto">
            Venue and production photos upload once your theatre is on the cloud. They&apos;ll
            appear in a gallery on your public page.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader className="mb-0">Photos</SectionHeader>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            loading={uploadingKind === "venue"}
            onClick={() => venueInputRef.current?.click()}
            icon={<Buildings className="w-4 h-4" weight="bold" />}
          >
            Venue
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={uploadingKind === "production"}
            onClick={() => productionInputRef.current?.click()}
            icon={<Plus className="w-4 h-4" weight="bold" />}
          >
            Production
          </Button>
        </div>
      </div>
      <p className="text-xs text-clay-500 mb-3">
        Show your spaces and your work. Venue shots help actors picture where they&apos;d
        perform; production stills show the caliber of your shows.
      </p>

      <input
        ref={venueInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles("venue", e)}
      />
      <input
        ref={productionInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles("production", e)}
      />

      {isLoading ? (
        <Card variant="flat" className="text-center py-8">
          <CircleNotch className="w-6 h-6 text-stage-500 animate-spin mx-auto" weight="bold" />
        </Card>
      ) : list.length === 0 && !uploadingKind ? (
        <Card variant="sunken" className="text-center py-8">
          <Images className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
          <p className="text-sm text-clay-500 max-w-sm mx-auto">
            No photos yet. Add a few of your venue and recent productions — they make your
            public page feel alive.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.map((photo) => (
            <Card key={photo.id} variant="elevated" padding="compact">
              <img
                src={photo.publicUrl}
                alt={photo.caption ?? `${photo.kind} photo`}
                className="w-full aspect-square rounded-lg object-cover mb-2"
              />
              {confirmDeleteId === photo.id ? (
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
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : captionEdit?.id === photo.id ? (
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Add a caption..."
                    value={captionEdit.value}
                    onChange={(e) => setCaptionEdit({ id: photo.id, value: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={captionMutation.isPending}
                      onClick={() =>
                        captionMutation.mutate({
                          id: photo.id,
                          caption: captionEdit.value.trim() || null,
                        })
                      }
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCaptionEdit(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {photo.caption && (
                    <p className="text-xs text-curtain-800 leading-snug">{photo.caption}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-stage-600 tracking-wide uppercase">
                      {photo.kind}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCaptionEdit({ id: photo.id, value: photo.caption ?? "" })}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                        aria-label="Edit caption"
                      >
                        <PencilSimple className="w-3.5 h-3.5" weight="bold" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(photo.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-600 hover:bg-cream-100 transition-colors"
                        aria-label="Delete photo"
                      >
                        <Trash className="w-3.5 h-3.5" weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {uploadingKind && (
            <Card variant="flat" padding="compact" className="flex items-center justify-center aspect-square">
              <CircleNotch className="w-6 h-6 text-stage-500 animate-spin" weight="bold" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Past Productions (manual history — Build A)
   ============================================================ */

function PastProductionsSection({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<OrgPastProduction | "new" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: productions } = useQuery({
    queryKey: ["orgPastProductions", orgId],
    queryFn: () => getOrgPastProductions(orgId),
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrgPastProduction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgPastProductions", orgId] });
      toast("info", "Removed.");
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const list = (productions ?? [])
    .slice()
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader className="mb-0">Past Productions</SectionHeader>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing("new")}
          icon={<Plus className="w-4 h-4" weight="bold" />}
        >
          Add Production
        </Button>
      </div>
      <p className="text-xs text-clay-500 mb-3">
        Shows you produced before Overture. These merge with productions tracked here and
        appear on your public page — a track record makes a theatre feel established.
      </p>

      {list.length > 0 ? (
        <div className="flex flex-col gap-3">
          {list.map((p) =>
            confirmDeleteId === p.id ? (
              <Card key={p.id} variant="flat" padding="compact">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-curtain-800">
                    Remove <span className="font-semibold">{p.title}</span>?
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Remove
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card key={p.id} variant="flat" padding="compact">
                <div className="flex items-start gap-3">
                  <MaskHappy className="w-5 h-5 text-stage-500 flex-shrink-0 mt-0.5" weight="duotone" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-curtain-900">
                      <span className="font-display">{p.title}</span>
                      {p.year && <span className="text-clay-500"> — {p.year}</span>}
                    </p>
                    {p.notes && <p className="text-xs text-clay-500 mt-0.5">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditing(p)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-curtain-700 hover:bg-cream-100 transition-colors"
                      aria-label={`Edit ${p.title}`}
                    >
                      <PencilSimple className="w-4 h-4" weight="bold" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-clay-400 hover:text-ruby-500 hover:bg-cream-100 transition-colors"
                      aria-label={`Remove ${p.title}`}
                    >
                      <Trash className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          )}
        </div>
      ) : (
        <Card variant="sunken" className="text-center py-8">
          <MaskHappy className="w-10 h-10 text-clay-300 mx-auto mb-3" weight="duotone" />
          <p className="text-sm text-clay-500 mb-4 max-w-sm mx-auto">
            Add the shows you&apos;ve staged. Your production history shows actors and
            directors you&apos;re an established company worth joining.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            Add Your First Production
          </Button>
        </Card>
      )}

      <PastProductionModal
        orgId={orgId}
        production={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function PastProductionModal({
  orgId,
  production,
  open,
  onClose,
}: {
  orgId: string;
  production: OrgPastProduction | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [notes, setNotes] = useState("");

  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const key = production?.id ?? "new";
  if (open && syncedFor !== key) {
    setTitle(production?.title ?? "");
    setYear(production?.year != null ? String(production.year) : "");
    setNotes(production?.notes ?? "");
    setSyncedFor(key);
  }
  if (!open && syncedFor !== null) setSyncedFor(null);

  const mutation = useMutation({
    mutationFn: () => {
      const yearNum = year.trim() ? parseInt(year.trim(), 10) : null;
      const payload = {
        title: title.trim(),
        year: yearNum && !Number.isNaN(yearNum) ? yearNum : null,
        notes: notes.trim() || null,
      };
      return production
        ? updateOrgPastProduction(production.id, payload)
        : createOrgPastProduction(orgId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgPastProductions", orgId] });
      toast("success", production ? "Updated." : "Added.");
      onClose();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={production ? "Edit Production" : "Add a Production"}>
      <div className="flex flex-col gap-4">
        <Input
          label="Title"
          placeholder="Fiddler on the Roof"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          label="Year"
          type="number"
          placeholder="2019"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <Textarea
          label="Notes (optional)"
          rows={2}
          placeholder="A sell-out run; our 35th-anniversary opener..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !title.trim()}
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
