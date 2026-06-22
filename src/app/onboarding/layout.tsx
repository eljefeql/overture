export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-cream-50">
      {/* Minimal wizard chrome — wordmark only, no app nav */}
      <header className="px-6 py-4 border-b border-cream-200 bg-white">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stage-500 flex items-center justify-center">
            <span className="text-curtain-900 font-display text-base font-bold">
              O
            </span>
          </div>
          <span className="text-base font-display text-curtain-900">
            Overture
          </span>
        </div>
      </header>
      {children}
    </main>
  );
}
