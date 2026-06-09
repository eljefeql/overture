"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, TeamRole, OrgRole } from "@/types";

type AuthRole =
  | { type: "actor" }
  | { type: "team"; showId: string; teamRole: TeamRole }
  | { type: "org"; orgId: string; orgRole: OrgRole };

type AuthState = {
  user: User | null;
  activeRole: AuthRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: AuthRole) => void;
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
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Default to actor for development (primary user persona)
  const [user, setUser] = useState<User | null>(MOCK_USERS.actor);
  const [activeRole, setActiveRole] = useState<AuthRole>({
    type: "actor",
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 500));

    const mockUser = Object.values(MOCK_USERS).find((u) => u.email === email);
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
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setActiveRole({ type: "actor" });
  }, []);

  const switchRole = useCallback((role: AuthRole) => {
    setActiveRole(role);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchRole,
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
