import type { Metadata } from "next";
import { getOrgSeo } from "@/lib/seo";

/**
 * Metadata-only wrapper — the theatre page itself is a client component,
 * so per-theatre SEO/OG tags come from this server layout. Falls back to
 * generic strings in mock mode or when the org isn't found.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgId: string }>;
}): Promise<Metadata> {
  const { orgId } = await params;
  const org = await getOrgSeo(orgId);

  if (!org) {
    return {
      title: "Theatre",
      description:
        "A community theatre on Overture — shows, auditions, spaces, and people.",
    };
  }

  const title = `${org.name} — community theatre`;
  const where = org.city && org.state ? ` in ${org.city}, ${org.state}` : "";
  const description = `${org.name}${where} on Overture — upcoming season, open auditions, performance spaces, and people.`;

  // og:title/description auto-resolve from these; og:image and site_name
  // inherit from the root layout.
  return { title, description };
}

export default function TheatreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
