"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { useAuth } from "./AuthContext";
import { getMyOrgMemberships } from "@/lib/api/client";
import type { OrgMembershipInfo } from "@/lib/api/client";
import type { Org, OrgRole } from "@/types";

/**
 * The signed-in user's theatre(s). Most people belong to one theatre, but
 * members of several (e.g. invited to a second company) pick which one
 * they're producing for — the theatre switcher in ProductionTopNav calls
 * `selectOrg`, and the choice persists per user in localStorage.
 *
 * `org`/`role` keep the original single-theatre shape, so every existing
 * consumer works unchanged: they're the SELECTED membership (stored id if
 * still valid, otherwise the first membership by joined_at).
 *
 * Cloud mode: queries org_members for the current user.
 * Mock mode: resolves to org-1 so the demo personas keep working.
 */

const STORAGE_PREFIX = "overture.selectedOrgId";
const storageKey = (userId: string) => `${STORAGE_PREFIX}.${userId}`;

// SSR-safe localStorage access — the hook renders during prerender too.
function readStoredOrgId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function writeStoredOrgId(userId: string, orgId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), orgId);
  } catch {
    // Storage unavailable (private mode etc.) — selection just won't persist.
  }
}

// Shared in-memory selection so every useOrg() consumer re-renders together
// the moment one of them switches theatres (localStorage alone can't do that).
type OrgSelectionState = {
  selectedByUser: Record<string, string>;
  select: (userId: string, orgId: string) => void;
};

const useOrgSelectionStore = create<OrgSelectionState>((set) => ({
  selectedByUser: {},
  select: (userId, orgId) =>
    set((s) => ({
      selectedByUser: { ...s.selectedByUser, [userId]: orgId },
    })),
}));

/**
 * Select a theatre from OUTSIDE the hook (e.g. onboarding just created a
 * second org and the new one should be active). Same effect as `selectOrg`
 * minus the query invalidation — callers handle their own refresh.
 */
export function selectOrgForUser(userId: string, orgId: string) {
  writeStoredOrgId(userId, orgId);
  useOrgSelectionStore.getState().select(userId, orgId);
}

export function useOrg(): {
  org: Org | null;
  role: OrgRole | null;
  memberships: OrgMembershipInfo[];
  selectOrg: (orgId: string) => void;
  isLoading: boolean;
} {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const selectedByUser = useOrgSelectionStore((s) => s.selectedByUser);
  const select = useOrgSelectionStore((s) => s.select);

  const { data, isLoading } = useQuery({
    queryKey: ["myOrg", user?.id],
    queryFn: () => getMyOrgMemberships(user!.id),
    enabled: !!user,
  });

  const memberships = useMemo(() => data ?? [], [data]);

  // Resolve the selection: in-memory choice → stored choice → first theatre.
  const requestedId = user
    ? (selectedByUser[user.id] ?? readStoredOrgId(user.id))
    : null;
  const selected =
    memberships.find((m) => m.org.id === requestedId) ?? memberships[0] ?? null;

  // If the stored id was missing or no longer among the memberships, persist
  // the resolved default so the selection is stable across reloads.
  useEffect(() => {
    if (user && selected && selected.org.id !== requestedId) {
      writeStoredOrgId(user.id, selected.org.id);
      select(user.id, selected.org.id);
    }
  }, [user, selected, requestedId, select]);

  const selectOrg = useCallback(
    (orgId: string) => {
      if (!user) return;
      writeStoredOrgId(user.id, orgId);
      select(user.id, orgId);
      // Org-scoped queries all key on orgId so they'd re-key anyway, but a
      // broad invalidation guarantees nothing stale survives the switch.
      queryClient.invalidateQueries();
    },
    [user, select, queryClient]
  );

  return {
    org: selected?.org ?? null,
    role: selected?.role ?? null,
    memberships,
    selectOrg,
    isLoading: authLoading || (!!user && isLoading),
  };
}
