// End-to-end permission check against your REAL Supabase project.
//
//   1. Run supabase/migrations/0009_workspaces_permissions.sql
//   2. Run supabase/scripts/create_admin_saramalik.sql
//   3. npm run test:live
//
// It creates throwaway users (test-*@example.test), signs in as each of them with the
// public (publishable) key exactly like the browser does, checks what Row Level Security
// lets them do, then deletes everything it created — even if an assertion fails.
// It never touches your real users or data.

import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY (run via `npm run test:live`).");
  process.exit(2);
}

const opts = { auth: { autoRefreshToken: false, persistSession: false } };
const service = createClient(url, secret, opts);
const run = randomBytes(4).toString("hex");
const password = `Tmp-${randomBytes(9).toString("base64url")}9`;

const created = { users: [], firms: [] };
let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✖ ${name}\n      ${err.message}`);
  }
}

async function makeMember(label, { isActive = true, permissions = [] } = {}, workspaceId) {
  const email = `test-${run}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  created.users.push(id);

  const row = await service
    .from("app_users")
    .insert({ id, full_name: `Test ${label}`, role: `Tester ${label}`, workspace_id: workspaceId, account_role: "user", is_active: isActive });
  if (row.error) throw new Error(`app_users ${label}: ${row.error.message}`);
  if (permissions.length) {
    const perms = await service.from("user_permissions").insert(permissions.map(([page, access]) => ({ user_id: id, page, access })));
    if (perms.error) throw new Error(`permissions ${label}: ${perms.error.message}`);
  }
  return { id, email };
}

async function signIn({ email }) {
  const client = createClient(url, publishable, opts);
  const { error } = await client.auth.signInWithPassword({ email, password });
  return { client, error };
}

