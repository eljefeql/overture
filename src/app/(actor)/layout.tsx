import { Nav } from "@/components/ui";

export default function ActorLayout({
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
