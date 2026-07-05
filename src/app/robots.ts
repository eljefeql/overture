import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Gated app areas — nothing indexable behind auth.
        "/discover",
        "/my-shows",
        "/notifications",
        "/profile",
        "/offers/",
        "/shows/",
        "/org",
        "/onboarding",
        // Tokened guest-cancel links are private to the recipient.
        "/volunteer/cancel/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
