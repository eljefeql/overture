import { Nav } from "@/components/ui";
import { AuthGuard } from "@/features/auth/AuthGuard";

export default function ActorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <Nav />
      <main className="flex-1">{children}</main>
    </AuthGuard>
  );
}
