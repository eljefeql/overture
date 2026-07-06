"use client";

import {
  TemplatePage,
  TplHeading,
  TplSection,
  TplCheckItem,
  TplNote,
} from "@/components/resources/TemplatePage";

/* ============================================================
   /resources/casting-checklist — the timeline from "we picked
   the show" to "cast list is up," week by week.
   ============================================================ */

export default function CastingChecklistTemplatePage() {
  return (
    <TemplatePage
      title="Casting Checklist"
      intro="From choosing the show to posting the cast list, in order, so nothing slips. Timelines assume roughly eight weeks from announcement to first rehearsal — compress with care, not with hope."
    >
      <TplHeading>Casting Checklist</TplHeading>

      <TplSection title="8–10 weeks out — Lock the foundation">
        <ul className="flex flex-col gap-2">
          <TplCheckItem>
            Confirm performance rights &amp; licensing are SIGNED (not &ldquo;in
            progress&rdquo;) — never announce a show you don&apos;t have.
          </TplCheckItem>
          <TplCheckItem>
            Set performance dates and hold the venue for tech week too.
          </TplCheckItem>
          <TplCheckItem>
            Build the role list: who plays what age, vocal parts, which roles
            could double.
          </TplCheckItem>
          <TplCheckItem>
            Recruit your table team: director, music director, choreographer,
            stage manager — decide who has a vote and who has a veto.
          </TplCheckItem>
          <TplCheckItem>
            Draft the rehearsal calendar skeleton (nights per week, tech week,
            blackout dates) so you can be honest at auditions.
          </TplCheckItem>
        </ul>
      </TplSection>

      <TplSection title="5–7 weeks out — Announce & recruit">
        <ul className="flex flex-col gap-2">
          <TplCheckItem>
            Book audition dates, times, and a warm room with a piano (or a
            speaker and a plan).
          </TplCheckItem>
          <TplCheckItem>
            Publish the audition notice — include the full commitment picture,
            what to prepare, and how to sign up.
          </TplCheckItem>
          <TplCheckItem>
            Post everywhere your community actually is: socials, email list,
            local paper, lobby board, nearby theatres&apos; green rooms.
          </TplCheckItem>
          <TplCheckItem>
            Personally invite people. The best casts are half walk-ins, half
            &ldquo;the director asked me to come out.&rdquo;
          </TplCheckItem>
          <TplCheckItem>
            Prep audition forms: contact info, roles interested, CONFLICTS (make
            them list dates, not vibes), and photo/media consent.
          </TplCheckItem>
        </ul>
      </TplSection>

      <TplSection title="Audition week — Run a great room">
        <ul className="flex flex-col gap-2">
          <TplCheckItem>
            Staff the check-in table — a friendly face at the door sets the tone
            for the whole production.
          </TplCheckItem>
          <TplCheckItem>
            Decide your scoring shorthand with the table team BEFORE the first
            actor walks in.
          </TplCheckItem>
          <TplCheckItem>
            Keep notes on everyone — tonight&apos;s ensemble member is next
            season&apos;s lead.
          </TplCheckItem>
          <TplCheckItem>
            Collect every conflict in writing before actors leave the building.
          </TplCheckItem>
          <TplCheckItem>
            Thank every single person for coming. They gave you their evening.
          </TplCheckItem>
        </ul>
      </TplSection>

      <TplSection title="Callbacks — Answer specific questions">
        <ul className="flex flex-col gap-2">
          <TplCheckItem>
            Call back only for real questions (chemistry, range, dance level) —
            a callback is a request for more free time.
          </TplCheckItem>
          <TplCheckItem>
            Send sides/material at least 24 hours ahead.
          </TplCheckItem>
          <TplCheckItem>
            Read pairings against each other; mix combinations on purpose.
          </TplCheckItem>
          <TplCheckItem>
            Check conflict lists against your rehearsal calendar for every
            finalist BEFORE you fall in love with a cast.
          </TplCheckItem>
        </ul>
      </TplSection>

      <TplSection title="Casting week — Decide & offer">
        <ul className="flex flex-col gap-2">
          <TplCheckItem>
            Cast the show on paper, with an alternate in mind for each lead —
            someone always says no.
          </TplCheckItem>
          <TplCheckItem>
            Make offers privately (call or email) and give a response deadline —
            48 hours is fair.
          </TplCheckItem>
          <TplCheckItem>
            Wait for every acceptance before anything goes public. An offer
            isn&apos;t a cast list.
          </TplCheckItem>
          <TplCheckItem>
            Personally thank the people you didn&apos;t cast, and mean the
            invitation to next time. This is the step that builds a theatre.
          </TplCheckItem>
        </ul>
      </TplSection>

      <TplSection title="Announce — Start the company off right">
        <ul className="flex flex-col gap-2">
          <TplCheckItem>Post the cast list once it&apos;s complete and accepted.</TplCheckItem>
          <TplCheckItem>
            Send the welcome packet same-day: full rehearsal calendar, contact
            sheet, and who to ask about what.
          </TplCheckItem>
          <TplCheckItem>
            Schedule the read-through within two weeks while the excitement is
            hot.
          </TplCheckItem>
        </ul>
        <div className="mt-3">
          <TplNote>
            Rule of thumb: every casting decision is remembered for years —
            decide like it&apos;s a small town, because it is.
          </TplNote>
        </div>
      </TplSection>

      <p className="text-[10px] text-[#888] text-center mt-8">
        Template from Overture — free casting &amp; production tools for community
        theatre · overturestage.com/resources
      </p>
    </TemplatePage>
  );
}
