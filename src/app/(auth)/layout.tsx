import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-curtain-900 px-6 py-12">
      <div className="flex-1 flex items-center justify-center w-full">
        {children}
      </div>
      <footer className="mt-8 flex items-center gap-4 text-xs">
        <Link href="/terms" className="text-curtain-500 hover:text-curtain-300 transition">
          Terms
        </Link>
        <Link href="/privacy" className="text-curtain-500 hover:text-curtain-300 transition">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
