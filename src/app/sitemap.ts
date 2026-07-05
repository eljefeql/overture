import type { MetadataRoute } from "next";
import { SITE_URL, getOpenShowIds, getOrgIds } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/resources`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/resources/audition-notice`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/resources/casting-checklist`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/resources/rehearsal-schedule`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
  ];

  // Public dynamic pages — empty arrays when Supabase isn't configured.
  const [showIds, orgIds] = await Promise.all([getOpenShowIds(), getOrgIds()]);

  const showRoutes: MetadataRoute.Sitemap = showIds.map((id) => ({
    url: `${SITE_URL}/auditions/${id}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const orgRoutes: MetadataRoute.Sitemap = orgIds.map((id) => ({
    url: `${SITE_URL}/theatres/${id}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...showRoutes, ...orgRoutes];
}
