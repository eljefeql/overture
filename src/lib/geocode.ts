/**
 * Client-side geocoding helper — thin wrapper over POST /api/geocode.
 *
 * Best-effort by design: every failure path (bad input, network error,
 * timeout, key not configured, nothing found) resolves to null so a save is
 * NEVER blocked on geocoding. Callers include the coordinates in their write
 * when present and simply carry on when null.
 */

export type GeoPoint = { latitude: number; longitude: number };

const TIMEOUT_MS = 4000;

async function fetchGeocode(body: Record<string, string>): Promise<GeoPoint | null> {
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      latitude?: number | null;
      longitude?: number | null;
    };
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      return { latitude: data.latitude, longitude: data.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

/** City + state → coordinates, or null (always resolves, never throws). */
export async function geocodeCityState(
  city: string | null | undefined,
  state: string | null | undefined
): Promise<GeoPoint | null> {
  const c = (city ?? "").trim();
  const s = (state ?? "").trim();
  if (!c || !s) return null;
  return fetchGeocode({ city: c, state: s });
}

/** Free-text address (venues) → coordinates, or null (never throws). */
export async function geocodeAddress(
  address: string | null | undefined
): Promise<GeoPoint | null> {
  const a = (address ?? "").trim();
  if (!a) return null;
  return fetchGeocode({ address: a });
}
