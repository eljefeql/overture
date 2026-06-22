import Link from "next/link";
import { Button } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-curtain-900 text-white">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-stage-500 flex items-center justify-center">
            <span className="text-curtain-900 font-display text-lg font-bold">O</span>
          </div>
          <span className="text-lg font-display text-white">Overture</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-curtain-300 hover:text-white transition"
          >
            Sign In
          </Link>
          <Link href="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-32 text-center">
        <h1 className="text-5xl md:text-6xl font-display text-white mb-6 leading-tight">
          The stage is set.
          <br />
          <span className="text-stage-400">Find your cast.</span>
        </h1>
        <p className="text-lg text-curtain-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Overture is the casting and talent platform for community theatre.
          Actors find auditions. Directors find talent. Everyone finds their place.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg">Start Free</Button>
          </Link>
          <Link
            href="/browse"
            className="px-6 py-3 text-base font-semibold text-curtain-300 hover:text-white border border-curtain-700 hover:border-curtain-500 rounded-xl transition"
          >
            Browse Auditions
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="bg-curtain-800 py-20">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-stage-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-stage-400 text-2xl font-display">1</span>
            </div>
            <h3 className="text-lg font-display text-white mb-2">
              One Profile, Every Audition
            </h3>
            <p className="text-sm text-curtain-400 leading-relaxed">
              Build your theatre resume once. Audition everywhere. Your profile
              follows you from show to show.
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-stage-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-stage-400 text-2xl font-display">2</span>
            </div>
            <h3 className="text-lg font-display text-white mb-2">
              Cast Collaboratively
            </h3>
            <p className="text-sm text-curtain-400 leading-relaxed">
              Real-time notes, callback management, and casting boards.
              Your whole production team on the same page.
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-stage-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-stage-400 text-2xl font-display">3</span>
            </div>
            <h3 className="text-lg font-display text-white mb-2">
              Build Your Talent Network
            </h3>
            <p className="text-sm text-curtain-400 leading-relaxed">
              Every audition grows your community. Know who's out there.
              Find the right people for every show.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-curtain-900 border-t border-curtain-800 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm text-curtain-500">
            &copy; 2026 Overture. Built for community theatre.
          </p>
        </div>
      </footer>
    </div>
  );
}
