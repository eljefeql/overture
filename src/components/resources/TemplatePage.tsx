"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { Printer, ArrowLeft } from "@phosphor-icons/react";

/* ============================================================
   TemplatePage — shared scaffold for the /resources/[slug]
   printable templates. On screen: app chrome + intro + the
   template in a paper-like card. In print: ONLY the template
   (via the #print-area visibility trick), clean black-on-white.
   ============================================================ */

type Props = {
  title: string;
  intro: string;
  children: ReactNode;
};

export function TemplatePage({ title, intro, children }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Print rules: only the template area prints, on its own page. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            border: none;
            box-shadow: none;
            border-radius: 0;
          }
        }
      `}</style>

      {/* Screen-only chrome */}
      <div className="mb-6 animate-fade-up print:hidden">
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-sm text-clay-500 hover:text-curtain-900 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" weight="bold" />
          All resources
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display text-curtain-900">{title}</h1>
            <p className="text-sm text-clay-500 mt-2 leading-relaxed max-w-xl">{intro}</p>
          </div>
          <Button
            onClick={() => window.print()}
            icon={<Printer className="w-4 h-4" weight="bold" />}
          >
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* The printable template */}
      <div
        id="print-area"
        className="bg-white rounded-2xl border border-cream-200 shadow-md p-8 sm:p-10 mb-10 text-[#1a1a1a]"
      >
        {children}
      </div>
    </div>
  );
}

/* ── Small print-friendly building blocks ── */

export function TplHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-2xl text-[#1a1a1a] border-b-2 border-[#1a1a1a] pb-2 mb-4">
      {children}
    </h2>
  );
}

export function TplSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold tracking-wide uppercase mb-2">{title}</h3>
      {children}
    </div>
  );
}

/** A fill-in-the-blank line: label + underscored space. */
export function TplBlank({ label, width = "flex-1" }: { label: string; width?: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="font-semibold whitespace-nowrap">{label}:</span>
      <span className={`border-b border-[#1a1a1a] min-h-[1.25rem] ${width}`} />
    </div>
  );
}

export function TplCheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed">
      <span className="inline-block w-3.5 h-3.5 border border-[#1a1a1a] rounded-[3px] mt-1 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export function TplNote({ children }: { children: ReactNode }) {
  return <p className="text-xs italic text-[#555] leading-relaxed">{children}</p>;
}
