/**
 * Offer agreements — the commitments an actor (or their guardian) checks off
 * when accepting a cast offer.
 *
 * Shows may carry their own list in `shows.offer_agreements` (migration 022,
 * edited on the setup page). When that's null/empty we fall back to these
 * defaults — the exact copy that was hard-coded in the offer page before the
 * column existed — so every existing show keeps behaving identically.
 *
 * Format: each agreement is ONE string. Its first line renders as the bold
 * title; everything after the first newline renders as the body text.
 */

export type AgreementItem = { title: string; body: string };

/** Split a stored agreement string into title (first line) + body (rest). */
export function parseAgreement(raw: string): AgreementItem {
  const idx = raw.indexOf("\n");
  if (idx === -1) return { title: raw.trim(), body: "" };
  return { title: raw.slice(0, idx).trim(), body: raw.slice(idx + 1).trim() };
}

/**
 * The Overture default agreements, with the show's context woven in the same
 * way the old fixed copy did (org name, performance dates).
 */
export function defaultOfferAgreements(ctx: {
  orgName: string;
  performanceWindow?: string | null;
}): string[] {
  const dates = ctx.performanceWindow ? ` (${ctx.performanceWindow})` : "";
  return [
    "Rehearsal Attendance\nI understand that I may miss a maximum of 3 rehearsals during the production. Additional absences may result in being recast. I have shared my known conflicts with the production team.",
    `Performance Commitment\nI commit to being available for all scheduled performances${dates}. I understand that missing a performance is only permitted in cases of emergency or illness.`,
    `Code of Conduct\nI have read and agree to abide by ${ctx.orgName}'s Safe Space & Conduct Policy, which includes guidelines on respectful behavior, anti-harassment, and creating an inclusive environment for all cast and crew.`,
    `Membership & Participation\nI understand that participation requires an active ${ctx.orgName} membership ($35/year) and a minimum of 4 volunteer hours during the production (set build, strike, concessions, etc.). Membership can be paid online or at the first rehearsal.`,
    `Photo & Media Release\nI grant ${ctx.orgName} permission to use production photos and video for promotional purposes, including social media, the theatre's website, and printed materials.`,
  ];
}

/** The show's effective agreements: its own list, else the defaults. */
export function effectiveOfferAgreements(
  show: { offerAgreements?: string[] | null; orgName: string },
  performanceWindow?: string | null
): string[] {
  const own = (show.offerAgreements ?? []).map((s) => s.trim()).filter(Boolean);
  if (own.length > 0) return own;
  return defaultOfferAgreements({ orgName: show.orgName, performanceWindow });
}
