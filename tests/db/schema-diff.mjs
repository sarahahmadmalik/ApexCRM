// Compares three views of the database and prints what differs:
//   repo   = every migration in supabase/migrations applied to an in-memory Postgres
//   types  = what the app's TypeScript types (src/lib/types/database.ts) say the tables look like
//   live   = your real Supabase project (needs .env; run with `node --env-file=.env tests/db/schema-diff.mjs`)
//
// Usage: node --env-file=.env tests/db/schema-diff.mjs
import { readFileSync } from "node:fs";
import { applyMigrations, createDb } from "./harness.mjs";

const norm = (t) =>
  String(t)
    .replace(/^public\./, "")
    .replace("timestamp with time zone", "timestamptz")
    .replace("character varying", "text")
    .replace(/^int4$|^integer$/, "int")
    .replace(/^numeric.*$/, "numeric");

// --- repo (all migrations)
const db = await createDb();
await applyMigrations(db);
const cols = await db.query(`
  select c.table_name t, c.column_name col, c.udt_name type, c.is_nullable nullable, c.column_default def,
         (select string_agg(e.enumlabel, '|' order by e.enumsortorder) from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = c.udt_name) enum
    from information_schema.columns c
   where c.table_schema = 'public'`);
const repo = {};
for (const r of cols.rows) (repo[r.t] ??= {})[r.col] = { type: norm(r.type), nullable: r.nullable === "YES", enum: r.enum };

// --- types (regex over the Row blocks)
const src = readFileSync("src/lib/types/database.ts", "utf8").replace(/\r\n/g, "\n");
if (!src.includes("Row: {")) throw new Error("could not parse database.ts");
const types = {};
for (const m of src.matchAll(/^\s{6}(\w+): \{\n\s+Row: \{\n([\s\S]*?)\n\s+\};/gm)) {
  types[m[1]] = {};
  for (const line of m[2].split("\n")) {
    const c = line.match(/^\s+(\w+): (.+);$/);
    if (c) types[m[1]][c[1]] = c[2];
  }
}

// --- live
let live = null;
if (process.env.SUPABASE_SECRET_KEY) {
  const k = process.env.SUPABASE_SECRET_KEY;
  const o = await (await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/", { headers: { apikey: k, Authorization: "Bearer " + k } })).json();
  live = {};
  for (const [name, def] of Object.entries(o.definitions ?? {})) {
    live[name] = {};
    for (const [c, p] of Object.entries(def.properties)) live[name][c] = { type: norm(p.format || p.type), enum: p.enum?.join("|") };
  }
}

const tables = new Set([...Object.keys(repo), ...Object.keys(types), ...Object.keys(live ?? {})]);
let issues = 0;
const say = (s) => {
  issues++;
  console.log("  " + s);
};
for (const t of [...tables].sort()) {
  const inRepo = !!repo[t], inTypes = !!types[t], inLive = live ? !!live[t] : null;
  const header = [];
  if (inTypes && !inRepo) header.push("used by the app but NOT created by any migration");
  if (live && inRepo && !inLive) header.push("in migrations but MISSING from the live database");
  if (live && inLive && !inRepo) header.push("in the live database but not in any migration");
  console.log(`\n${t}${header.length ? "  <-- " + header.join("; ") : ""}`);
  if (!inRepo || !inTypes) continue;
  for (const c of Object.keys(types[t])) if (!repo[t][c]) say(`app expects column "${c}" but no migration creates it`);
  for (const c of Object.keys(repo[t])) if (!types[t][c]) say(`migrations create "${c}" but the app's types don't know it`);
  if (live && inLive) {
    for (const c of Object.keys(repo[t])) if (!live[t][c]) say(`live DB is missing column "${c}"`);
    for (const c of Object.keys(live[t])) if (!repo[t][c]) say(`live DB has extra column "${c}" (not in migrations)`);
    for (const c of Object.keys(repo[t])) {
      const l = live[t][c], r = repo[t][c];
      if (l && r.enum && l.enum && l.enum !== r.enum) say(`enum "${c}" differs — live: ${l.enum} | migrations: ${r.enum}`);
    }
  }
}
console.log(`\n${issues} difference(s) found`);
await db.close();
