import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";
import {
  IdentificationCard,
  MapPin,
  ListChecks,
  Kanban,
  MegaphoneSimple,
  HandHeart,
} from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: {
    absolute: "Overture — Casting & Production for Community Theatre",
  },
  description:
    "Post auditions, find your next role, and run the whole production in one place. Free during beta for community theatres; free forever for actors.",
  // No openGraph override here — og:title/description resolve from the
  // fields above, and og:image / site_name / type inherit from the root layout.
};

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Post your show",
    body: "Set up your production in minutes — roles, audition days, and time slots, all in one place.",
  },
  {
    step: "2",
    title: "Actors sign up",
    body: "One profile follows them to every audition. Slots, role interests, and schedule conflicts are collected up front.",
  },
  {
    step: "3",
    title: "Run auditions & callbacks",
    body: "Check people in, take team notes, build callback lists, and work the casting board together.",
  },
  {
    step: "4",
    title: "Cast it — then run the show",
    body: "Publish the cast list, then manage rehearsals, announcements, and volunteers through the Show Hub.",
  },
];

const FOR_ACTORS = [
  {
    icon: IdentificationCard,
    title: "One profile, every audition",
    body: "Build your theatre resume once — headshot, credits, vocal range, conflicts. It follows you to every audition, so you never fill out another paper form.",
  },
  {
    icon: MapPin,
    title: "Discover shows near you",
    body: "Browse open auditions from theatres in your area, filter by show type, and sign up for a real time slot in a couple of taps.",
  },
  {
    icon: ListChecks,
    title: "Signup to cast list, one place",
    body: "Track your auditions, accept callbacks, respond to cast offers, and see where you stand — no more waiting by the lobby callboard.",
  },
];

const FOR_THEATRES = [
  {
    icon: Kanban,
    title: "Casting board + Conflict Calendar",
    body: "Work callbacks and casting with your whole team, and see everyone's rehearsal conflicts on the Conflict Calendar before you cast — not after.",
  },
  {
    icon: MegaphoneSimple,
    title: "The Show Hub for the whole run",
    body: "After casting, the Show Hub carries the production: rehearsal schedules, announcements with read receipts, absence reporting, and files — one link for the whole company.",
  },
  {
    icon: HandHeart,
    title: "Volunteers, without the spreadsheet",
    body: "Post what you need — ushers, concessions, set build — and share one public signup link. Anyone can claim a shift, no account required.",
  },
];

