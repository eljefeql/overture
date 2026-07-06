#!/usr/bin/env node
// ============================================================================
// QA HORDE — signs up 45 QA actors for a show's auditions on STAGING.
//
//   node scripts/qa-horde.mjs
//
// Reads .env.local (NEXT_PUBLIC_SUPABASE_URL + ANON KEY — anon key only).
// Each actor authenticates as themself (per-user JWT) and inserts their OWN
// audition_signups + signup_conflicts rows, exactly mirroring the cloud
// branch of signUpForAudition in src/lib/api/client.ts. RLS does the rest.
//
// Idempotent: actors who already have a non-withdrawn signup for the show
// are skipped, and block fill counts start from the live
// get_slot_availability RPC — safe to re-run after a partial failure.
//
// The seeded story (deterministic, no randomness):
//   · Monday's first three blocks (6:30 / 7:00 / 7:30) fill COMPLETELY → "Full"
//   · Tuesday's last two blocks stay EMPTY
//   · the other 27 actors spread across the 7 middle blocks
//   · conflicts (all inside the rehearsal window Aug 3 – Sep 24):
//       15 actors — zero conflicts
//       18 actors — 1–2 short ranges scattered
//        8 actors — ALL include Aug 14–16 (the engineered problem weekend)
//        4 actors — 5+ total days (vacation people → "review carefully")
//   · roles follow each actor's seeded vocal range; 5 minors (53–57) aim
//     at Shprintze/Bielke.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOW_ID = "965ad8a2-94a1-4f3d-9fc4-6331bf0d500d"; // Fiddler on the Roof
const PASSWORD = "OvertureQA2026!";
const DELAY_MS = 1500;

// ── env ─────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !ANON) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in .env.local");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { token, method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

