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
  GearSix,
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
  const { org, memberships, selectOrg } = useOrg();
  const pathname = usePathname();
  const router = useRouter();

  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Get org shows for the switcher
  const orgId = org?.id;
  const { data: orgShows } = useQuery({
    queryKey: ["shows", orgId],
    queryFn: () => getShows({ orgId: orgId! }),
    enabled: !!orgId,
  });

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    if (avatarOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [avatarOpen]);

  // Close on route change
  useEffect(() => {
    setAvatarOpen(false);
  }, [pathname]);

  // Persistent links — rendered on EVERY production page (theatre hub, shows
  // list, /shows/new, inside a show), desktop AND mobile. "My Shows" highlights
  // at the list level; inside a show the show switcher carries the location.
  const isOnShowsList = pathname === "/shows" || pathname === "/shows/new";
  const isOnOrgHub = pathname?.startsWith("/org") ?? false;

  const persistentLinkClass = (active: boolean) =>
    cn(
      "px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition whitespace-nowrap",
      active
        ? "text-white bg-curtain-800"
        : "text-curtain-300 hover:text-white hover:bg-curtain-800"
    );

  // Switching theatres: persist the selection (useOrg invalidates all
  // queries) and land on the theatre hub so the change is unmistakable.
  function handleSelectOrg(orgId: string) {
    if (orgId !== org?.id) selectOrg(orgId);
    router.push("/org");
  }

  return (
    <nav className="bg-curtain-900 text-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-2">
          {/* Left: Logo */}
          <Link href="/shows" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-stage-500 flex items-center justify-center">
              <span className="text-curtain-900 font-display text-base font-bold">
                O
              </span>
            </div>
            <span className="text-base font-display text-white hidden sm:inline">
              Overture
            </span>
          </Link>

          {/* Center: persistent links + (desktop) show switcher when inside a show */}
          <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
            <Link href="/shows" className={persistentLinkClass(isOnShowsList)}>
              My Shows
            </Link>
            {memberships.length > 1 ? (
              <TheatreSwitcher
                memberships={memberships}
                selectedOrgId={org?.id}
                onSelect={handleSelectOrg}
                buttonClassName={cn(
                  persistentLinkClass(isOnOrgHub),
                  "flex items-center gap-1.5"
                )}
              />
            ) : (
              <Link href="/org" className={persistentLinkClass(isOnOrgHub)}>
                My Theatre
              </Link>
            )}
            {currentShowTitle && (
              <div className="hidden md:block min-w-0">
                <ShowSwitcher
                  currentShowId={currentShowId}
                  currentShowTitle={currentShowTitle}
                  orgShows={orgShows}
                  align="center"
                />
              </div>
            )}
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
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-cream-200 py-1 z-50">
                  {memberships.length > 1 ? (
                    memberships.map((m) => (
                      <button
                        key={m.org.id}
                        onClick={() => {
                          setAvatarOpen(false);
                          handleSelectOrg(m.org.id);
                        }}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition w-full text-left"
                      >
                        <Buildings
                          className="w-4 h-4 text-stage-500 flex-shrink-0"
                          weight="duotone"
                        />
                        <span className="flex-1 truncate">{m.org.name}</span>
                        {m.org.id === org?.id && (
                          <Check
                            className="w-4 h-4 text-stage-500 flex-shrink-0"
                            weight="bold"
                          />
                        )}
                      </button>
                    ))
                  ) : (
                    <Link
                      href="/org"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition"
                    >
                      <Buildings className="w-4 h-4 text-stage-500" weight="duotone" />
                      My Theatre
                    </Link>
                  )}
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
                  <Link
                    href="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition"
                  >
                    <GearSix className="w-4 h-4 text-stage-500" weight="duotone" />
                    Settings
                  </Link>
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

        {/* Mobile: show switcher gets its own slim row — the top bar can't fit
            links + a show title at phone widths, and the show name must stay
            visible and labeled (never a mystery menu). */}
        {currentShowTitle && (
          <div className="md:hidden pb-2">
            <ShowSwitcher
              currentShowId={currentShowId}
              currentShowTitle={currentShowTitle}
              orgShows={orgShows}
              align="left"
            />
          </div>
        )}
      </div>
    </nav>
  );
}

/* ============================================================
   ShowSwitcher — the labeled current-show dropdown

   Rendered inline (desktop) or on its own row (mobile). Always
   shows the current show's TITLE so it's never an unlabeled menu.
   ============================================================ */

function ShowSwitcher({
  currentShowId,
  currentShowTitle,
  orgShows,
  align,
}: {
  currentShowId?: string;
  currentShowTitle: string;
  orgShows?: { id: string; title: string }[];
  align: "center" | "left";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 max-w-full px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-curtain-800/60 hover:bg-curtain-800 transition"
      >
        <span className="truncate">{currentShowTitle}</span>
        <CaretDown className="w-3 h-3 flex-shrink-0" weight="bold" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-cream-200 py-1 z-50",
            align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
          )}
        >
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
  );
}

/* ============================================================
   TheatreSwitcher — "My Theatre" becomes a labeled dropdown
   when the user belongs to MORE THAN ONE theatre.

   Same interaction pattern as ShowSwitcher: caret button,
   outside-click + route-change close, check on the current
   selection. Each row: org avatar/initials · name · your role.
   ============================================================ */

const ORG_ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function TheatreSwitcher({
  memberships,
  selectedOrgId,
  onSelect,
  buttonClassName,
}: {
  memberships: { org: { id: string; name: string; logoUrl: string | null }; role: string }[];
  selectedOrgId?: string;
  onSelect: (orgId: string) => void;
  buttonClassName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={buttonClassName}
        aria-label="Switch theatre"
      >
        My Theatre
        <CaretDown className="w-3 h-3 flex-shrink-0" weight="bold" />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-cream-200 py-1 z-50">
          {memberships.map((m) => (
            <button
              key={m.org.id}
              onClick={() => {
                setOpen(false);
                onSelect(m.org.id);
              }}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 text-sm transition w-full text-left",
                m.org.id === selectedOrgId
                  ? "text-curtain-900 bg-cream-50 font-semibold"
                  : "text-curtain-700 hover:bg-cream-50"
              )}
            >
              <Avatar
                name={m.org.name}
                imageUrl={m.org.logoUrl}
                size="xs"
                className="flex-shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{m.org.name}</span>
                <span className="block text-xs font-normal text-clay-400">
                  {ORG_ROLE_LABEL[m.role] ?? m.role}
                </span>
              </span>
              {m.org.id === selectedOrgId && (
                <Check className="w-4 h-4 text-stage-500 flex-shrink-0" weight="bold" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
