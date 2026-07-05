import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse open auditions",
  description:
    "Open community theatre auditions near you. Browse shows, see audition dates, and sign up for a slot — free for actors.",
  // og:title/description auto-resolve from the fields above; og:image and
  // site_name inherit from the root layout.
};

/** Metadata-only wrapper — the browse page itself is a client component. */
export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
