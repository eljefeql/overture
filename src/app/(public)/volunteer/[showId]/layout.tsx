import type { Metadata } from "next";
import { getShowSeo } from "@/lib/seo";

/**
 * Metadata-only wrapper — the volunteer signup page itself is a client
 * component, so per-show SEO/OG tags come from this server layout. Falls
 * back to generic strings in mock mode or when the show isn't found.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ showId: string }>;
}): Promise<Metadata> {
  const { showId } = await params;
  const show = await getShowSeo(showId);

  if (!show) {
    return {
      title: "Volunteer",
      description:
        "Lend a hand at a community theatre production — claim a volunteer shift on Overture, no account needed.",
    };
  }

  const title = `Volunteer for ${show.title}`;
  const description = `${show.orgName ? `${show.orgName} needs` : "This production needs"} volunteers for ${show.title}. Claim a shift on Overture — no account needed.`;

  // og:title/description auto-resolve from these; og:image and site_name
  // inherit from the root layout.
  return { title, description };
}

export default function VolunteerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
