"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { selectOrgForUser } from "@/features/auth/useOrg";
import {
  acceptOrgInvite,
  getOrgInvite,
  rememberPendingInvite,
  forgetPendingInvite,
} from "@/lib/api/client";
import { track } from "@/lib/analytics";
import { Button, Card } from "@/components/ui";
import { Buildings, CircleNotch, Warning } from "@phosphor-icons/react";

/* ============================================================
   /join/[inviteId] — the tokened theatre-invite landing page
   (migration 028). Opened from the invite email, an in-app
   notification, or a link the admin copied and texted.

   Anonymous → remember the invite, offer Create account / Sign
   in (both return here). Signed in → accept. If the signed-in
   email differs from the invited one, confirm before joining so
   nobody lands in a theatre under the wrong account by accident.
   ============================================================ */

const ROLE_LABEL: Record<string, string> = {
  owner: "an owner",
  admin: "an admin",
  member: "a member",
};

export default function JoinInvitePage() {
  const params = useParams<{ inviteId: string }>();
  const inviteId = params.inviteId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const autoAccepted = useRef(false);

  const inviteQuery = useQuery({
    queryKey: ["orgInvite", inviteId, user?.id ?? "anon"],
    queryFn: () => getOrgInvite(inviteId),
    enabled: !!inviteId && !authLoading,
    retry: 1,
  });
  const invite = inviteQuery.data;

  // Remember the link for the post-auth claim (email confirmation, Google
  // round-trip, or a password sign-in that lands somewhere else).
  useEffect(() => {
    if (inviteId && invite && invite.status === "pending" && !user) {
      rememberPendingInvite(inviteId);
    }
  }, [inviteId, invite, user]);

  async function accept() {
    if (!user || !invite) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const orgId = await acceptOrgInvite(invite.id);
      forgetPendingInvite();
      selectOrgForUser(user.id, orgId);
      queryClient.invalidateQueries({ queryKey: ["myOrg"] });
      queryClient.invalidateQueries({ queryKey: ["myPendingInvites"] });
      track("org_invite_accepted", { orgId });
      router.replace(
        user.onboardingStep !== "complete" ? "/onboarding?next=%2Forg" : "/org"
      );
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Couldn't accept the invite.");
      setAccepting(false);
    }
  }

  // Signed in + the invited email is this account (or already a member) →
  // no question to ask, just join.
  useEffect(() => {
    if (!user || !invite || autoAccepted.current) return;
    // Already a member (e.g. the admin opening a link they copied): never
    // touch the invite — it belongs to someone else. Just go to the theatre.
    if (invite.viewerIsMember) {
      autoAccepted.current = true;
      selectOrgForUser(user.id, invite.orgId);
      router.replace("/org");
      return;
    }
    if (invite.status === "pending" && invite.viewerMatches) {
      autoAccepted.current = true;
      void accept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, invite]);

  const returnHere = encodeURIComponent(`/join/${inviteId}`);

  // ── Loading ──
  if (authLoading || inviteQuery.isLoading) {
    return (
      <div className="max-w-md mx-auto px-6 py-24 flex flex-col items-center gap-3">
        <CircleNotch className="w-7 h-7 text-stage-500 animate-spin" weight="bold" />
        <p className="text-sm text-clay-500">Looking up your invitation…</p>
      </div>
    );
  }

  // ── Transport failure ──
  if (inviteQuery.isError) {
    return (
      <Shell icon="warn" title="Couldn't load this invitation">
        <p className="text-sm text-clay-500 mb-6">
          Something went wrong on our side. Please try the link again in a moment.
        </p>
        <Button onClick={() => inviteQuery.refetch()}>Try again</Button>
      </Shell>
    );
  }

  // ── Unknown link ──
  if (!invite) {
    return (
      <Shell icon="warn" title="This invite link isn't valid">
        <p className="text-sm text-clay-500 mb-6">
          It may have been copied incompletely. Ask the theatre to send it again, or
          to copy the link from their Theatre Members list.
        </p>
        <Link href="/" className="text-sm font-medium text-stage-600 hover:text-stage-700">
          Back to Overture
        </Link>
      </Shell>
    );
  }

  const roleText = ROLE_LABEL[invite.role] ?? "a member";
  const inviter = invite.inviterName ?? "Someone";

  // ── Cancelled / used by someone else ──
  if (invite.status === "expired") {
    return (
      <Shell icon="warn" title="This invitation was cancelled">
        <p className="text-sm text-clay-500 mb-6">
          {invite.orgName} withdrew this invite. If that&apos;s a mistake, ask them to
          invite you again.
        </p>
        <Link href="/" className="text-sm font-medium text-stage-600 hover:text-stage-700">
          Back to Overture
        </Link>
      </Shell>
    );
  }
  if (invite.status === "accepted" && !invite.viewerIsMember) {
    return (
      <Shell icon="warn" title="This invite has already been used">
        <p className="text-sm text-clay-500 mb-6">
          Someone has already joined {invite.orgName} with this link.{" "}
          {user
            ? "If that was you under a different account, sign out and sign back in with it. Otherwise ask the theatre for a fresh invite."
            : "If that was you, sign in with that account. Otherwise ask the theatre for a fresh invite."}
        </p>
        {!user && (
          <Button onClick={() => router.push(`/login?next=${returnHere}`)}>Sign in</Button>
        )}
      </Shell>
    );
  }

  // ── Anonymous: create account or sign in, both return here ──
  if (!user) {
    return (
      <Shell icon="org" title={`You're invited to ${invite.orgName}`}>
        <p className="text-sm text-clay-500 mb-6">
          {inviter} invited you to join {invite.orgName} on Overture as {roleText}.
          Create a free account or sign in and you&apos;ll be added to the theatre.
          Any email address works.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={() => router.push(`/signup?next=${returnHere}`)}>
            Create an account
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push(`/login?next=${returnHere}`)}
          >
            I already have one
          </Button>
        </div>
      </Shell>
    );
  }

  // ── Signed in with a different email than invited: confirm ──
  const needsConfirm = !invite.viewerMatches && !invite.viewerIsMember;
  return (
    <Shell icon="org" title={`Join ${invite.orgName}`}>
      <p className="text-sm text-clay-500 mb-2">
        {inviter} invited you to join {invite.orgName} as {roleText}.
      </p>
      {needsConfirm && (
        <p className="text-xs text-clay-500 mb-6">
          This invite was sent to <span className="font-semibold">{invite.emailHint}</span>.
          You&apos;re signed in as <span className="font-semibold">{user.email}</span> —
          that&apos;s fine, the theatre will see this account.
        </p>
      )}
      {acceptError && (
        <p className="text-sm text-ruby-600 mb-4" role="alert">
          {acceptError}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button size="lg" onClick={accept} loading={accepting}>
          Join {invite.orgName}
        </Button>
        {needsConfirm && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push(`/login?next=${returnHere}`)}
          >
            Use a different account
          </Button>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  icon,
  title,
  children,
}: {
  icon: "org" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <Card variant="elevated" padding="spacious" className="text-center animate-fade-up">
        <div className="w-14 h-14 rounded-2xl bg-stage-100 flex items-center justify-center mx-auto mb-4">
          {icon === "org" ? (
            <Buildings className="w-7 h-7 text-stage-600" weight="duotone" />
          ) : (
            <Warning className="w-7 h-7 text-stage-600" weight="duotone" />
          )}
        </div>
        <h1 className="text-3xl font-display text-curtain-900 mb-3">{title}</h1>
        {children}
      </Card>
    </div>
  );
}
