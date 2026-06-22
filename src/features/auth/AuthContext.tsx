"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { claimPendingInvites } from "@/lib/api/client";
import type { User, TeamRole, OrgRole, Pronouns } from "@/types";

type AuthRole =
  | { type: "actor" }
  | { type: "team"; showId: string; teamRole: TeamRole }
  | { type: "org"; orgId: string; orgRole: OrgRole };

export type SignUpResult = {
  user: User | null;
  /** True when Supabase email confirmation is on: account created, no session yet. */
  needsEmailConfirmation: boolean;
};

type AuthState = {
  user: User | null;
  activeRole: AuthRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  loginWithGoogle: () => Promise<User>;
  logout: () => void;
  switchRole: (role: AuthRole) => void;
  updateUser: (updates: Partial<User>) => void;
  beginOnboarding: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

// Mock users for development
const MOCK_USERS: Record<string, User> = {
  actor: {
    id: "actor-2",
    email: "maria.santos@email.com",
    displayName: "Maria Santos",
    avatarUrl: null,
    pronouns: "she/her",
    onboardingStep: "complete",
    createdAt: "2025-06-15T00:00:00Z",
  },
  director: {
    id: "user-team-1",
    email: "sarah.mitchell@email.com",
    displayName: "Sarah Mitchell",
    avatarUrl: null,
    pronouns: "she/her",
    onboardingStep: "complete",
    createdAt: "2024-01-15T00:00:00Z",
  },
  sm: {
    id: "user-team-2",
    email: "tom.briggs@email.com",
    displayName: "Tom Briggs",
    avatarUrl: null,
    pronouns: "he/him",
    onboardingStep: "complete",
    createdAt: "2024-06-01T00:00:00Z",
  },
  // A fresh account that hasn't been through onboarding — login routes them to /onboarding.
  newcomer: {
    id: "actor-new",
    email: "newcomer@email.com",
    displayName: "",
    avatarUrl: null,
    pronouns: null,
    onboardingStep: "role_select",
    createdAt: "2026-06-10T00:00:00Z",
  },
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function profileRowToUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name ?? "",
    avatarUrl: r.avatar_url,
    pronouns: (r.pronouns as Pronouns) ?? null,
    onboardingStep: r.onboarding_step ?? "role_select",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Fetch the profiles row for a signed-in Supabase user and map to our User shape. */
async function fetchProfileUser(userId: string): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? profileRowToUser(data) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Mock mode defaults to the actor persona; cloud mode starts signed out
  // and restores the session (isLoading stays true until restore finishes
  // so AuthGuard doesn't flash-redirect).
  const [user, setUser] = useState<User | null>(
    isSupabaseConfigured ? null : MOCK_USERS.actor
  );
  const [activeRole, setActiveRole] = useState<AuthRole>({
    type: "actor",
  });
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  // ── Cloud session restore + auth state subscription ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let cancelled = false;

    async function restore() {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;
        if (sessionUser && !cancelled) {
          const profile = await fetchProfileUser(sessionUser.id);
          if (!cancelled) setUser(profile);
          // Pick up any org invites sent to this email while signed out.
          claimPendingInvites();
        }
      } catch {
        // Profile fetch failed — treat as signed out rather than blocking the app.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    restore();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setActiveRole({ type: "actor" });
      } else if (event === "SIGNED_IN" && session?.user) {
        // Refresh the profile on sign-in from another tab / token refresh.
        fetchProfileUser(session.user.id)
          .then((profile) => setUser((prev) => profile ?? prev))
          .catch(() => {});
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured) {
      setIsLoading(true);
      try {
        const { data, error } = await getSupabase().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(error.message);
        const profile = data.user ? await fetchProfileUser(data.user.id) : null;
        // Accept any pending org invites for this email before pages query
        // org membership (best-effort; never blocks sign-in on failure).
        if (profile) await claimPendingInvites();
        setUser(profile);
        setActiveRole({ type: "actor" });
        return profile;
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 500));

    const mockUser = Object.values(MOCK_USERS).find((u) => u.email === email) ?? null;
    if (mockUser) {
      setUser(mockUser);
      // Auto-set role based on who logs in
      if (mockUser.id.startsWith("actor")) {
        setActiveRole({ type: "actor" });
      } else {
        setActiveRole({
          type: "team",
          showId: "show-1",
          teamRole: "director",
        });
      }
    }
    setIsLoading(false);
    return mockUser;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      if (isSupabaseConfigured) {
        setIsLoading(true);
        try {
          const { data, error } = await getSupabase().auth.signUp({
            email,
            password,
          });
          if (error) throw new Error(error.message);
          // Email confirmation ON → user created but no session yet.
          if (!data.session || !data.user) {
            return { user: null, needsEmailConfirmation: true };
          }
          // The handle_new_user trigger creates the profiles row; read it back.
          const profile = await fetchProfileUser(data.user.id);
          setUser(profile);
          setActiveRole({ type: "actor" });
          return { user: profile, needsEmailConfirmation: false };
        } finally {
          setIsLoading(false);
        }
      }

      // Mock fallback: behave like beginOnboarding with the email attached.
      await new Promise((r) => setTimeout(r, 400));
      const mockUser: User = {
        id: `actor-${Date.now()}`,
        email,
        displayName: "",
        avatarUrl: null,
        pronouns: null,
        onboardingStep: "role_select",
        createdAt: new Date().toISOString(),
      };
      setUser(mockUser);
      setActiveRole({ type: "actor" });
      return { user: mockUser, needsEmailConfirmation: false };
    },
    []
  );

  // Simulated Google OAuth — stands in for Supabase Auth until the Google
  // provider is configured. In cloud mode the pages show a "coming soon"
  // toast instead of calling this; the simulated flow remains for mock mode.
  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    const googleUser: User = {
      id: `actor-${Date.now()}`,
      email: "alex.rivera@gmail.com",
      displayName: "Alex Rivera",
      avatarUrl: null,
      pronouns: null,
      onboardingStep: "role_select",
      createdAt: new Date().toISOString(),
    };
    setUser(googleUser);
    setActiveRole({ type: "actor" });
    setIsLoading(false);
    return googleUser;
  }, []);

  const logout = useCallback(() => {
    if (isSupabaseConfigured) {
      getSupabase().auth.signOut().catch(() => {});
    }
    setUser(null);
    setActiveRole({ type: "actor" });
  }, []);

  const switchRole = useCallback((role: AuthRole) => {
    setActiveRole(role);
  }, []);

  const updateUser = useCallback(
    (updates: Partial<User>) => {
      setUser((prev) => (prev ? { ...prev, ...updates } : prev));
      if (isSupabaseConfigured && user) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const row: Record<string, any> = {};
        if (updates.displayName !== undefined) row.display_name = updates.displayName;
        if (updates.pronouns !== undefined) row.pronouns = updates.pronouns;
        if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl;
        if (updates.onboardingStep !== undefined) row.onboarding_step = updates.onboardingStep;
        if (Object.keys(row).length > 0) {
          getSupabase()
            .from("profiles")
            .update(row)
            .eq("id", user.id)
            .then(({ error }) => {
              if (error) console.error("Profile update failed:", error.message);
            });
        }
      }
    },
    [user]
  );

  const beginOnboarding = useCallback(() => {
    setUser({
      id: `actor-${Date.now()}`,
      email: "",
      displayName: "",
      avatarUrl: null,
      pronouns: null,
      onboardingStep: "role_select",
      createdAt: new Date().toISOString(),
    });
    setActiveRole({ type: "actor" });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        isAuthenticated: !!user,
        isLoading,
        login,
        signUp,
        loginWithGoogle,
        logout,
        switchRole,
        updateUser,
        beginOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