try {
  console.log("Live permission tests");

  // Preconditions
  const ws = await service.from("workspaces").select("id, name").limit(1);
  if (ws.error && /invalid api key/i.test(ws.error.message)) {
    console.error(
      "\nSUPABASE_SECRET_KEY in .env was rejected by Supabase (Invalid API key).\nCopy the secret key from Project Settings -> API Keys, put it in .env, and run again."
    );
    process.exit(2);
  }
  if (ws.error) {
    console.error(`\nMigration 0009 doesn't look applied yet (${ws.error.message}).\nRun supabase/migrations/0009_workspaces_permissions.sql in the SQL editor first.`);
    process.exit(2);
  }
  const workspaceId = ws.data[0].id;

  await check("the admin account exists with company role CTO", async () => {
    const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    const admin = users.users.find((u) => u.email?.toLowerCase() === "saramalik@dua-dev.com");
    assert.ok(admin, "saramalik@dua-dev.com not found — run supabase/scripts/create_admin_saramalik.sql");
    const { data } = await service.from("app_users").select("role, account_role, is_active").eq("id", admin.id).single();
    assert.equal(data.account_role, "admin");
    assert.equal(data.role, "CTO");
    assert.equal(data.is_active, true);
  });

  // Fixtures
  const firm = await service
    .from("firms")
    .insert({ name: `ZZ Test Firm ${run}`, country: "Germany", state: "Bavaria", city: "Munich" })
    .select("id")
    .single();
  assert.ifError(firm.error);
  created.firms.push(firm.data.id);

  const reader = await makeMember("reader", { permissions: [["firms", "read"]] }, workspaceId);
  const writer = await makeMember("writer", { permissions: [["firms", "write"]] }, workspaceId);
  const nobody = await makeMember("nobody", {}, workspaceId);
  const disabled = await makeMember("disabled", { isActive: false, permissions: [["firms", "write"]] }, workspaceId);

  const r = await signIn(reader);
  const w = await signIn(writer);
  const n = await signIn(nobody);

  await check("members can sign in with the admin-created password", () => {
    assert.ifError(r.error);
    assert.ifError(w.error);
    assert.ifError(n.error);
  });

  await check("read-only member can read firms", async () => {
    const { data, error } = await r.client.from("firms").select("id").eq("id", firm.data.id);
    assert.ifError(error);
    assert.equal(data.length, 1);
  });

  await check("read-only member cannot create, edit or delete firms", async () => {
    const ins = await r.client.from("firms").insert({ name: `ZZ blocked ${run}`, country: "Germany", state: "Bavaria", city: "Munich" });
    assert.ok(ins.error, "insert should be blocked");
    const upd = await r.client.from("firms").update({ notes: "hacked" }).eq("id", firm.data.id).select();
    assert.equal(upd.data?.length ?? 0, 0, "update should touch nothing");
    const del = await r.client.from("firms").delete().eq("id", firm.data.id).select();
    assert.equal(del.data?.length ?? 0, 0, "delete should touch nothing");
    const { data } = await service.from("firms").select("notes").eq("id", firm.data.id).single();
    assert.equal(data.notes, null);
  });

  await check("read-only member cannot see pages they weren't given", async () => {
    for (const table of ["employees", "contracts", "angebots", "invoices"]) {
      const { data } = await r.client.from(table).select("id");
      assert.equal(data?.length ?? 0, 0, `${table} leaked`);
    }
  });

  await check("read & write member can edit firms", async () => {
    const upd = await w.client.from("firms").update({ notes: "edited by writer" }).eq("id", firm.data.id).select();
    assert.ifError(upd.error);
    assert.equal(upd.data.length, 1);
  });

  await check("member with no permissions sees nothing", async () => {
    const { data } = await n.client.from("firms").select("id");
    assert.equal(data?.length ?? 0, 0);
  });

  await check("a member cannot promote themselves to admin or change their company role", async () => {
    for (const patch of [{ account_role: "admin" }, { role: "CEO" }, { is_active: true }, { workspace_id: workspaceId }]) {
      const res = await r.client.from("app_users").update(patch).eq("id", reader.id).select();
      assert.ok(res.error || (res.data?.length ?? 0) === 0, `update ${JSON.stringify(patch)} must be blocked`);
    }
    const { data } = await service.from("app_users").select("account_role, role").eq("id", reader.id).single();
    assert.equal(data.account_role, "user");
    assert.equal(data.role, "Tester reader");
  });

  await check("a member cannot grant themselves permissions", async () => {
    const res = await r.client.from("user_permissions").insert({ user_id: reader.id, page: "invoices", access: "write" });
    assert.ok(res.error, "insert should be blocked");
    const { data } = await service.from("user_permissions").select("page").eq("user_id", reader.id);
    assert.deepEqual(data.map((p) => p.page), ["firms"]);
  });

  await check("a member can only read their own permission rows", async () => {
    const { data } = await r.client.from("user_permissions").select("user_id");
    assert.ok(data.every((row) => row.user_id === reader.id));
  });

  await check("a member can still change their own theme", async () => {
    const res = await r.client.from("app_users").update({ theme_preference: "dark" }).eq("id", reader.id).select();
    assert.ifError(res.error);
    assert.equal(res.data.length, 1);
  });

  await check("a deactivated member loses access to data immediately", async () => {
    const d = await signIn(disabled); // still able to sign in until banned by the app...
    if (d.error) return; // ...or already blocked at login, which is fine too
    const { data } = await d.client.from("firms").select("id");
    assert.equal(data?.length ?? 0, 0);
  });

  await check("deactivating via the Auth API bans the login", async () => {
    const res = await service.auth.admin.updateUserById(disabled.id, { ban_duration: "876000h" });
    assert.ifError(res.error);
    const d = await signIn(disabled);
    assert.ok(d.error, "banned account must not be able to sign in");
  });

  await check("deleting a member removes their profile and permissions but keeps records", async () => {
    const { error } = await service.auth.admin.deleteUser(writer.id);
    assert.ifError(error);
    created.users = created.users.filter((id) => id !== writer.id);
    const profile = await service.from("app_users").select("id").eq("id", writer.id);
    assert.equal(profile.data.length, 0);
    const perms = await service.from("user_permissions").select("page").eq("user_id", writer.id);
    assert.equal(perms.data.length, 0);
    const stillThere = await service.from("firms").select("id").eq("id", firm.data.id);
    assert.equal(stillThere.data.length, 1);
  });
} finally {
  // Always clean up, pass or fail.
  for (const id of created.firms) await service.from("firms").delete().eq("id", id);
  for (const id of created.users) await service.auth.admin.deleteUser(id);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
