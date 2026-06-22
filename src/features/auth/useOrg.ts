"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { getMyOrgMembership } from "@/lib/api/client";
import type { Org, OrgRole } from "@/types";

/**
 * The signed-in user's theatre — their first active org membership joined to
 * the orgs row. This is the single source of truth for "which org am I
 * producing for?" on the production side (replaces the old hardcoded org-1).
 *
 * Cloud mode: queries org_members for the current user.
 * Mock mode: resolves to org-1 so the demo personas keep working.
 */
export function useOrg(): {
  org: Org | null;
  role: OrgRole | null;
  isLoading: boolean;
} {
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["myOrg", user?.id],
    queryFn: () => getMyOrgMembership(user!.id),
    enabled: !!user,
  });

  return {
    org: data?.org ?? null,
    role: data?.role ?? null,
    isLoading: authLoading || (!!user && isLoading),
  };
}
