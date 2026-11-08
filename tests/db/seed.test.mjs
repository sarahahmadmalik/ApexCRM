import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMigrations, createDb, prepareMigration } from "./harness.mjs";

const seed = readFileSync("supabase/seed.sql", "utf8");
const firms = JSON.parse(readFileSync("supabase/data/firms-import.json", "utf8"));
// What was read straight out of the two PDFs (see scripts/extract-*.py).
const register = JSON.parse(readFileSync("supabase/data/lead-register.json", "utf8"));
const list = JSON.parse(readFileSync("supabase/data/firm-contact-list.json", "utf8"));
const extracted = [...register, ...list];

async function seededDb() {
  const db = await createDb();
  await applyMigrations(db);
  await db.exec("set search_path to public, extensions");
  await db.exec(prepareMigration(seed));
  return db;
}

const days = [...new Set(firms.map((f) => f.sent_on))].sort();

test("seed.sql creates the admin and loads every firm from both PDFs", async () => {
  const db = await seededDb();
  const admin = (await db.query("select a.role, a.account_role from app_users a join auth.users u on u.id = a.id where u.email = 'saramalik@dua-dev.com'")).rows[0];
  assert.deepEqual(admin, { role: "CTO", account_role: "admin" });

  assert.equal((await db.query("select count(*)::int n from firms")).rows[0].n, firms.length);
  const byStatus = Object.fromEntries((await db.query("select status::text s, count(*)::int n from firms group by 1")).rows.map((r) => [r.s, r.n]));
  for (const status of ["sent", "responded", "negotiation"]) {
    assert.equal(byStatus[status] ?? 0, firms.filter((f) => f.status === status).length, status);
  }
  const countries = new Set(firms.map((f) => f.country));
  assert.equal((await db.query("select count(distinct country)::int n from firms")).rows[0].n, countries.size);
  assert.deepEqual([...countries].sort(), ["Austria", "Belgium", "Finland", "Germany", "Netherlands", "Sweden"]);
  assert.ok(firms.length > 1700, "both PDFs are in (1,394 + 425)");
  await db.close();
});

test("firms are dated by the day their email was sent, and so is their status history", async () => {
  const db = await seededDb();
  const seededDays = (await db.query("select created_at::date::text d from firms group by 1 order by 1")).rows.map((r) => r.d);
  assert.deepEqual(seededDays, days);
  assert.equal(days[0], "2026-08-07", "the register starts on 7 Aug 2026");
  assert.equal(days.at(-1), "2026-09-16");
  const wrong = (await db.query("select count(*)::int n from firm_status_history h join firms f on f.id = h.firm_id where h.changed_at::date <> f.created_at::date")).rows[0].n;
  assert.equal(wrong, 0);
  await db.close();
});

test("snapshots are built from real send dates (no invented history)", async () => {
  const db = await seededDb();
  const rows = (await db.query("select snapshot_date::text d, total_firms from dashboard_daily_snapshot order by 1")).rows;
  assert.equal(rows[0].d, days[0]);
  assert.equal(rows[0].total_firms, firms.filter((f) => f.sent_on === days[0]).length);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].total_firms >= rows[i - 1].total_firms, "the total never goes down");
  assert.equal(rows.at(-1).total_firms, firms.length, "the latest snapshot equals the live firm count");
  await db.close();
});

test("seed.sql can be run again without duplicating anything", async () => {
  const db = await seededDb();
  await db.exec(prepareMigration(seed));
  assert.equal((await db.query("select count(*)::int n from firms")).rows[0].n, firms.length);
  assert.equal((await db.query("select count(*)::int n from app_users")).rows[0].n, 1);
  await db.close();
});

test("every imported firm uses a state and city the app knows about", () => {
  const all = ["geo.ts", "geo-generated.ts", "geo-custom.ts"].map((f) => readFileSync(`src/lib/data/${f}`, "utf8")).join("\n");
  for (const f of firms) {
    assert.ok(all.includes(`"${f.city}"`), `city ${f.city} is not in the city list`);
    assert.ok(all.includes(`"${f.state}"`), `region ${f.state} is not in the city list`);
  }
});

// ---- The seed against the PDF extractions --------------------------------------------------------------

test("every email address in either PDF ends up in the seed (none lost, none glued together)", () => {
  const inSeed = new Set(
    firms
      .flatMap((f) => [f.contact_email, ...((f.notes ?? "").match(/More contacts: (.*)/)?.[1].split(", ") ?? [])])
      .filter(Boolean)
      .map((e) => e.toLowerCase())
  );
  for (const row of extracted) {
    for (const email of row.emails) {
      assert.equal(email.split("@").length, 2, `S.No ${row.sno}: "${email}" is more than one address`);
      if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(email)) continue; // an address the PDF itself cut off is reported by the importer
      assert.ok(inSeed.has(email.toLowerCase()), `S.No ${row.sno} (${row.company}): ${email} is missing from the seed`);
    }
  }
  for (const f of firms) if (f.contact_email) assert.equal(f.contact_email.split("@").length, 2, `${f.name}: bad email ${f.contact_email}`);
});

