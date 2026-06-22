"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { useOrg } from "@/features/auth/useOrg";
import { getShows } from "@/lib/api/client";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import {
  CaretDown,
  SignOut,
  UserCircle,
  Plus,
  Check,
  List as ListIcon,
  Buildings,
} from "@phosphor-icons/react";

/* ============================================================
   ProductionTopNav — Tier 1 navigation for production teams

   Logo · Show Switcher (center) · Avatar Dropdown (right)
   ============================================================ */

type Props = {
  currentShowId?: string;
  currentShowTitle?: string;
};

export function ProductionTopNav({ currentShowId, currentShowTitle }: Props) {
  const { user, logout, switchRole } = useAuth();
  const { org } = useOrg();
  const pathname = usePathname();
  const router = useRouter();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Get org shows for the switcher
  const orgId = org?.id;
  const { data: orgShows } = useQuery({
    queryKey: ["shows", orgId],
    queryFn: () => getShows({ orgId: orgId! }),
    enabled: !!orgId,
  });

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    if (switcherOpen || avatarOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [switcherOpen, avatarOpen]);

  // Close on route change
  useEffect(() => {
    setSwitcherOpen(false);
    setAvatarOpen(false);
  }, [pathname]);

  const isOnShowsList = pathname === "/shows";

  return (
    <nav className="bg-curtain-900 text-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo */}
          <Link href="/shows" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-stage-500 flex items-center justify-center">
              <span className="text-curtain-900 font-display text-base font-bold">
                O
              </span>
            </div>
            <span className="text-base font-display text-white">
              Overture
            </span>
          </Link>

          {/* Center: Show Switcher or "My Shows" label */}
          <div className="flex-1 flex justify-center">
            {isOnShowsList ? (
              <span className="text-sm font-semibold text-curtain-300">
                My Shows
              </span>
            ) : currentShowTitle ? (
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() => setSwitcherOpen(!switcherOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white hover:bg-curtain-800 transition"
                >
                  {currentShowTitle}
                  <CaretDown className="w-3 h-3" weight="bold" />
                </button>

                {switcherOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-cream-200 py-1 z-50">
                    {/* Show list */}
                    {orgShows?.map((show) => (
                      <Link
                        key={show.id}
                        href={`/shows/${show.id}/setup`}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm transition",
                          show.id === currentShowId
                            ? "text-curtain-900 bg-cream-50 font-semibold"
                            : "text-curtain-700 hover:bg-cream-50"
                        )}
                      >
                        <span className="flex-1 truncate">{show.title}</span>
                        {show.id === currentShowId && (
                          <Check className="w-4 h-4 text-stage-500" weight="bold" />
                        )}
                      </Link>
                    ))}
                    <hr className="border-cream-100 my-1" />
                    <Link
                      href="/shows"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-700 hover:bg-cream-50 transition"
                    >
                      <ListIcon className="w-4 h-4 text-stage-500" weight="duotone" />
                      View All Shows
                    </Link>
                    <Link
                      href="/shows/new"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-700 hover:bg-cream-50 transition"
                    >
                      <Plus className="w-4 h-4 text-stage-500" weight="bold" />
                      New Show
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Right: Avatar dropdown */}
          {user && (
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarOpen(!avatarOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-curtain-300 hover:text-white hover:bg-curtain-800 transition"
              >
                <Avatar
                  name={user.displayName}
                  imageUrl={user.avatarUrl}
                  size="xs"
                  className="bg-curtain-700 text-white"
                />
                <span className="text-sm font-medium hidden lg:inline">
                  {user.displayName}
                </span>
                <CaretDown className="w-3 h-3" weight="bold" />
              </button>

              {avatarOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-cream-200 py-1 z-50">
                  <Link
                    href="/org"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition"
                  >
                    <Buildings className="w-4 h-4 text-stage-500" weight="duotone" />
                    My Theatre
                  </Link>
                  <button
                    onClick={() => {
                      setAvatarOpen(false);
                      switchRole({ type: "actor" });
                      router.push("/discover");
                    }}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition w-full text-left"
                  >
                    <UserCircle className="w-4 h-4 text-stage-500" weight="duotone" />
                    Switch to Actor
                  </button>
                  <hr className="border-cream-100 my-1" />
                  <button
                    onClick={() => {
                      setAvatarOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition w-full text-left"
                  >
                    <SignOut className="w-4 h-4 text-clay-400" weight="bold" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
