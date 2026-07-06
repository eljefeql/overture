/**
 * Server-side SEO helpers — lean Supabase REST reads for generateMetadata,
 * sitemap.ts, and robots.ts. Deliberately does NOT import supabase-js:
 * metadata runs on the server and only ever needs a couple of public columns
 * (show title / org name), so a plain fetch against the REST endpoint with
 * the anon key keeps it dependency-light. All public data, anon-readable
 * under existing RLS (orgs: all; shows: status != 'setup').
 *
 * Every helper degrades to null / [] when Supabase isn't configured (mock
 * mode) or on any error — callers fall back to generic strings.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://overturestage.com";

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

async function restFetch<T>(query: string): Promise<T | null> {
  if (!isConfigured) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      // Metadata freshness: revalidate every 5 minutes.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Per-page metadata reads ─────────────────────────────────────────────

export async function getShowSeo(
  showId: string
): Promise<{ title: string; orgName: string | null; city: string | null; state: string | null } | null> {
  const rows = await restFetch<
    Array<{
      title: string;
      city: string | null;
      state: string | null;
      orgs: { name: string } | null;
    }>
  >(
    `shows?id=eq.${encodeURIComponent(showId)}&select=title,city,state,orgs(name)&limit=1`
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    title: row.title,
    orgName: row.orgs?.name ?? null,
    city: row.city,
    state: row.state,
  };
}

export async function getOrgSeo(
  orgId: string
): Promise<{ name: string; city: string | null; state: string | null } | null> {
  const rows = await restFetch<
    Array<{ name: string; city: string | null; state: string | null }>
  >(`orgs?id=eq.${encodeURIComponent(orgId)}&select=name,city,state&limit=1`);
  return rows?.[0] ?? null;
}

// ── Sitemap reads ───────────────────────────────────────────────────────

/** Shows with open auditions — the public audition pages worth indexing. */
export async function getOpenShowIds(): Promise<string[]> {
  const rows = await restFetch<Array<{ id: string }>>(
    `shows?status=eq.auditions_open&select=id&limit=500`
  );
  return rows?.map((r) => r.id) ?? [];
}

/** All theatre orgs — public theatre pages are anon-viewable. */
export async function getOrgIds(): Promise<string[]> {
  const rows = await restFetch<Array<{ id: string }>>(
    `orgs?select=id&limit=500`
  );
  return rows?.map((r) => r.id) ?? [];
}