test("only genuine repeats are left out: the same company, town and contact listed twice", () => {
  const key = (name, city, email) => `${name}|${city}|${email ?? ""}`.toLowerCase();
  const seeded = new Set(firms.map((f) => key(f.name, f.city, f.contact_email)));
  // Firms listed under the same email in the same town count as one.
  const seededEmailTown = new Set(firms.filter((f) => f.contact_email).map((f) => `${f.contact_email}|${f.city}`.toLowerCase()));
  const skipped = extracted.length - firms.length;
  assert.equal(skipped, 4, "4 rows are exact repeats of another row (S.No 115, 492, 829, 1300 of the register)");
  assert.ok(seeded.size === firms.length);
  assert.ok(seededEmailTown.size <= firms.length);
});

test("websites are clean: no tracking parameters, no map links", () => {
  for (const f of firms) {
    if (!f.website) continue;
    assert.doesNotMatch(f.website, /utm|chatgpt|google\.com\/maps/i, `${f.name}: ${f.website}`);
    assert.match(f.website, /^https?:\/\/[^\s]+\.[a-z]{2,}/i, `${f.name}: ${f.website}`);
  }
});

test("firms with several contacts keep them all in the notes", () => {
  const multi = extracted.filter((r) => r.emails.length > 1 && r.emails.every((e) => /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(e)));
  assert.ok(multi.length >= 30);
  for (const row of multi) {
    const firm = firms.find((f) => f.contact_email?.toLowerCase() === row.emails[0].toLowerCase());
    assert.ok(firm, `S.No ${row.sno}: no firm with ${row.emails[0]}`);
    for (const e of row.emails.slice(1)) assert.ok(firm.notes.includes(e), `S.No ${row.sno}: ${e} missing from the notes of ${firm.name}`);
  }
});

test("replies and offers noted in the register set the firm's status", () => {
  const status = (email) => firms.find((f) => f.contact_email === email)?.status;
  assert.equal(firms.filter((f) => f.status === "negotiation").length, 2, "the two firms that were sent an offer");
  assert.ok(firms.filter((f) => f.status === "responded").length >= 8, "'no interest' style replies");
  assert.ok(status !== undefined);
  for (const f of firms.filter((f) => f.status !== "sent")) assert.ok(/offer|interest|kein|intress|not now|dont|don't|need services/i.test(f.notes ?? ""), `${f.name} has status ${f.status} without a remark`);
});

test("with the PDF data, the cities that were emailed are automatically 'in progress' (nothing is 'completed' by itself)", async () => {
  const db = await seededDb();
  const wanted = new Set(firms.map((f) => `${f.country}|${f.state}|${f.city}`));
  const rows = (await db.query("select country, state, city, status::text s, firm_count::int n from city_status")).rows;
  assert.equal(rows.length, wanted.size);
  assert.ok(rows.every((r) => r.s === "in_progress"), "every emailed city is in progress");
  assert.equal(rows.filter((r) => r.s === "completed").length, 0, "completed is only ever set by a person");
  assert.equal(rows.reduce((sum, r) => sum + r.n, 0), firms.length);
  await db.close();
});

// ---- Completed cities ---------------------------------------------------------------------------------
import { completedCitiesSql, resolveCompleted } from "../../scripts/lib/completed-sql.mjs";

test("cities listed as completed become 'completed', the rest stay 'in progress'", async () => {
  const db = await seededDb();
  const pick = [firms[0], firms.find((f) => f.country === "Finland"), firms.find((f) => f.country === "Austria")];
  const { rows, unknown } = resolveCompleted(
    [...pick.map((f) => ({ country: f.country, city: f.city })), { country: "Germany", city: "Atlantis" }],
    firms
  );
  assert.equal(rows.length, 3);
  assert.equal(unknown.length, 1, "a city that isn't among the firms is reported, not silently added");
  await db.exec(completedCitiesSql(rows));
  await db.exec(completedCitiesSql(rows)); // re-running is harmless

  const status = Object.fromEntries((await db.query("select city, status::text s from city_status")).rows.map((r) => [r.city, r.s]));
  for (const f of pick) assert.equal(status[f.city], "completed", f.city);
  const completedNow = Object.values(status).filter((s) => s === "completed").length;
  assert.equal(completedNow, 3);
  assert.equal(Object.values(status).filter((s) => s === "in_progress").length, Object.keys(status).length - 3);
  await db.close();
});

test("with nothing listed, no city is completed", () => {
  assert.match(completedCitiesSql([]), /no cities are marked completed yet/);
});
