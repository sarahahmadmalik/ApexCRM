import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEST_PASSWORD, applyMigrations, asUser, createDb, prepareMigration, runAdminScript, withTestPassword } from "./harness.mjs";

const omerScript = readFileSync("supabase/scripts/create_user_omer.sql", "utf8");

async function setup() {
  const db = await createDb();
  await applyMigrations(db);
  await runAdminScript(db);
  await db.exec(prepareMigration(withTestPassword(omerScript)));
  const omer = (await db.query("select u.id, u.encrypted_password, a.* from auth.users u join app_users a on a.id = u.id where u.email = 'info@dua-dev.com'")).rows[0];
  return { db, omer };
}

test("creates Omer Farooq as CEO, a regular user, in the admin's workspace", async () => {
  const { db, omer } = await setup();
  const admin = (await db.query("select workspace_id from app_users where account_role = 'admin'")).rows[0];
  assert.equal(omer.full_name, "Omer Farooq");
  assert.equal(omer.role, "CEO");
  assert.equal(omer.account_role, "user");
  assert.equal(omer.is_active, true);
  assert.equal(omer.workspace_id, admin.workspace_id);
  assert.match(omer.encrypted_password, /^\$2[aby]\$/);
  await db.close();
});

test("the password is set from the script variable, and refuses to run with the placeholder", async () => {
  const { db, omer } = await setup();
  const ok = await db.query("select encrypted_password = extensions.crypt($2, encrypted_password) as ok from auth.users where id = $1", [omer.id, TEST_PASSWORD]);
  assert.equal(ok.rows[0].ok, true);
  const wrong = await db.query("select encrypted_password = extensions.crypt($2, encrypted_password) as ok from auth.users where id = $1", [omer.id, TEST_PASSWORD.toLowerCase()]);
  assert.equal(wrong.rows[0].ok, false);
  await db.close();

  // The committed script must never run with its placeholder password.
  const fresh = await createDb();
  await applyMigrations(fresh);
  await runAdminScript(fresh);
  await assert.rejects(fresh.exec(prepareMigration(omerScript)), /Set a strong password/);
  await fresh.close();
});

test("read & write on all seven pages, and nothing beyond them", async () => {
  const { db, omer } = await setup();
  const perms = (await db.query("select page, access from user_permissions where user_id = $1 order by page", [omer.id])).rows;
  assert.deepEqual(perms.map((p) => p.page), ["cities", "contracts", "dashboard", "employees", "firms", "invoices", "offers"]);
  assert.ok(perms.every((p) => p.access === "write"));
  await db.close();
});

test("he can work on data but is not an admin and cannot change roles or permissions", async () => {
  const { db, omer } = await setup();
  const ins = await asUser(db, omer.id, "insert into firms (name, country, state, city) values ('Omer Co','Germany','Bavaria','Munich')");
  assert.equal(ins.error, null);
  assert.equal((await asUser(db, omer.id, "select is_admin() as a")).rows[0].a, false);
  assert.ok((await asUser(db, omer.id, `update app_users set account_role = 'admin' where id = '${omer.id}'`)).error);
  assert.ok((await asUser(db, omer.id, `insert into user_permissions (user_id, page, access) values ('${omer.id}', 'firms', 'write')`)).error);
  await db.close();
});

test("running it again changes nothing and keeps the password", async () => {
  const { db, omer } = await setup();
  await db.query("delete from user_permissions where user_id = $1 and page = 'invoices'", [omer.id]);
  await db.exec(prepareMigration(withTestPassword(omerScript)));
  const after = (await db.query("select encrypted_password from auth.users where id = $1", [omer.id])).rows[0];
  assert.equal(after.encrypted_password, omer.encrypted_password);
  assert.equal((await db.query("select count(*)::int n from user_permissions where user_id = $1", [omer.id])).rows[0].n, 7, "permissions are restored");
  assert.equal((await db.query("select count(*)::int n from auth.users where email = 'info@dua-dev.com'")).rows[0].n, 1);
  await db.close();
});
