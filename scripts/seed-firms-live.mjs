// Brings the firm data in your LIVE Supabase project in line with supabase/data/firms-import.json
// (built from the two PDFs by scripts/extract-*.py + scripts/import-firms.mjs).
//
//   node --env-file=.env scripts/seed-firms-live.mjs            # dry run: shows what it would do
//   node --env-file=.env scripts/seed-firms-live.mjs --apply    # ADD what is missing (never deletes anything)
//   node --env-file=.env scripts/seed-firms-live.mjs --apply --replace
//                                                               # wipe firms/offers/invoices first, then load everything
//
// --apply (the normal mode), in order:
//   1. Adds every firm from the PDFs that is not in the database yet (matched by name + city + contact), dated by the day
//      its email was sent. Firms already there — including any you changed in the app — are left untouched.
//   2. Repairs the few earlier records that were imported with a defect (two email addresses glued into one, tracking
//      links like "?utm_source=chatgpt.com"). Status, region and everything else are never overwritten.
//   3. Rebuilds the daily dashboard snapshots from the send dates and records today's from the live data.
//   4. Marks the cities listed in supabase/data/completed-cities.json as completed.
//
// --replace additionally starts with: a JSON backup in supabase/backups/, then deletes invoices, offers, firms (their
// status history goes with them) and the dashboard history. Employees, contracts, users and permissions are never touched.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCompleted } from "./lib/completed-sql.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
const replace = process.argv.includes("--replace");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Run with --env-file=.env (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY)");
if (replace && !apply) throw new Error("--replace only makes sense together with --apply");

const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
async function rest(method, path, body, extra = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { method, headers: { ...H, ...extra }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const count = async (table) => {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: { ...H, Prefer: "count=exact" } });
  return parseInt((res.headers.get("content-range") ?? "").split("/")[1], 10);
};
/** Reads a whole table, page by page (the API returns at most 1000 rows per request). */
async function readAll(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await rest("GET", path, null, { Range: `${from}-${from + 999}`, "Range-Unit": "items" });
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const firms = JSON.parse(readFileSync(join(root, "supabase", "data", "firms-import.json"), "utf8"));
const admin = (await rest("GET", "app_users?select=id&account_role=eq.admin&limit=1"))[0];
const at = (day) => `${day ?? new Date().toISOString().slice(0, 10)}T09:00:00Z`;
const norm = (v) => String(v ?? "").trim().toLowerCase();
const nameCity = (f) => `${norm(f.name)}|${norm(f.city)}`;

// ------------------------------------------------------------------ plan
let existing = await readAll("firms?select=id,name,city,contact_email,website,notes,created_at&order=created_at");
if (replace) existing = []; // after the wipe there is nothing to compare with
const groups = new Map(); // name|city -> existing rows
for (const e of existing) (groups.get(nameCity(e)) ?? groups.set(nameCity(e), []).get(nameCity(e))).push({ ...e, used: false });

const toInsert = [];
const toRepair = []; // [existing row, import row]
const badEmail = (e) => (e ?? "").split("@").length > 2;
const badSite = (w) => /utm|chatgpt|google\.com\/maps/i.test(w ?? "");
for (const f of firms) {
  const candidates = groups.get(nameCity(f)) ?? [];
  // the same firm: same contact email; otherwise a leftover record with that name and town (its email may have been repaired)
  const same = candidates.find((c) => !c.used && norm(c.contact_email) === norm(f.contact_email)) ?? candidates.find((c) => !c.used);
  if (!same) { toInsert.push(f); continue; }
  same.used = true;
  if (badEmail(same.contact_email) || badSite(same.website)) toRepair.push([same, f]);
}

console.log("Live now:", {
  firms: await count("firms"), offers: await count("angebots"), invoices: await count("invoices"),
  history: await count("firm_status_history"), snapshots: await count("dashboard_daily_snapshot"),
});
console.log(`PDF data: ${firms.length} firms in ${[...new Set(firms.map((f) => f.country))].join(", ")}`);
console.log(`Plan: ${replace ? "WIPE and reload " : ""}add ${toInsert.length} missing firms, repair ${toRepair.length} earlier records, keep ${firms.length - toInsert.length - toRepair.length} as they are.`);
if (!apply) {
  console.log("\nDry run only. Re-run with --apply to do it.");
  process.exit(0);
}

// ------------------------------------------------------------------ --replace: backup, then wipe
if (replace) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = {};
  for (const t of ["firms", "angebots", "invoices", "firm_status_history", "dashboard_daily_snapshot", "city_completion"]) backup[t] = await readAll(`${t}?select=*`);
  mkdirSync(join(root, "supabase", "backups"), { recursive: true });
  const backupFile = join(root, "supabase", "backups", `before-pdf-import-${stamp}.json`);
  writeFileSync(backupFile, JSON.stringify(backup, null, 1));
  if (!existsSync(backupFile)) throw new Error("backup failed — stopping before deleting anything");
  console.log(`Backed up ${Object.values(backup).reduce((n, r) => n + r.length, 0)} rows -> ${backupFile}`);
  const ALL = "id=not.is.null";
  await rest("DELETE", `invoices?${ALL}`);
  await rest("DELETE", `angebots?${ALL}`);
  await rest("DELETE", `firms?${ALL}`); // cascades to firm_status_history
  await rest("DELETE", "dashboard_daily_snapshot?snapshot_date=not.is.null");
  console.log("Deleted old firms, offers, invoices, status history and snapshots.");
}

