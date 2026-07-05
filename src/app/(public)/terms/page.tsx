import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Overture's Terms of Service — the plain-language rules for using the platform during our free beta.",
};

/** Shared typographic helpers for the legal pages. */
function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-display text-curtain-900 mb-3">{title}</h2>
      <div className="flex flex-col gap-3 text-sm text-curtain-800 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-stage-700 bg-stage-100 rounded-full px-3 py-1 mb-4">
        Draft — beta
      </span>
      <h1 className="text-3xl font-display text-curtain-900 mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-clay-500 mb-10">Last updated: July 5, 2026</p>

      <LegalSection title="Welcome to Overture">
        <p>
          Overture is a casting and talent platform for community theatre.
          These terms are the agreement between you and Overture when you
          create an account or use the site. We&apos;ve written them in plain
          language on purpose — if anything is unclear, ask us.
        </p>
      </LegalSection>

      <LegalSection title="Overture is in beta">
        <p>
          Overture is currently a <strong>free beta</strong>. That means the
          product is young: features will change, occasionally break, and
          sometimes disappear as we learn what works. We&apos;ll do our best
          to protect your data and keep things running, but during the beta
          the service is provided &quot;as is,&quot; without warranties, and
          we can&apos;t promise uninterrupted availability. If we ever
          introduce paid plans, we&apos;ll tell you clearly before anything
          costs money.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You need an account to audition, cast, or manage a theatre on
          Overture. Keep your password to yourself, give us accurate
          information, and let us know if you think someone else has used
          your account.
        </p>
        <p>
          Accounts for performers under 18 are managed with a parent or
          guardian. The guardian provides consent, appears on cast-offer
          agreements, and is the point of contact for the minor&apos;s
          account. See our{" "}
          <Link href="/privacy" className="text-curtain-700 underline underline-offset-2 hover:text-curtain-900">
            Privacy Policy
          </Link>{" "}
          for how we handle minors&apos; information.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Community theatre runs on trust, and so does Overture. You agree not to:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Impersonate another person or theatre, or create fake profiles.</li>
          <li>Harass, threaten, or discriminate against other members.</li>
          <li>
            Use information you can see on Overture (contact details,
            appearance notes, audition schedules) for anything other than
            legitimate casting and production purposes.
          </li>
          <li>Post content you don&apos;t have the right to share.</li>
          <li>Scrape the platform, probe its security, or interfere with how it runs.</li>
        </ul>
        <p>
          Production teams get access to some private performer information
          (like contact details) strictly to run their shows. Misusing that
          access is grounds for immediate removal.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You own what you put on Overture — your profile, photos, credits,
          show listings, and everything else you create. By posting it, you
          give us permission to store it and display it as the product is
          designed to (for example, showing your profile to production teams
          you audition for, or showing a theatre&apos;s public page to
          visitors). We don&apos;t sell your content and we don&apos;t claim
          ownership of it.
        </p>
        <p>
          If you delete content, we&apos;ll remove it from the product,
          though it may persist briefly in backups.
        </p>
      </LegalSection>

      <LegalSection title="Casting decisions are not ours">
        <p>
          Overture is a tool for theatres and performers. Theatres decide who
          they cast; performers decide which offers they accept. We
          don&apos;t take part in those decisions and aren&apos;t responsible
          for them, for the conduct of productions, or for what happens at
          in-person events like auditions and rehearsals.
        </p>
      </LegalSection>

      <LegalSection title="Ending an account">
        <p>
          You can stop using Overture whenever you like, and you can ask us
          to delete your account and data (see the Privacy Policy). We can
          suspend or terminate accounts that break these terms — especially
          anything involving the safety of minors or misuse of private
          information — with or without warning depending on severity.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          As the beta evolves, these terms will too. When we make meaningful
          changes we&apos;ll post the update here and note the date at the
          top. Continuing to use Overture after a change means you accept the
          updated terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? Email us at{" "}
          <a
            href="mailto:hello@overturecasting.com"
            className="text-curtain-700 underline underline-offset-2 hover:text-curtain-900"
          >
            hello@overturecasting.com
          </a>
          .
        </p>
      </LegalSection>

      <hr className="gold-line" />
      <p className="text-xs text-clay-500 mt-6">
        See also our{" "}
        <Link href="/privacy" className="text-curtain-700 underline underline-offset-2 hover:text-curtain-900">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
