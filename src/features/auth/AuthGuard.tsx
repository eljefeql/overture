"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Wraps gated route groups. Anonymous visitors are redirected to /login
 * with a `next` param so they return exactly where they were after auth
 * (the deep-link return required by the access-gating model).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/")}`);
    }
  }, [user, isLoading, pathname, router]);

  if (!user) return null;
  return <>{children}</>;
}
