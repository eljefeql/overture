// Generates supabase/seed_demo.sql from the mock data layer.
// Orgs, shows, show_roles, audition_groups only — people (profiles) are
// FK'd to auth.users and must come from real signups.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "seed-"));
execSync(
  `npx esbuild src/data/shows.ts --bundle --format=cjs --outfile=${tmp}/shows.cjs --alias:@=./src`,
  { stdio: "inherit" }
);
const mod = await import(`${tmp}/shows.cjs`);
const { orgs, shows, allShowRoles, auditionGroups } = mod.default ?? mod;

// Stable UUID from a mock id (md5 → uuid shape)
const uuid = (s) => {
  const h = createHash("md5").update(`overture:${s}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const qb = (v) => (v ? "true" : "false");

let sql = `-- Demo seed generated from mock data (orgs, shows, roles, audition groups)\n\n`;

for (const o of orgs) {
  sql += `INSERT INTO orgs (id, name, slug, logo_url, description, city, state, website_url, code_of_conduct) VALUES (${q(uuid(o.id))}, ${q(o.name)}, ${q(o.slug)}, ${q(o.logoUrl)}, ${q(o.description)}, ${q(o.city)}, ${q(o.state)}, ${q(o.websiteUrl)}, ${q(o.codeOfConduct)}) ON CONFLICT (id) DO NOTHING;\n`;
}
sql += "\n";
for (const s of shows) {
  sql += `INSERT INTO shows (id, org_id, title, author_info, show_type, season, status, audition_start, audition_end, callback_date, callback_start_time, callback_end_time, rehearsal_start, show_open, show_close, audition_location, audition_notes, callback_location, callback_notes, performance_location, callback_contact_name, callback_contact_phone, city, state, is_promoted) VALUES (${q(uuid(s.id))}, ${q(uuid(s.orgId))}, ${q(s.title)}, ${q(s.authorInfo)}, ${q(s.showType)}, ${q(s.season)}, ${q(s.status)}, ${q(s.auditionStart)}, ${q(s.auditionEnd)}, ${q(s.callbackDate)}, ${q(s.callbackStartTime)}, ${q(s.callbackEndTime)}, ${q(s.rehearsalStart)}, ${q(s.showOpen)}, ${q(s.showClose)}, ${q(s.auditionLocation)}, ${q(s.auditionNotes)}, ${q(s.callbackLocation)}, ${q(s.callbackNotes)}, ${q(s.performanceLocation)}, ${q(s.callbackContactName)}, ${q(s.callbackContactPhone)}, ${q(s.city)}, ${q(s.state)}, ${qb(s.isPromoted)}) ON CONFLICT (id) DO NOTHING;\n`;
}
sql += "\n";
for (const [showId, roles] of Object.entries(allShowRoles)) {
  for (const r of roles) {
    sql += `INSERT INTO show_roles (id, show_id, name, role_type, gender, age_range, vocal_range, description, sort_order) VALUES (${q(uuid(r.id))}, ${q(uuid(showId))}, ${q(r.name)}, ${q(r.roleType)}, ${q(r.gender)}, ${q(r.ageRange)}, ${q(r.vocalRange)}, ${q(r.description)}, ${r.sortOrder ?? 0}) ON CONFLICT (id) DO NOTHING;\n`;
  }
}
sql += "\n";
for (const g of auditionGroups) {
  sql += `INSERT INTO audition_groups (id, show_id, name, start_time, end_time, slot_count, sort_order) VALUES (${q(uuid(g.id))}, ${q(uuid(g.showId))}, ${q(g.name)}, ${q(g.startTime)}, ${q(g.endTime)}, ${g.slotCount}, ${g.sortOrder ?? 0}) ON CONFLICT (id) DO NOTHING;\n`;
}

writeFileSync("supabase/seed_demo.sql", sql);
console.log(
  `wrote supabase/seed_demo.sql: ${orgs.length} orgs, ${shows.length} shows, ${Object.values(allShowRoles).flat().length} roles, ${auditionGroups.length} groups`
);
