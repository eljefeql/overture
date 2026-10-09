/**
 * POST /api/geocode — server-side city/state → coordinates lookup.
 *
 * Body: { city: string, state: string } OR { address: string } (venues send
 * their free-text address). Response is ALWAYS 200 with
 * { latitude: number | null, longitude: number | null } for any valid-shaped
 * request — "we couldn't geocode that" is a normal outcome, never an error
 * the caller has to handle. Only a malformed request gets a 400.
 *
 * Uses the Google Geocoding API with the server-only GEOCODING_API_KEY env
 * var (NOT NEXT_PUBLIC — the key must never reach the client). When the key
 * is unset, or Google fails / returns ZERO_RESULTS, callers get nulls and
 * carry on; raw Google errors are logged server-side only.
 */

const NULL_RESULT = { latitude: null, longitude: null };

/** Non-empty trimmed string within a sane length cap. */
function cleanString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  // Either a free-text address (venues) or city + state (profiles/orgs).
  const address = cleanString(b.address, 200);
  const city = cleanString(b.city, 120);
  const state = cleanString(b.state, 60);
  const query = address ?? (city && state ? `${city}, ${state}` : null);
  if (!query) {
    return Response.json(
      { error: "Provide { city, state } or { address }." },
      { status: 400 }
    );
  }

  const key = process.env.GEOCODING_API_KEY;
  if (!key) return Response.json(NULL_RESULT);

  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?address=${encodeURIComponent(query)}` +
      "&components=country:US" +
      `&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn("Geocode lookup failed: HTTP", res.status);
      return Response.json(NULL_RESULT);
    }
    const data = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    if (data.status !== "OK") {
      if (data.status !== "ZERO_RESULTS") {
        console.warn("Geocode lookup failed: status", data.status);
      }
      return Response.json(NULL_RESULT);
    }
    const loc = data.results?.[0]?.geometry?.location;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
      return Response.json(NULL_RESULT);
    }
    return Response.json({ latitude: loc.lat, longitude: loc.lng });
  } catch (e) {
    // Timeout / network — log server-side, never surface details.
    console.warn("Geocode lookup failed:", e instanceof Error ? e.message : e);
    return Response.json(NULL_RESULT);
  }
}