// ------------------------------------------------------------------ 1. add the missing firms
const inserted = [];
for (let i = 0; i < toInsert.length; i += 100) {
  const chunk = toInsert.slice(i, i + 100).map((f) => ({
    name: f.name, country: f.country, state: f.state, city: f.city, status: f.status,
    website: f.website, contact_email: f.contact_email, notes: f.notes,
    created_by: admin?.id ?? null, created_at: at(f.sent_on), updated_at: at(f.sent_on),
  }));
  const rows = await rest("POST", "firms", chunk, { Prefer: "return=representation" });
  rows.forEach((r, j) => inserted.push({ id: r.id, sent_on: toInsert[i + j].sent_on }));
}
console.log(`Added ${inserted.length} firms.`);

// the insert trigger logged each new firm's first status "now" — move it to the day the email really went out
for (const day of [...new Set(inserted.map((f) => f.sent_on))]) {
  const ids = inserted.filter((f) => f.sent_on === day).map((f) => f.id);
  for (let i = 0; i < ids.length; i += 60) {
    await rest("PATCH", `firm_status_history?firm_id=in.(${ids.slice(i, i + 60).join(",")})`, { changed_at: at(day) });
  }
}

// ------------------------------------------------------------------ 2. repair defective earlier records
for (const [row, f] of toRepair) {
  await rest("PATCH", `firms?id=eq.${row.id}`, { contact_email: f.contact_email, website: f.website, notes: f.notes });
}
console.log(`Repaired ${toRepair.length} earlier records.`);

// ------------------------------------------------------------------ 3. snapshots from the send dates (cumulative), then today's
const today = new Date().toISOString().slice(0, 10);
const firstDay = firms.map((f) => f.sent_on).filter(Boolean).sort()[0];
const snapshots = [];
for (let d = new Date(firstDay); d.toISOString().slice(0, 10) < today; d.setUTCDate(d.getUTCDate() + 1)) {
  const day = d.toISOString().slice(0, 10);
  const upTo = firms.filter((f) => f.sent_on && f.sent_on <= day);
  snapshots.push({
    snapshot_date: day,
    total_firms: upTo.length,
    sent_count: upTo.length, // a reply's date isn't in the list, so replies count as "sent" in the past
    responded_count: 0, negotiation_count: 0, client_count: 0, in_progress_count: 0, cities_completed: 0,
    cities_total: new Set(upTo.map((f) => `${f.country}|${f.state}|${f.city}`)).size,
  });
}
// upsert (never delete): rows for these days are replaced, others are left alone
for (let i = 0; i < snapshots.length; i += 200) {
  await rest("POST", "dashboard_daily_snapshot?on_conflict=snapshot_date", snapshots.slice(i, i + 200), { Prefer: "resolution=merge-duplicates" });
}
await rest("POST", "rpc/record_dashboard_snapshot", {});
console.log(`Rebuilt ${snapshots.length} daily snapshots (${firstDay} .. yesterday) and recorded today's.`);

// ------------------------------------------------------------------ 4. cities marked completed by hand (in progress is automatic)
const completed = resolveCompleted(JSON.parse(readFileSync(join(root, "supabase", "data", "completed-cities.json"), "utf8")), firms);
if (completed.unknown.length) console.warn("Not found among the imported firms, skipped:", JSON.stringify(completed.unknown));
if (completed.rows.length) {
  await rest(
    "POST",
    "city_completion?on_conflict=country,state,city",
    completed.rows.map((r) => ({ ...r, manual_status: "completed", updated_at: new Date().toISOString() })),
    { Prefer: "resolution=merge-duplicates" }
  );
}
console.log(`Marked ${completed.rows.length} cities as completed.`);

console.log("Live after:", {
  firms: await count("firms"), offers: await count("angebots"), invoices: await count("invoices"),
  history: await count("firm_status_history"), snapshots: await count("dashboard_daily_snapshot"),
});
