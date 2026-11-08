import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_WORKSPACE, addAuthUser, applyMigrations, createDb, prepareMigration } from "./harness.mjs";

const SCHEMA = prepareMigration(readFileSync("supabase/schema.sql", "utf8"));
const runSchema = (db) => db.exec(SCHEMA);

// Everything about the database's structure, in a form that can be compared between two databases.
async function fingerprint(db) {
  const q = async (sql) => (await db.query(sql)).rows.map((r) => Object.values(r).join(" | "));
  return {
    columns: await q(`select table_name, column_name, udt_name, is_nullable, coalesce(column_default,''), coalesce(numeric_precision::text,''), coalesce(numeric_scale::text,'') from information_schema.columns where table_schema='public' order by 1,2`),
    enums: await q(`select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typnamespace='public'::regnamespace group by 1 order by 1`),
    policies: await q(`select tablename, policyname, cmd, coalesce(qual,''), coalesce(with_check,'') from pg_policies where schemaname in ('public','storage') order by 1,2`),
    functions: await q(`select p.proname, p.prosecdef::text, coalesce(array_to_string(p.proconfig, ','),''), md5(regexp_replace(p.prosrc, '\\s+', ' ', 'g')) from pg_proc p where p.pronamespace='public'::regnamespace order by 1`),
    views: await q(`select viewname, md5(regexp_replace(definition, '\\s+', ' ', 'g')) from pg_views where schemaname='public' order by 1`),
    constraints: await q(`select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace and contype <> 'n' and conname not like '%_not_null' order by 1,2`),
    indexes: await q(`select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2`),
    triggers: await q(`select event_object_table, trigger_name, action_timing, event_manipulation from information_schema.triggers where trigger_schema='public' order by 1,2,4`),
    rls: await q(`select relname, relrowsecurity::text from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1`),
    grants: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name in ('app_users','user_permissions','workspaces') order by 1,2,3`),
    columnGrants: await q(`select table_name, grantee, column_name, privilege_type from information_schema.column_privileges where table_schema='public' and grantee='authenticated' and privilege_type='UPDATE' and table_name='app_users' order by 1,3`),
    workspace: await q(`select id, name from workspaces order by 1`),
  };
}

async function referenceFingerprint() {
  const db = await createDb();
  await applyMigrations(db);
  const fp = await fingerprint(db);
  await db.close();
  return fp;
}

function assertSame(actual, expected, label) {
  for (const key of Object.keys(expected)) assert.deepEqual(actual[key], expected[key], `${label}: ${key} differ`);
}

const reference = await referenceFingerprint();

test("on a brand-new project it builds exactly what the migrations build", async () => {
  const db = await createDb();
  await runSchema(db);
  assertSame(await fingerprint(db), reference, "fresh");
  await db.close();
});

// The important one: whatever state the project is in, running the script must not error
// and must land on the same final structure.
for (let applied = 1; applied <= 9; applied++) {
  test(`on a database that already has migrations 0001–${String(applied).padStart(4, "0")}: no errors, ends up identical`, async () => {
    const db = await createDb();
    await applyMigrations(db, { upTo: applied });
    await runSchema(db);
    assertSame(await fingerprint(db), reference, `after 000${applied}`);
    await db.close();
  });
}

test("on an already up-to-date database it can be re-run any number of times", async () => {
  const db = await createDb();
  await applyMigrations(db);
  await runSchema(db);
  await runSchema(db);
  await runSchema(db);
  assertSame(await fingerprint(db), reference, "re-run");
  await db.close();
});

test("re-running never undoes changes made since: permissions, workspace name, data", async () => {
  const db = await createDb();
  await runSchema(db);

  const uid = "00000000-0000-0000-0000-0000000000b1";
  await addAuthUser(db, uid, "member@dua-dev.com");
  await db.query("insert into app_users (id, full_name, role) values ($1, 'Member', 'Designer')", [uid]);
  await db.query("insert into user_permissions (user_id, page, access) values ($1, 'firms', 'read')", [uid]);
  await db.query("update workspaces set name = 'Renamed Workspace' where id = $1", [DEFAULT_WORKSPACE]);
  await db.query("insert into firms (name, country, state, city, website) values ('Keep Me','Germany','Bavaria','Munich','https://keep.me')");

  await runSchema(db);

  const perms = await db.query("select page, access from user_permissions where user_id = $1", [uid]);
  assert.deepEqual(perms.rows, [{ page: "firms", access: "read" }], "admin's restriction must not be re-granted");
  assert.equal((await db.query("select name from workspaces where id = $1", [DEFAULT_WORKSPACE])).rows[0].name, "Renamed Workspace");
  assert.equal((await db.query("select website from firms where name = 'Keep Me'")).rows[0].website, "https://keep.me");
  await db.close();
});

test("upgrading your live database's state (0001–0003 with real-looking data) keeps and converts the data", async () => {
  const db = await createDb();
  await applyMigrations(db, { upTo: 3 });

  const uid = "00000000-0000-0000-0000-0000000000aa";
  await addAuthUser(db, uid, "old@dua-dev.com");
  await db.query("insert into app_users (id, full_name, role) values ($1, 'Sara Malik', 'cto')", [uid]);
  const firm = await db.query("insert into firms (name, country, state, city, status) values ('Old Firm','Germany','Bavaria','Munich','negotiation') returning id");
  const firmId = firm.rows[0].id;
  await db.query("insert into angebots (firm_id, status) values ($1, 'signed'), ($1, 'expired'), ($1, 'draft')", [firmId]);
  await db.query("insert into invoices (firm_id) values ($1)", [firmId]);
  await db.query("insert into employees (full_name, position) values ('Old Employee', 'Dev')");

  await runSchema(db);

  assert.deepEqual((await db.query("select status::text s from angebots order by s")).rows.map((r) => r.s), ["accepted", "draft", "rejected"]);
  assert.equal((await db.query("select status::text s from firms")).rows[0].s, "negotiation");
  const user = (await db.query("select role, account_role, is_active, workspace_id from app_users where id = $1", [uid])).rows[0];
  assert.deepEqual(user, { role: "cto", account_role: "user", is_active: true, workspace_id: DEFAULT_WORKSPACE });
  assert.equal((await db.query("select count(*)::int n from user_permissions where user_id = $1", [uid])).rows[0].n, 7, "keeps access to every page");
  assert.equal((await db.query("select employment_type::text t from employees")).rows[0].t, "full_time");
  assert.equal((await db.query("select count(*)::int n from invoices")).rows[0].n, 1);
  await db.query("update firms set website = 'https://example.com' where id = $1", [firmId]); // the Firms form works
  await db.close();
});

test("copes with a database you've hand-edited (some new columns already added, some not)", async () => {
  const db = await createDb();
  await applyMigrations(db, { upTo: 3 });
  // Personal changes made straight in the dashboard, half-way to the current schema:
  await db.exec(`
    alter table firms add column website text;
    alter table employees add column salary_amount numeric(12,2), add column salary_period text;
    alter table app_users add column theme_preference text;
  `);
  await runSchema(db);
  const fp = await fingerprint(db);
  assert.deepEqual(fp.columns, reference.columns, "columns converge to the reference set");
  assert.deepEqual(fp.constraints, reference.constraints);
  await db.close();
});

test("the app's TypeScript types match the database, column for column", async () => {
  const db = await createDb();
  await runSchema(db);
  const cols = await db.query(`select table_name t, column_name c from information_schema.columns where table_schema='public'`);
  const actual = {};
  for (const r of cols.rows) (actual[r.t] ??= new Set()).add(r.c);

  const src = readFileSync("src/lib/types/database.ts", "utf8").replace(/\r\n/g, "\n");
  const declared = {};
  for (const m of src.matchAll(/^\s{6}(\w+): \{\n\s+Row: \{\n([\s\S]*?)\n\s+\};/gm)) {
    declared[m[1]] = new Set([...m[2].matchAll(/^\s+(\w+): /gm)].map((x) => x[1]));
  }
  assert.ok(Object.keys(declared).length >= 10, "failed to parse types");

  for (const [table, set] of Object.entries(declared)) {
    assert.ok(actual[table], `types describe "${table}" but the database has no such table`);
    for (const c of set) assert.ok(actual[table].has(c), `${table}.${c} is used by the app but missing from the database`);
    for (const c of actual[table]) assert.ok(set.has(c), `${table}.${c} exists in the database but not in the app's types`);
  }
  await db.close();
});
