"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  deleteMyAccount,
} from "@/lib/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Modal,
  PageSkeleton,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  EnvelopeSimple,
  LockKey,
  BellRinging,
  SignOut,
  Warning,
  Trash,
} from "@phosphor-icons/react";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/types";

/* ============================================================
   Account Settings — email, password, notification prefs,
   sign out everywhere, delete account.

   Dual-mode: cloud actions hit Supabase auth / profiles;
   mock mode keeps everything visible but cloud-only actions
   toast "available with a cloud account".
   ============================================================ */

const CLOUD_ONLY_MSG = "This is available with a cloud account — the demo runs on sample data.";

type PrefRow = {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
};

const PREF_ROWS: PrefRow[] = [
  {
    key: "reminders",
    label: "Reminders",
    description: "Audition, rehearsal, and volunteer-shift reminders.",
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "Show announcements from your production teams.",
  },
  {
    key: "offers",
    label: "Offers & callbacks",
    description: "Cast offers, callback invitations, and responses.",
  },
];

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-curtain-300 ${
        checked ? "bg-forest-500" : "bg-cream-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  // ── Email ──
  const [newEmail, setNewEmail] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);

  // ── Password ──
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);

  // ── Delete account ──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePending, setDeletePending] = useState(false);

  // ── Sign out everywhere ──
  const [globalSignOutPending, setGlobalSignOutPending] = useState(false);

  // ── Notification prefs ──
  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ["notificationPrefs", user?.id],
    queryFn: () => getNotificationPrefs(user!.id),
    enabled: !!user,
  });

  const prefsMutation = useMutation({
    mutationFn: (next: NotificationPrefs) => updateNotificationPrefs(user!.id, next),
    onMutate: async (next) => {
      // Optimistic — the switch flips immediately.
      await queryClient.cancelQueries({ queryKey: ["notificationPrefs", user?.id] });
      const previous = queryClient.getQueryData(["notificationPrefs", user?.id]);
      queryClient.setQueryData(["notificationPrefs", user?.id], next);
      return { previous };
    },
    onSuccess: () => toast("success", "Notification preferences saved."),
    onError: (err: Error, _next, context) => {
      queryClient.setQueryData(["notificationPrefs", user?.id], context?.previous);
      toast("error", err.message);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["notificationPrefs", user?.id] }),
  });

  if (!user) return <PageSkeleton />;

  const currentPrefs = prefs ?? DEFAULT_NOTIFICATION_PREFS;

  const togglePref = (key: keyof NotificationPrefs, value: boolean) => {
    prefsMutation.mutate({ ...currentPrefs, [key]: value });
  };

  // ── Handlers ──
  const handleEmailChange = async () => {
    if (!isSupabaseConfigured) {
      toast("info", CLOUD_ONLY_MSG);
      return;
    }
    const email = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast("error", "That doesn't look like an email address.");
      return;
    }
    setEmailPending(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ email });
      if (error) throw new Error(error.message);
      setEmailSentTo(email);
      setNewEmail("");
      toast("success", `Confirmation sent to ${email}.`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Couldn't update your email.");
    } finally {
      setEmailPending(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Passwords need at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Those passwords don't match.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast("info", CLOUD_ONLY_MSG);
      return;
    }
    setPasswordPending(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setNewPassword("");
      setConfirmPassword("");
      toast("success", "Password updated.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Couldn't update your password.");
    } finally {
      setPasswordPending(false);
    }
  };

  const handleGlobalSignOut = async () => {
    if (!isSupabaseConfigured) {
      toast("info", CLOUD_ONLY_MSG);
      return;
    }
    setGlobalSignOutPending(true);
    try {
      const { error } = await getSupabase().auth.signOut({ scope: "global" });
      if (error) throw new Error(error.message);
      toast("success", "Signed out on every device.");
      router.push("/");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Couldn't sign out everywhere.");
      setGlobalSignOutPending(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isSupabaseConfigured) {
      toast("info", CLOUD_ONLY_MSG);
      setDeleteOpen(false);
      setDeleteConfirmText("");
      return;
    }
    setDeletePending(true);
    try {
      await deleteMyAccount();
      // Best-effort sign-out; the auth user is already gone.
      await getSupabase().auth.signOut().catch(() => {});
      logout();
      toast("info", "Your account has been deleted. Thanks for being part of it.");
      router.push("/");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Couldn't delete your account.");
      setDeletePending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-3xl font-display text-curtain-900">Account Settings</h1>
        <p className="text-sm text-clay-500 mt-1">
          Your email, password, and how Overture reaches you.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Email ── */}
        <Card variant="elevated" className="animate-fade-up">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <EnvelopeSimple className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Email Address</CardTitle>
            </div>
          </CardHeader>
          <p className="text-sm text-curtain-800 mb-4">
            You&apos;re signed in as <strong>{user.email}</strong>.
          </p>
          <div className="flex flex-col gap-3">
            <Input
              label="New email address"
              type="email"
              placeholder="you@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
            />
            <p className="text-xs text-clay-500">
              We&apos;ll send a confirmation link to the new address — your email
              only changes after you click it, so a typo can&apos;t lock you out.
            </p>
            {emailSentTo && (
              <p className="text-xs text-forest-600">
                Confirmation sent to <strong>{emailSentTo}</strong>. Check that inbox to
                finish the change.
              </p>
            )}
            <div>
              <Button
                onClick={handleEmailChange}
                loading={emailPending}
                disabled={!newEmail.trim()}
              >
                Update Email
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Password ── */}
        <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "50ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <LockKey className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Password</CardTitle>
            </div>
          </CardHeader>
          <div className="flex flex-col gap-3">
            <Input
              label="New password"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Confirm new password"
              type="password"
              placeholder="Type it again"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              error={passwordError ?? undefined}
            />
            <div>
              <Button
                onClick={handlePasswordChange}
                loading={passwordPending}
                disabled={!newPassword || !confirmPassword}
              >
                Update Password
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Notification preferences ── */}
        <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <BellRinging className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Email Notifications</CardTitle>
            </div>
          </CardHeader>
          <p className="text-xs text-clay-500 mb-4">
            These control <strong>email only</strong> — everything still shows up in
            your in-app notifications. Digest options (a daily roundup instead of
            instant emails) are coming later.
          </p>
          <div className="flex flex-col gap-3">
            {PREF_ROWS.map((row) => (
              <Card key={row.key} variant="flat" padding="compact">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-curtain-900">{row.label}</p>
                    <p className="text-xs text-clay-500">{row.description}</p>
                  </div>
                  <Switch
                    checked={currentPrefs[row.key]}
                    onChange={(next) => togglePref(row.key, next)}
                    label={`${row.label} emails`}
                  />
                </div>
              </Card>
            ))}
            {prefsLoading && (
              <p className="text-xs text-clay-400">Loading your preferences…</p>
            )}
          </div>
        </Card>

        {/* ── Sessions ── */}
        <Card variant="elevated" className="animate-fade-up" style={{ animationDelay: "150ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <SignOut className="w-5 h-5 text-stage-500" weight="duotone" />
              <CardTitle>Sessions</CardTitle>
            </div>
          </CardHeader>
          <p className="text-sm text-curtain-800 mb-4">
            Left yourself signed in on the theatre&apos;s lobby computer? This signs
            you out everywhere, including this device.
          </p>
          <Button variant="outline" onClick={handleGlobalSignOut} loading={globalSignOutPending}>
            Sign Out Everywhere
          </Button>
        </Card>

        {/* ── Danger zone ── */}
        <Card
          variant="elevated"
          className="animate-fade-up border border-ruby-200"
          style={{ animationDelay: "200ms" }}
        >
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Warning className="w-5 h-5 text-ruby-500" weight="duotone" />
              <CardTitle>Danger Zone</CardTitle>
            </div>
          </CardHeader>
          <p className="text-sm text-curtain-800 mb-4">
            Deleting your account permanently removes your profile, credits, photos,
            audition history, and any casting records tied to you. There&apos;s no
            undo, and we can&apos;t restore it later.
          </p>
          <Button
            variant="danger"
            onClick={() => setDeleteOpen(true)}
            icon={<Trash className="w-4 h-4" weight="bold" />}
          >
            Delete My Account
          </Button>
        </Card>
      </div>

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteConfirmText("");
        }}
        title="Delete Account"
      >
        <div className="py-4">
          <div className="flex flex-col items-center text-center mb-5">
            <Warning className="w-12 h-12 text-ruby-400 mb-3" weight="duotone" />
            <p className="text-sm text-curtain-800">
              This permanently deletes your account and everything on it:
            </p>
          </div>
          <ul className="text-sm text-curtain-800 flex flex-col gap-1.5 mb-5 list-disc pl-6">
            <li>Your profile, photos, and resume</li>
            <li>Your acting and crew credits (including verified ones)</li>
            <li>Your audition signups, callbacks, and cast offers</li>
            <li>Your notifications and show hub access</li>
          </ul>
          <p className="text-xs text-clay-500 mb-4">
            If you run a theatre, shows and members stay with the theatre — but
            you&apos;ll lose your access to them.
          </p>
          <Input
            label={`Type DELETE to confirm`}
            placeholder="DELETE"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            autoComplete="off"
          />
          <div className="flex justify-end gap-3 mt-5">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirmText("");
              }}
            >
              Never Mind
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={deletePending}
              disabled={deleteConfirmText !== "DELETE"}
            >
              Delete Forever
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
