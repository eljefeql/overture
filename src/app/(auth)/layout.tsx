export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-curtain-900 px-6 py-12">
      {children}
    </main>
  );
}
