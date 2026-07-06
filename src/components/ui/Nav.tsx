"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { useOrg } from "@/features/auth/useOrg";
import { getNotifications } from "@/lib/api/client";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import {
  Bell,
  GearSix,
  SignOut,
  List,
  X,
  MagnifyingGlass,
  MaskHappy,
  UserCircle,
  CaretDown,
  Buildings,
} from "@phosphor-icons/react";

/* ============================================================
   Nav — responsive top nav for a mobile-friendly website

   Desktop: logo · centered links · bell · avatar dropdown
   Mobile:  logo · bell · hamburger → slide-out menu
   ============================================================ */

export function Nav() {
  const { user, logout } = useAuth();
  const { org, isLoading: orgLoading } = useOrg();
  // Org members get a "My Theatre" entry; confirmed org-less users get a
  // subtle "Start a theatre" path instead (never while still loading — no
  // flash of the wrong entry).
  const showStartTheatre = !!user && !orgLoading && !org;
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  function handleSignOut() {
    setAvatarOpen(false);
    setMobileOpen(false);
    logout();
    router.push("/");
  }

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Notifications intentionally absent — the bell icon (with unread badge)
  // is the single entry point to /notifications.
  //
  // This nav ALWAYS renders actor links — it never reads activeRole.
  // Show-scoped menus live exclusively in ProductionTopNav/ProductionSubNav
  // inside the (production) group; theatre folks reach their theatre via
  // the "My Theatre" entry in the avatar dropdown / mobile menu below.
  // (Nav redesign, owner-authorized 2026-07-05 — killed the stale teamLinks leak.)
  const links = [
    { href: "/discover", label: "Discover", icon: MagnifyingGlass },
    { href: "/my-shows", label: "My Shows", icon: MaskHappy },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  const isActive = (href: string) => {
    if (href === "/discover") return pathname === "/discover" || pathname?.startsWith("/auditions/");
    return pathname?.startsWith(href);
  };

  // Unread notification badge — derived from real data
  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user,
  });
  const hasNotifications = notifications?.some((n) => !n.isRead) ?? false;

  return (
    <>
      <nav className="bg-curtain-900 text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-stage-500 flex items-center justify-center">
                <span className="text-curtain-900 font-display text-base font-bold">
                  O
                </span>
              </div>
              <span className="text-base font-display text-white">
                Overture
              </span>
            </Link>

            {/* Center: Desktop nav links — logged-in only */}
            {user && (
              <div className="hidden md:flex items-center gap-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition",
                      isActive(link.href)
                        ? "text-white bg-curtain-800"
                        : "text-curtain-300 hover:text-white hover:bg-curtain-800"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              {/* Logged-out: Sign in / Sign up */}
              {!user && (
                <>
                  <Link
                    href="/resources"
                    className="hidden sm:block px-3 py-1.5 text-sm font-medium rounded-lg text-curtain-300 hover:text-white hover:bg-curtain-800 transition"
                  >
                    Resources
                  </Link>
                  <Link
                    href="/login"
                    className="px-3 py-1.5 text-sm font-medium rounded-lg text-curtain-300 hover:text-white hover:bg-curtain-800 transition"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-stage-500 text-curtain-900 hover:bg-stage-400 transition"
                  >
                    Sign up
                  </Link>
                </>
              )}

              {/* Notification bell — logged-in only */}
              {user && (
                <Link
                  href="/notifications"
                  className={cn(
                    "p-2 rounded-lg transition relative",
                    isActive("/notifications")
                      ? "text-white bg-curtain-800"
                      : "text-curtain-300 hover:text-white hover:bg-curtain-800"
                  )}
                >
                  <Bell className="w-5 h-5" weight={isActive("/notifications") ? "fill" : "bold"} />
                  {hasNotifications && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-ruby-500 rounded-full" />
                  )}
                </Link>
              )}

              {/* Avatar dropdown — desktop */}
              {user && (
                <div className="relative hidden md:block" ref={avatarRef}>
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

                  {/* Dropdown */}
                  {avatarOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-cream-200 py-1 z-50">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition"
                        onClick={() => setAvatarOpen(false)}
                      >
                        <UserCircle className="w-4 h-4 text-stage-500" weight="duotone" />
                        My Profile
                      </Link>
                      {org && (
                        <Link
                          href="/org"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition"
                          onClick={() => setAvatarOpen(false)}
                        >
                          <Buildings className="w-4 h-4 text-stage-500" weight="duotone" />
                          {org.name}
                        </Link>
                      )}
                      {showStartTheatre && (
                        <Link
                          href="/onboarding?path=maker"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition"
                          onClick={() => setAvatarOpen(false)}
                        >
                          <Buildings className="w-4 h-4 text-stage-500" weight="duotone" />
                          Start a theatre
                        </Link>
                      )}
                      <Link
                        href="/settings"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition"
                        onClick={() => setAvatarOpen(false)}
                      >
                        <GearSix className="w-4 h-4 text-stage-500" weight="duotone" />
                        Settings
                      </Link>
                      <hr className="border-cream-100 my-1" />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-curtain-800 hover:bg-cream-50 transition w-full text-left"
                      >
                        <SignOut className="w-4 h-4 text-clay-400" weight="bold" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Hamburger — mobile, logged-in only (logged-out shows inline Sign in/up) */}
              {user && (
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="p-2 rounded-lg text-curtain-300 hover:text-white hover:bg-curtain-800 transition md:hidden"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                >
                  {mobileOpen ? (
                    <X className="w-5 h-5" weight="bold" />
                  ) : (
                    <List className="w-5 h-5" weight="bold" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setMobileOpen(false)}
          />

          {/* Menu panel */}
          <div className="fixed top-14 left-0 right-0 bg-curtain-900 z-25 md:hidden border-t border-curtain-800 animate-fade-up shadow-xl">
            <div className="px-4 py-3 flex flex-col gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition",
                      isActive(link.href)
                        ? "text-white bg-curtain-800"
                        : "text-curtain-300 hover:text-white hover:bg-curtain-800"
                    )}
                  >
                    <Icon
                      className="w-5 h-5"
                      weight={isActive(link.href) ? "fill" : "duotone"}
                    />
                    {link.label}
                    {link.href === "/notifications" && hasNotifications && (
                      <span className="w-2 h-2 bg-ruby-500 rounded-full ml-auto" />
                    )}
                  </Link>
                );
              })}

              {/* User section */}
              {user && (
                <>
                  <hr className="border-curtain-800 my-2" />
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Avatar
                      name={user.displayName}
                      imageUrl={user.avatarUrl}
                      size="sm"
                      className="bg-curtain-700 text-white"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-curtain-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  {org && (
                    <Link
                      href="/org"
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-curtain-300 hover:text-white hover:bg-curtain-800 transition"
                    >
                      <Buildings className="w-5 h-5" weight="duotone" />
                      {org.name}
                    </Link>
                  )}
                  {showStartTheatre && (
                    <Link
                      href="/onboarding?path=maker"
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-curtain-300 hover:text-white hover:bg-curtain-800 transition"
                    >
                      <Buildings className="w-5 h-5" weight="duotone" />
                      Start a theatre
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-curtain-300 hover:text-white hover:bg-curtain-800 transition"
                  >
                    <GearSix className="w-5 h-5" weight="duotone" />
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-curtain-400 hover:text-white hover:bg-curtain-800 transition"
                  >
                    <SignOut className="w-5 h-5" weight="bold" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
