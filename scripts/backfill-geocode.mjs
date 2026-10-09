#!/usr/bin/env node
/**
 * backfill-geocode.mjs — one-time geocoding backfill for migration 018.
 *
 * Fills latitude/longitude on every orgs / venues / profiles row that has a
 * location (orgs + profiles: city + state; venues: address) but no
 * coordinates yet. Rows that already have a latitude are never touched, so
 * the script is safe to re-run.
 *
 * OWNER-RUN ONLY. It needs the Supabase SERVICE ROLE key (RLS would stop the
 * anon key from updating other users' profiles). Both secrets must be passed
 * EXPLICITLY on the command line — there is deliberately no env-var
 * fallback, so nothing can leak in by accident. Never commit either key.
 *
 * Usage:
 *   node scripts/backfill-geocode.mjs \
 *     --url https://YOUR-PROJECT-REF.supabase.co \
 *     --service-key "eyJ..." \
 *     --geocode-key "AIza..." \
 *     [--dry-run]
 *
 *   --url          Supabase project URL
 *   --service-key  Supabase service role key (Project Settings → API)
 *   --geocode-key  Google Geocoding API key
 *   --dry-run      Look everything up and print what WOULD change, write nothing
 *
 * Requires Node 18+ (built-in fetch). Waits 150ms between Google calls to
 * stay far under rate limits. Prints a per-table summary at the end.
 */

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const SUPABASE_URL = getArg("--url");
const SERVICE_KEY = getArg("--service-key");
const GEOCODE_KEY = getArg("--geocode-key");
const DRY_RUN = args.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY || !GEOCODE_KEY) {
  console.error(
    "Refusing to run: --url, --service-key and --geocode-key are all required.\n" +
      "(No env-var fallback by design — pass the keys explicitly.)\n\n" +
      "Usage:\n" +
      "  node scripts/backfill-geocode.mjs --url <supabase url> " +
      "--service-key <service role key> --geocode-key <google key> [--dry-run]"
  );
  process.exit(1);
}

const BASE = SUPABASE_URL.replace(/\/+$/, "");
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${init.method ?? "GET"} ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function geocode(query) {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(query)}&components=country:US&key=${GEOCODE_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const data = await res.json();
  if (data.status !== "OK") return { ok: false, reason: data.status };
  const loc = data.results?.[0]?.geometry?.location;
  if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
    return { ok: false, reason: "no location in result" };
  }
  return { ok: true, latitude: loc.lat, longitude: loc.lng };
}

/**
 * tables: name → { select, filter, toQuery(row), label(row) }
 * Each pulls rows with a location but latitude IS NULL.
 */
const TABLES = [
  {
    name: "orgs",
    select: "id,name,city,state",
    filter: "latitude=is.null&city=not.is.null&state=not.is.null",
    toQuery: (r) => (r.city?.trim() && r.state?.trim() ? `${r.city.trim()}, ${r.state.trim()}` : null),
    label: (r) => `${r.name} (${r.city}, ${r.state})`,
  },
  {
    name: "venues",
    select: "id,name,address",
    filter: "latitude=is.null&address=not.is.null",
    toQuery: (r) => (r.address?.trim() ? r.address.trim() : null),
    label: (r) => `${r.name} (${r.address})`,
  },
  {
    name: "profiles",
    select: "id,location_city,location_state",
    filter: "latitude=is.null&location_city=not.is.null&location_state=not.is.null",
    toQuery: (r) =>
      r.location_city?.trim() && r.location_state?.trim()
        ? `${r.location_city.trim()}, ${r.location_state.trim()}`
        : null,
    label: (r) => `profile ${r.id} (${r.location_city}, ${r.location_state})`,
  },
];

async function main() {
  console.log(`Backfill geocode → ${BASE}${DRY_RUN ? "  [DRY RUN — no writes]" : ""}\n`);
  const summary = [];

  for (const t of TABLES) {
    let rows;
    try {
      rows = await rest(`${t.name}?select=${t.select}&${t.filter}&limit=2000`);
    } catch (e) {
      // Table or columns may not exist yet (migration 018 not pasted).
      console.error(`  ${t.name}: SKIPPED — ${e.message}`);
      summary.push({ table: t.name, found: 0, updated: 0, failed: 0, skipped: true });
      continue;
    }

    console.log(`${t.name}: ${rows.length} row(s) need coordinates`);
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      const query = t.toQuery(row);
      if (!query) {
        failed++;
        continue;
      }
      await sleep(150); // be polite to the Geocoding API
      const geo = await geocode(query);
      if (!geo.ok) {
        console.log(`  ✗ ${t.label(row)} — ${geo.reason}`);
        failed++;
        continue;
      }
      if (DRY_RUN) {
        console.log(`  · ${t.label(row)} → ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)} (dry run)`);
        updated++;
        continue;
      }
      try {
        await rest(`${t.name}?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ latitude: geo.latitude, longitude: geo.longitude }),
        });
        console.log(`  ✓ ${t.label(row)} → ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`);
        updated++;
      } catch (e) {
        console.log(`  ✗ ${t.label(row)} — update failed: ${e.message}`);
        failed++;
      }
    }
    summary.push({ table: t.name, found: rows.length, updated, failed, skipped: false });
  }

  console.log("\n──── Summary ────");
  for (const s of summary) {
    console.log(
      s.skipped
        ? `${s.table.padEnd(10)} skipped (columns missing? paste migration 018 first)`
        : `${s.table.padEnd(10)} ${s.updated}/${s.found} geocoded${s.failed ? `, ${s.failed} failed` : ""}${DRY_RUN ? " (dry run)" : ""}`
    );
  }
}

main().catch((e) => {
  console.error("Backfill failed:", e.message);
  process.exit(1);
});
