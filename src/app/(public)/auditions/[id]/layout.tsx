import type { Metadata } from "next";
import { getShowSeo } from "@/lib/seo";

/**
 * Metadata-only wrapper — the audition page itself is a client component,
 * so per-show SEO/OG tags come from this server layout. Falls back to
 * generic strings in mock mode or when the show isn't found.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const show = await getShowSeo(id);

  if (!show) {
    return {
      title: "Auditions",
      description:
        "Community theatre audition details on Overture — dates, roles, and signup.",
    };
  }

  const title = show.orgName
    ? `Auditions: ${show.title} at ${show.orgName}`
    : `Auditions: ${show.title}`;
  const where =
    show.city && show.state ? ` in ${show.city}, ${show.state}` : "";
  const description = `Audition for ${show.title}${
    show.orgName ? ` with ${show.orgName}` : ""
  }${where}. Dates, roles, and signup on Overture.`;

  // og:title/description auto-resolve from these; og:image and site_name
  // inherit from the root layout.
  return { title, description };
}

export default function AuditionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
