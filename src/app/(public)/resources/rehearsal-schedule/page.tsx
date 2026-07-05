"use client";

import {
  TemplatePage,
  TplHeading,
  TplSection,
  TplBlank,
  TplNote,
} from "@/components/resources/TemplatePage";

/* ============================================================
   /resources/rehearsal-schedule — a weekly grid stage managers
   can print and fill, with the who's-called column that saves
   everyone's Tuesday nights.
   ============================================================ */

const WEEK_ROWS = 6;

function WeekGrid({ weekLabel }: { weekLabel: string }) {
  return (
    <div className="mb-6 break-inside-avoid">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-sm font-bold uppercase tracking-wide">{weekLabel}</span>
        <span className="border-b border-[#1a1a1a] flex-1 max-w-[160px] min-h-[1.1rem]" />
        <span className="text-xs text-[#555]">(week of)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-[#1a1a1a] px-2 py-1.5 text-left w-[15%]">Day / Time</th>
              <th className="border border-[#1a1a1a] px-2 py-1.5 text-left w-[18%]">Location</th>
              <th className="border border-[#1a1a1a] px-2 py-1.5 text-left w-[37%]">Working on</th>
              <th className="border border-[#1a1a1a] px-2 py-1.5 text-left w-[30%]">Who&apos;s called</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: WEEK_ROWS }).map((_, i) => (
              <tr key={i}>
                <td className="border border-[#1a1a1a] px-2 h-9" />
                <td className="border border-[#1a1a1a] px-2 h-9" />
                <td className="border border-[#1a1a1a] px-2 h-9" />
                <td className="border border-[#1a1a1a] px-2 h-9" />
              </tr>
            ))}
            <tr>
              <td className="border border-[#1a1a1a] px-2 py-1.5 text-xs font-semibold" colSpan={4}>
                Known conflicts this week:
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RehearsalScheduleTemplatePage() {
  return (
    <TemplatePage
      title="Rehearsal Schedule Template"
      intro="A weekly grid with the two columns that prevent 90% of rehearsal drama: what we're working on, and exactly who's called. Print a page per week or a stack for the whole run. Includes a conflicts row per week — collect them early, honor them always."
    >
      <TplHeading>Rehearsal Schedule</TplHeading>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <TplBlank label="Show" />
        <TplBlank label="Director" />
        <TplBlank label="Stage manager" />
        <TplBlank label="SM phone / email" />
        <TplBlank label="First rehearsal" />
        <TplBlank label="Opening night" />
      </div>

      <TplSection title="Ground rules (fill in yours)">
        <div className="flex flex-col gap-3">
          <TplBlank label="Call time means" />
          <TplBlank label="How to report an absence (and by when)" />
          <TplBlank label="Where schedule changes get posted" />
        </div>
        <div className="mt-3">
          <TplNote>
            Suggested defaults: &ldquo;Call time means ready to work, not walking
            in&rdquo; · &ldquo;Text the SM by 3pm, don&apos;t tell a castmate&rdquo; ·
            &ldquo;Changes posted by Sunday night for the coming week.&rdquo;
          </TplNote>
        </div>
      </TplSection>

      <WeekGrid weekLabel="Week 1" />
      <WeekGrid weekLabel="Week 2" />
      <WeekGrid weekLabel="Week 3" />

      <TplSection title="Scheduling tips from the trenches">
        <ul className="list-disc pl-5 text-sm flex flex-col gap-1.5 leading-relaxed">
          <li>
            Call people for the scenes they&apos;re IN. Nothing burns goodwill like
            three hours on a folding chair.
          </li>
          <li>
            Schedule act runs before you feel ready — the run tells you what to
            rehearse next.
          </li>
          <li>
            Protect one full day off per week. Tired volunteers quit; rested ones
            come back next season.
          </li>
          <li>
            Put tech week in writing on day one: everyone, every night, no
            exceptions — because it was never a surprise.
          </li>
        </ul>
      </TplSection>

      <p className="text-[10px] text-[#888] text-center mt-8">
        Template from Overture — free casting &amp; production tools for community
        theatre · overturecasting.com/resources
      </p>
    </TemplatePage>
  );
}
