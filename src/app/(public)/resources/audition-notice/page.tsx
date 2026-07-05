"use client";

import {
  TemplatePage,
  TplSection,
  TplBlank,
  TplNote,
} from "@/components/resources/TemplatePage";

/* ============================================================
   /resources/audition-notice — printable fill-in-the-blank
   audition notice. Post it on the lobby board, the library
   corkboard, and everywhere your community actually looks.
   ============================================================ */

export default function AuditionNoticeTemplatePage() {
  return (
    <TemplatePage
      title="Audition Notice Template"
      intro="Everything actors need to walk in prepared — and everything that saves YOU twenty identical emails. Fill in the blanks, print it, post it. The commitment section up front is the part most notices skip, and the part actors thank you for."
    >
      <div className="text-center mb-8">
        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-2">Audition Notice</p>
        <div className="border-b-2 border-[#1a1a1a] pb-1 mb-1">
          <p className="font-display text-3xl">&nbsp;</p>
        </div>
        <p className="text-xs text-[#555]">Show title (and author / licensing credit if your contract requires it)</p>
      </div>

      <TplSection title="The Basics">
        <div className="flex flex-col gap-3">
          <TplBlank label="Theatre / producing group" />
          <TplBlank label="Director" />
          <div className="grid grid-cols-2 gap-4">
            <TplBlank label="Audition dates" />
            <TplBlank label="Times" />
          </div>
          <TplBlank label="Audition location (with parking note!)" />
          <div className="grid grid-cols-2 gap-4">
            <TplBlank label="Callbacks (if needed)" />
            <TplBlank label="Callback location" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TplBlank label="Performance dates" />
            <TplBlank label="Venue" />
          </div>
        </div>
      </TplSection>

      <TplSection title="Roles Available">
        <TplNote>
          List every role with a one-line description, the age the character PLAYS
          (not the actor&apos;s age), and vocal part for musicals. &ldquo;All roles open&rdquo;
          gets more people in the door than a pre-cast-looking list.
        </TplNote>
        <div className="mt-3 flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="grid grid-cols-[1fr_1fr] gap-4">
              <TplBlank label={`Role ${n}`} />
              <TplBlank label="Plays age / vocal part" />
            </div>
          ))}
          <TplBlank label="Ensemble" />
        </div>
      </TplSection>

      <TplSection title="What to Prepare">
        <TplNote>
          Be specific — &ldquo;32 bars of a song in the style of the show, bring sheet
          music in your key&rdquo; beats &ldquo;prepare a song.&rdquo; Say whether there&apos;s an
          accompanist, whether cold readings come from the script, and whether
          they should dress to move.
        </TplNote>
        <div className="mt-3 flex flex-col gap-3">
          <TplBlank label="Singing" />
          <TplBlank label="Reading / monologue" />
          <TplBlank label="Movement / dance" />
        </div>
      </TplSection>

      <TplSection title="The Commitment (read before you audition!)">
        <TplNote>
          The kindest thing a notice can do is be honest about the time. Actors
          plan their lives around this — and conflicts you learn about at
          auditions are conflicts, while conflicts you learn about in week four
          are emergencies.
        </TplNote>
        <div className="mt-3 flex flex-col gap-3">
          <TplBlank label="Rehearsals begin" />
          <TplBlank label="Typical rehearsal nights & times" />
          <TplBlank label="Tech week (everyone, every night)" />
          <TplBlank label="Number of performances" />
          <TplBlank label="Participation fees / costume expectations, if any" />
        </div>
      </TplSection>

      <TplSection title="Sign Up & Questions">
        <div className="flex flex-col gap-3">
          <TplBlank label="How to sign up (link, email, or walk-in)" />
          <TplBlank label="Questions? Contact" />
        </div>
        <p className="text-sm mt-4 leading-relaxed">
          New to auditioning? Come anyway. Community theatre runs on first-timers
          — we&apos;ll walk you through everything at the door.
        </p>
      </TplSection>

      <p className="text-[10px] text-[#888] text-center mt-8">
        Template from Overture — free casting &amp; production tools for community
        theatre · overturecasting.com/resources
      </p>
    </TemplatePage>
  );
}