const BETA_INCLUDES = [
  "Unlimited shows & auditions",
  "Casting board & callbacks",
  "Conflict Calendar",
  "Show Hub for the whole run",
  "Volunteer signups",
  "Public theatre page",
];

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
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 md:pt-24 md:pb-28 text-center">
        <h1 className="text-4xl md:text-6xl font-display text-white mb-6 leading-tight">
          Every great show starts
          <br />
          <span className="text-stage-400">with the right people.</span>
        </h1>
        <p className="text-lg text-curtain-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Overture is where community theatres post auditions, actors find
          their next role, and whole productions run in one place — from
          signup sheet to closing night.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link href="/signup?path=actor" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              I&apos;m an actor
            </Button>
          </Link>
          <Link href="/signup?path=maker" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              I run a theatre
            </Button>
          </Link>
        </div>
        <Link
          href="/browse"
          className="inline-block mt-6 text-sm font-semibold text-curtain-300 hover:text-white underline underline-offset-4 decoration-curtain-600 hover:decoration-stage-400 transition"
        >
          Or browse open auditions first
        </Link>
      </section>

      {/* How it works */}
      <section className="bg-cream-50 text-curtain-900 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-display text-curtain-900 text-center mb-3">
            How it works
          </h2>
          <p className="text-clay-500 text-center max-w-xl mx-auto mb-12">
            One thread from &ldquo;we picked the show&rdquo; to &ldquo;places,
            everyone&rdquo; — for the theatre and every actor in the building.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step}>
                <div className="w-12 h-12 rounded-xl bg-stage-100 flex items-center justify-center mb-4">
                  <span className="text-xl font-display text-stage-700">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-lg font-display text-curtain-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-clay-500 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For actors */}
      <section className="bg-white text-curtain-900 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold text-stage-600 tracking-wide uppercase text-center mb-2">
            For actors
          </p>
          <h2 className="text-3xl font-display text-curtain-900 text-center mb-12">
            Your next role is out there
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {FOR_ACTORS.map((item) => (
              <div key={item.title} className="text-center md:text-left">
                <div className="w-12 h-12 rounded-xl bg-stage-100 flex items-center justify-center mx-auto md:mx-0 mb-4">
                  <item.icon className="w-6 h-6 text-stage-500" weight="duotone" />
                </div>
                <h3 className="text-lg font-display text-curtain-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-clay-500 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/signup?path=actor">
              <Button size="md">Create your free profile</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* For theatres */}
      <section className="bg-curtain-900 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold text-stage-400 tracking-wide uppercase text-center mb-2">
            For theatres
          </p>
          <h2 className="text-3xl font-display text-white text-center mb-12">
            Run the whole production, not just the paperwork
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {FOR_THEATRES.map((item) => (
              <div key={item.title} className="text-center md:text-left">
                <div className="w-12 h-12 rounded-xl bg-stage-500/10 flex items-center justify-center mx-auto md:mx-0 mb-4">
                  <item.icon className="w-6 h-6 text-stage-400" weight="duotone" />
                </div>
                <h3 className="text-lg font-display text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-curtain-300 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/signup?path=maker">
              <Button size="md">Set up your theatre</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Free during beta band */}
      <section className="bg-stage-500 text-curtain-900 py-12 md:py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-display mb-2">
            Free during beta — the whole thing
          </h2>
          <p className="text-sm md:text-base text-curtain-800 max-w-2xl mx-auto mb-8">
            We&apos;re building Overture in the open with early theatres. While
            we&apos;re in beta, every feature is free — no card, no catch.
          </p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3 max-w-3xl mx-auto">
            {BETA_INCLUDES.map((item) => (
              <li
                key={item}
                className="text-sm font-semibold bg-curtain-900/10 rounded-full px-4 py-1.5"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Built with community theatre people */}
      <section className="bg-cream-50 text-curtain-900 py-14 md:py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-2xl md:text-3xl font-display text-curtain-900 leading-snug mb-3">
            Built with community theatre people,
            <br className="hidden sm:block" /> for community theatre people.
          </p>
          <p className="text-clay-500 leading-relaxed">
            Overture comes from the boards and the board meetings — the folding
            tables at auditions, the binders, the group texts. We&apos;re
            replacing the chaos, not the community.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white text-curtain-900 py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-display text-curtain-900 text-center mb-3">
            Simple pricing
          </h2>
          <p className="text-clay-500 text-center max-w-xl mx-auto mb-12">
            Actors never pay. Theatres get everything free while we&apos;re in
            beta.
          </p>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-cream-300 bg-cream-50 p-8 text-center">
              <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                For actors
              </p>
              <p className="text-4xl font-display text-curtain-900 mb-1">Free</p>
              <p className="text-sm text-clay-500 mb-6">forever</p>
              <p className="text-sm text-clay-500 leading-relaxed mb-8">
                Your profile, auditions, callbacks, offers, and show hubs —
                actors never pay to be part of theatre.
              </p>
              <Link href="/signup?path=actor" className="block">
                <Button variant="outline" className="w-full">
                  Create your profile
                </Button>
              </Link>
            </div>
            <div className="rounded-2xl border-2 border-stage-400 bg-white p-8 text-center relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stage-500 text-curtain-900 text-[11px] font-semibold uppercase tracking-wide rounded-full px-3 py-1">
                Beta
              </span>
              <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
                For theatres
              </p>
              <p className="text-4xl font-display text-curtain-900 mb-1">
                Free during beta
              </p>
              <p className="text-sm text-clay-500 mb-6">$29/mo planned after</p>
              <p className="text-sm text-clay-500 leading-relaxed mb-8">
                Every feature, unlimited shows, your whole team. Theatres that
                join during beta will get founding-member consideration when
                pricing arrives.
              </p>
              <Link href="/signup?path=maker" className="block">
                <Button className="w-full">Start free</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-curtain-900 py-20 md:py-24 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-display text-white mb-4 leading-tight">
            Ready for your <span className="text-stage-400">standing ovation?</span>
          </h2>
          <p className="text-curtain-300 mb-8 max-w-xl mx-auto">
            Whether you&apos;re stepping into the audition room or running it,
            it starts here.
          </p>
          <Link href="/signup">
            <Button size="lg">Start free</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-curtain-900 border-t border-curtain-800 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-stage-500 flex items-center justify-center">
                  <span className="text-curtain-900 font-display text-base font-bold">
                    O
                  </span>
                </div>
                <span className="text-base font-display text-white">Overture</span>
              </div>
              <p className="text-xs text-curtain-500 leading-relaxed">
                Casting &amp; production for community theatre.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-curtain-400 tracking-wide uppercase mb-3">
                For actors
              </p>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link
                    href="/browse"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    Browse auditions
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup?path=actor"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    Create your profile
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-curtain-400 tracking-wide uppercase mb-3">
                For theatres
              </p>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link
                    href="/signup?path=maker"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    Set up your theatre
                  </Link>
                </li>
                <li>
                  <Link
                    href="/resources"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    Free templates &amp; resources
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-curtain-400 tracking-wide uppercase mb-3">
                Company
              </p>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link
                    href="/terms"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:hello@overturestage.com"
                    className="text-sm text-curtain-300 hover:text-white transition"
                  >
                    hello@overturestage.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-curtain-500 text-center">
            &copy; 2026 Overture. Built for community theatre.
          </p>
        </div>
      </footer>
    </div>
  );
}
