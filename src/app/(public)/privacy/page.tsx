import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Overture collects, uses, and protects your information — including how we handle minors' and guardians' data.",
};

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

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-stage-700 bg-stage-100 rounded-full px-3 py-1 mb-4">
        Draft — beta
      </span>
      <h1 className="text-3xl font-display text-curtain-900 mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-clay-500 mb-10">Last updated: July 5, 2026</p>

      <LegalSection title="The short version">
        <p>
          We collect what a casting platform needs to work, we show your
          private details only to you and the production teams you choose to
          audition for, we <strong>never sell your data</strong>, and you can
          ask us to delete everything at any time.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>
          <strong>Account basics</strong> — your name, email, and password
          (stored securely by our authentication provider; we never see the
          password itself).
        </p>
        <p>
          <strong>Your performer profile</strong> — what you choose to share:
          bio, location, photos, resume, credits, training, skills, vocal
          range, and similar. Some fields are more sensitive and are treated
          as private: contact details, appearance description, measurements,
          accessibility needs, and dealbreakers.
        </p>
        <p>
          <strong>Audition and casting activity</strong> — signups, schedule
          conflicts you report, callbacks, offers, and cast lists, so
          theatres can run their productions.
        </p>
        <p>
          <strong>Usage data</strong> — basic product analytics (pages
          visited, features used) and error reports, so we can fix bugs and
          improve the product.
        </p>
      </LegalSection>

      <LegalSection title="Who can see what">
        <p>Your profile has three visibility tiers, enforced in the product:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <strong>Public to members</strong> — name, credits, skills,
            training, and awards are visible to signed-in Overture members.
            Anonymous visitors never see personal profiles.
          </li>
          <li>
            <strong>Private</strong> — contact details, appearance notes,
            measurements, and guardian information are visible only to you
            and the production teams of shows you audition for.
          </li>
          <li>
            <strong>Hidden</strong> — dealbreakers and accessibility needs
            are visible only to you.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Minors and guardians">
        <p>
          Overture supports young performers through{" "}
          <strong>guardian-managed accounts</strong>. When an account is for
          a performer under 18:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            A parent or guardian sets up and manages the account, and their
            name and contact details are attached to it.
          </li>
          <li>
            Cast offers for minors require the guardian to review and accept
            agreements on the performer&apos;s behalf.
          </li>
          <li>
            Guardian contact information is private-tier data: visible only
            to the guardian, the performer, and the production teams of shows
            the performer auditions for.
          </li>
          <li>
            We collect no more information about minors than the casting
            process needs, and guardians can ask us to delete a minor&apos;s
            account and data at any time.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Service providers we rely on">
        <p>
          We don&apos;t sell or rent your data to anyone. To run Overture we
          share data with a small set of processors, only as needed to
          provide the service:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <strong>Supabase</strong> — our database, authentication, and
            file storage. This is where your account and profile live.
          </li>
          <li>
            <strong>PostHog</strong> — product analytics, so we can see which
            features help and which confuse.
          </li>
          <li>
            <strong>Sentry</strong> — error monitoring, so we find out about
            bugs (error reports can include technical details about your
            session).
          </li>
          <li>
            <strong>Resend</strong> — sends transactional email like audition
            reminders, callback invitations, and cast offers.
          </li>
        </ul>
        <p>
          Each of these providers processes data under their own security and
          privacy commitments, on our instructions.
        </p>
      </LegalSection>

      <LegalSection title="Email from us">
        <p>
          We send transactional email tied to your activity — audition
          reminders, callback notifications, offers, and account messages. As
          notification preferences arrive during the beta you&apos;ll be able
          to tune these; until then, they&apos;re part of how the product
          works.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>You can, at any time:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>See and edit your profile information directly in the app.</li>
          <li>
            Ask for a copy of the data we hold about you, or ask us to
            <strong> delete your account and data</strong> — email{" "}
            <a
              href="mailto:hello@overturecasting.com"
              className="text-curtain-700 underline underline-offset-2 hover:text-curtain-900"
            >
              hello@overturecasting.com
            </a>{" "}
            and we&apos;ll take care of it. Guardians can do the same for a
            minor&apos;s account.
          </li>
        </ul>
        <p>
          Deleted data may persist briefly in backups before it&apos;s purged.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          As the beta evolves we&apos;ll update this policy and note the date
          at the top. Meaningful changes to how we handle your data will be
          announced in the product, not slipped in quietly.
        </p>
      </LegalSection>

      <hr className="gold-line" />
      <p className="text-xs text-clay-500 mt-6">
        See also our{" "}
        <Link href="/terms" className="text-curtain-700 underline underline-offset-2 hover:text-curtain-900">
          Terms of Service
        </Link>
        .
      </p>
    </div>
  );
}
