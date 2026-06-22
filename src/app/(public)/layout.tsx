import { Nav } from "@/components/ui";

/**
 * Public layout — pages anyone can view without an account.
 * Uses the same auth-aware Nav (shows Sign in / Sign up when logged out).
 * NO auth guard here, unlike the (actor) group.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
    </>
  );
}
