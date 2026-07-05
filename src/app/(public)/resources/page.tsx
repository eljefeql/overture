"use client";

import { useState } from "react";
import Link from "next/link";
import { submitResourceLead } from "@/lib/api/client";
import { Card, CardTitle, Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  Megaphone,
  ListChecks,
  CalendarBlank,
  EnvelopeSimple,
  Printer,
  ArrowRight,
} from "@phosphor-icons/react";

/* ============================================================
   /resources — free printable templates for community theatre
   (Week 4 lead magnet). Public, anonymous-viewable. Light-mode
   cream/curtain like the rest of the app.
   ============================================================ */

const TEMPLATES = [
  {
    slug: "audition-notice",
    icon: Megaphone,
    title: "Audition Notice Template",
    blurb:
      "A fill-in-the-blank one-pager with everything actors actually need to show up prepared — dates, roles, what to bring, and the commitment picture up front.",
  },
  {
    slug: "casting-checklist",
    icon: ListChecks,
    title: "Casting Checklist",
    blurb:
      "The full timeline from “we picked the show” to “cast list is up” — week by week, so nothing falls through the cracks between auditions and offers.",
  },
  {
    slug: "rehearsal-schedule",
    icon: CalendarBlank,
    title: "Rehearsal Schedule Template",
    blurb:
      "A weekly schedule grid with who's-called columns and a conflicts row — the format stage managers reach for when the calendar starts filling up.",
  },
];

export default function ResourcesPage() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("error", "Tell us your name so we know who we're writing to.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast("error", "That doesn't look like an email address.");
      return;
    }
    setSubmitting(true);
    try {
      await submitResourceLead({ name: name.trim(), email: email.trim(), website });
      setSubscribed(true);
      setName("");
      setEmail("");
      toast("success", "You're on the list — thanks! New templates land in your inbox.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Something went wrong — try again?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl font-display text-curtain-900">Free Resources</h1>
        <p className="text-sm text-clay-500 mt-2 leading-relaxed">
          Printable templates we use ourselves — made for community theatre, free
          for everyone, no account needed. Open one, fill it in, and hit Print (or
          Save as PDF).
        </p>
      </div>

      {/* ── Templates ── */}
      <h3 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
        Templates
      </h3>
      <div className="flex flex-col gap-3 mb-10">
        {TEMPLATES.map((t, i) => {
          const Icon = t.icon;
          return (
            <Link key={t.slug} href={`/resources/${t.slug}`} className="block">
              <Card
                variant="elevated"
                interactive
                className="animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-stage-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-stage-600" weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle>{t.title}</CardTitle>
                    <p className="text-sm text-clay-500 mt-1 leading-relaxed">{t.blurb}</p>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-curtain-700 mt-2">
                      <Printer className="w-3.5 h-3.5 text-stage-500" weight="duotone" />
                      View &amp; print
                      <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── Email capture ── */}
      <Card variant="elevated" padding="spacious" className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center gap-2.5 mb-2">
          <EnvelopeSimple className="w-5 h-5 text-stage-500" weight="duotone" />
          <CardTitle>Get new templates first</CardTitle>
        </div>
        <p className="text-sm text-clay-500 mb-5 leading-relaxed">
          We add new templates and community theatre tips as we build them.
          Leave your email and we&apos;ll send them along — no spam, and you can
          leave anytime.
        </p>
        {subscribed ? (
          <p className="text-sm text-forest-600 font-semibold">
            You&apos;re on the list — see you in your inbox!
          </p>
        ) : (
          <form onSubmit={handleSubscribe} className="flex flex-col gap-3">
            {/* Honeypot — hidden from people, irresistible to bots */}
            <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
              <label htmlFor="resources-website">Website</label>
              <input
                id="resources-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Button type="submit" loading={submitting}>
                Send Me New Templates
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