async function signIn(email) {
  // Supabase auth rate-limits password grants — back off and retry on 429.
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await api(`/auth/v1/token?grant_type=password`, {
        method: "POST",
        body: { email, password: PASSWORD },
      });
      return { token: data.access_token, userId: data.user.id };
    } catch (e) {
      if (attempt < 6 && String(e.message).includes("429")) {
        const wait = 15000 * (attempt + 1);
        console.log(`  … auth rate-limited, waiting ${wait / 1000}s (${email})`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

// ── the cast of 45: actors 01–40 plus five minors (53–57) ──────────────────
const ACTOR_NUMS = [
  ...Array.from({ length: 40 }, (_, i) => i + 1),
  53, 54, 55, 56, 57,
];
const emailFor = (n) => `qa.actor.${String(n).padStart(2, "0")}@overturestage.com`;

// ── conflict story (deterministic buckets by actor number) ──────────────────
// 8 problem-weekend actors: all include Aug 14–16.
const PROBLEM_WEEKEND = new Set([2, 7, 11, 15, 22, 28, 33, 53]);
// 4 heavy-vacation actors: 5+ total conflict days.
const VACATION = new Set([5, 18, 26, 38]);
// Of the remaining 33: 15 get zero conflicts, 18 get 1–2 short ranges.
const ZERO = new Set([1, 4, 9, 12, 16, 20, 24, 29, 31, 35, 37, 40, 54, 56, 57]);
// (everyone else → SHORT)

// short scattered ranges, all inside Aug 3 – Sep 24, cycled by index
const SHORT_RANGES = [
  [["2026-08-10", "2026-08-10"]],
  [["2026-08-21", "2026-08-22"]],
  [["2026-09-02", "2026-09-02"]],
  [["2026-08-28", "2026-08-29"], ["2026-09-11", "2026-09-11"]],
  [["2026-09-07", "2026-09-08"]],
  [["2026-08-06", "2026-08-07"]],
  [["2026-09-18", "2026-09-19"]],
  [["2026-08-31", "2026-09-01"], ["2026-09-14", "2026-09-14"]],
  [["2026-09-04", "2026-09-05"]],
];
// extra single range some problem-weekend actors also carry (cycled)
// (kept to 1 day so problem-weekend actors stay under the 5+ "vacation" bucket)
const PW_EXTRAS = [null, [["2026-09-08", "2026-09-08"]], null, [["2026-08-27", "2026-08-27"]]];
// vacation actors: two long ranges each (7–10 days total)
const VACATION_RANGES = [
  [["2026-08-10", "2026-08-14"], ["2026-09-07", "2026-09-09"]], // 8 days
  [["2026-08-17", "2026-08-21"], ["2026-09-14", "2026-09-15"]], // 7 days
  [["2026-08-24", "2026-08-28"], ["2026-09-02", "2026-09-04"]], // 8 days
  [["2026-08-05", "2026-08-08"], ["2026-09-17", "2026-09-21"]], // 9 days
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDay = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};
const fmtRange = ([a, b]) => (a === b ? fmtDay(a) : `${fmtDay(a)} to ${fmtDay(b)}`);
const dayCount = (ranges) =>
  ranges.reduce((sum, [a, b]) => sum + (Date.parse(b) - Date.parse(a)) / 86400000 + 1, 0);

function conflictsFor(num, seq) {
  if (VACATION.has(num)) return VACATION_RANGES[[...VACATION].indexOf(num)];
  if (PROBLEM_WEEKEND.has(num)) {
    const extra = PW_EXTRAS[[...PROBLEM_WEEKEND].indexOf(num) % PW_EXTRAS.length];
    return [["2026-08-14", "2026-08-16"], ...(extra ?? [])];
  }
  if (ZERO.has(num)) return [];
  return SHORT_RANGES[seq % SHORT_RANGES.length];
}

// ── role mapping by seeded vocal range ──────────────────────────────────────
const ROLE_MAP = [
  { match: /Soprano|Mezzo/, roles: ["Hodel", "Chava", "Tzeitel"] },
  { match: /Alto/, roles: ["Golde", "Yente"] },
  { match: /Tenor/, roles: ["Motel", "Perchik"] },
  { match: /Baritone/, roles: ["Perchik", "Fyedka", "Lazar Wolf"] },
  { match: /Bass/, roles: ["Tevye", "Rabbi"] },
];
const MINOR_ROLES = ["Shprintze", "Bielke"];
const REFERRALS = ["Facebook", "Friend or cast member", "Overture browse", "Poster"];

function pickRoles(num, seq, vocalRange, roleIdByName) {
  const isMinor = num >= 53;
  let names;
  if (isMinor) {
    // minors aim at the little sisters; a couple also try a daughter role
    names = seq % 2 === 0 ? MINOR_ROLES : [MINOR_ROLES[seq % 2], "Chava"];
  } else {
    const entry = ROLE_MAP.find((r) => r.match.test(vocalRange ?? ""));
    names = entry ? entry.roles : ["Villagers of Anatevka"];
    // vary 1–3 roles: rotate a window over the list
    const take = (seq % 3) + 1;
    names = names.slice(0, Math.max(1, Math.min(take, names.length)));
    // every 4th actor tacks on ensemble interest
    if (seq % 4 === 3 && !names.includes("Villagers of Anatevka"))
      names = [...names, "Villagers of Anatevka"].slice(0, 3);
  }
  return names.map((n) => roleIdByName[n]).filter(Boolean);
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`QA horde → ${URL_BASE}\nShow ${SHOW_ID}\n`);

  // Blocks + roles via one authenticated read (first actor's token works).
  const scout = await signIn(emailFor(ACTOR_NUMS[0]));
  const [roles, blocks, availability] = await Promise.all([
    api(`/rest/v1/show_roles?show_id=eq.${SHOW_ID}&select=id,name`, { token: scout.token }),
    api(
      `/rest/v1/audition_groups?show_id=eq.${SHOW_ID}&select=id,name,start_time,slot_count&order=start_time`,
      { token: scout.token }
    ),
    api(`/rest/v1/rpc/get_slot_availability`, {
      token: scout.token,
      method: "POST",
      body: { p_show_id: SHOW_ID },
    }),
  ]);
  const roleIdByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const roleNameById = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  if (blocks.length !== 12) console.warn(`Expected 12 blocks, found ${blocks.length}`);

  // Live fill counts (idempotency: re-runs continue where we left off).
  const taken = Object.fromEntries(blocks.map((b) => [b.id, 0]));
  for (const a of availability ?? []) taken[a.group_id] = a.taken;

  // Target distribution: fill Monday 6:30/7:00/7:30 (blocks 0–2) to 6 each;
  // spread 27 across blocks 3–9; leave Tuesday 8:30/9:00 (blocks 10–11) empty.
  const plan = [];
  for (const idx of [0, 1, 2]) for (let k = 0; k < 6; k++) plan.push(idx);
  const middle = [3, 4, 5, 6, 7, 8, 9];
  for (let k = 0; k < 27; k++) plan.push(middle[k % middle.length]);
  // plan.length === 45, one block index per actor in order

  const results = [];
  let created = 0, skipped = 0, failed = 0;

  for (let seq = 0; seq < ACTOR_NUMS.length; seq++) {
    const num = ACTOR_NUMS[seq];
    const email = emailFor(num);
    try {
      const { token, userId } = await signIn(email);

      // idempotency — already signed up?
      const existing = await api(
        `/rest/v1/audition_signups?show_id=eq.${SHOW_ID}&actor_id=eq.${userId}&select=id,status,group_id`,
        { token }
      );
      if (existing.length > 0 && existing[0].status !== "withdrawn") {
        skipped++;
        results.push({ num, email, block: "(already)", roles: "-", days: "-" });
        continue;
      }

      // own profile + vocal range
      const [profile] = await api(
        `/rest/v1/profiles?id=eq.${userId}&select=display_name`, { token }
      );
      const details = await api(
        `/rest/v1/actor_details?user_id=eq.${userId}&select=vocal_range`, { token }
      );
      const vocal = details[0]?.vocal_range ?? "";

      const block = blocks[plan[seq]];
      if (taken[block.id] >= block.slot_count)
        throw new Error(`planned block ${block.name} unexpectedly full`);

      const roleIds = pickRoles(num, seq, vocal, roleIdByName);
      const ranges = conflictsFor(num, seq);
      const freetext = ranges.map(fmtRange).join(", ");

      const row = {
        show_id: SHOW_ID,
        actor_id: userId,
        group_id: block.id,
        slot_position: taken[block.id] + 1,
        roles_interested: roleIds,
        open_to_other: seq % 5 < 2, // ~40%
        will_crew: seq % 5 === 0, // ~20%
        conflicts: freetext || null,
        status: "signed_up",
        signed_up_at: new Date().toISOString(),
        is_member: seq % 10 < 3, // ~30%
        mailing_list: seq % 2 === 0, // ~50%
        referral_source: REFERRALS[seq % REFERRALS.length],
        media_consent: seq % 10 < 7, // ~70%
        commitment_acknowledged: true,
      };

      const [signup] = await api(`/rest/v1/audition_signups`, {
        token,
        method: "POST",
        body: row,
        prefer: "return=representation",
      });
      taken[block.id]++;

      if (ranges.length > 0) {
        await api(`/rest/v1/signup_conflicts`, {
          token,
          method: "POST",
          body: ranges.map(([a, b]) => ({
            signup_id: signup.id,
            start_date: a,
            end_date: b,
          })),
        });
      }

      created++;
      const day = block.start_time < "2026-07-28T12" ? "Mon" : "Tue";
      results.push({
        num,
        email: profile?.display_name ?? email,
        block: `${day} ${block.name}`,
        roles: roleIds.map((id) => roleNameById[id]).join(", "),
        days: dayCount(ranges),
      });
    } catch (e) {
      failed++;
      results.push({ num, email, block: "FAILED", roles: "-", days: "-" });
      console.error(`  ✗ ${email}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  // ── summary ──
  console.log("\n#   Actor                    Block         Roles                              Conf.days");
  console.log("-".repeat(100));
  for (const r of results) {
    console.log(
      `${String(r.num).padStart(2, "0")}  ${String(r.email).padEnd(24)} ${String(r.block).padEnd(13)} ${String(r.roles).padEnd(34)} ${r.days}`
    );
  }
  console.log("-".repeat(100));
  console.log(`created ${created} · skipped ${skipped} · failed ${failed}`);
  console.log("\nBlock fill counts:");
  for (const b of blocks) {
    const day = b.start_time < "2026-07-28T12" ? "Mon Jul 27" : "Tue Jul 28";
    console.log(`  ${day} ${b.name.padEnd(8)} ${taken[b.id]}/${b.slot_count}${taken[b.id] >= b.slot_count ? "  FULL" : taken[b.id] === 0 ? "  (empty)" : ""}`);
  }
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
