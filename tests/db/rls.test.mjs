import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WORKSPACE, addAuthUser, applyMigrations, asUser, createDb, runAdminScript } from "./harness.mjs";

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const LEGACY = id(1); // existed before migration 0009 (old ceo/cto row)
const READER = id(2); // firms: read
const WRITER = id(3); // firms: write, offers: write
const NOBODY = id(4); // active, no permissions
const OFFERS_ONLY = id(5); // offers: read
const DISABLED = id(6); // was given access, then deactivated
const CITIES_WRITER = id(7); // cities: write only
const FIRM_1 = id(101);
const FIRM_2 = id(102);
const EMPLOYEE = id(201);
const OFFER = id(301);

let db;
let adminId;

const denied = (res, pattern = /./) => {
  assert.ok(res.error, "expected an error but the statement succeeded");
  assert.match(res.error.message, pattern);
};

before(async () => {
  db = await createDb();

  // Everything up to 0008 = the database as it is today, with one legacy user.
  await applyMigrations(db, { upTo: 8 });
  await addAuthUser(db, LEGACY, "legacy@dua-dev.com");
  await db.query("insert into app_users (id, full_name, role) values ($1, 'Legacy CEO', 'ceo')", [LEGACY]);
  await db.query(
    `insert into firms (id, name, country, state, city, status, created_by) values
       ($1, 'Acme GmbH', 'Germany', 'Bavaria', 'Munich', 'negotiation', $3),
       ($2, 'Beta AG', 'Germany', 'Berlin', 'Berlin', 'not_started', null)`,
    [FIRM_1, FIRM_2, LEGACY]
  );
  await db.query("insert into employees (id, full_name) values ($1, 'Erin Employee')", [EMPLOYEE]);
  await db.query("insert into angebots (id, firm_id, status) values ($1, $2, 'sent')", [OFFER, FIRM_1]);

  // ...then the new migration and the admin script.
  await applyMigrations(db, { from: 9 });

  // Members, as the admin server actions would create them.
  const members = [
    [READER, "reader@dua-dev.com", "Reader", "Analyst", [["firms", "read"]]],
    [WRITER, "writer@dua-dev.com", "Writer", "Sales Lead", [["firms", "write"], ["offers", "write"]]],
    [NOBODY, "nobody@dua-dev.com", "Nobody", "Intern", []],
    [OFFERS_ONLY, "offers@dua-dev.com", "Offers Only", "Bookkeeper", [["offers", "read"]]],
    [DISABLED, "disabled@dua-dev.com", "Disabled", "Former Employee", [["firms", "write"]]],
    [CITIES_WRITER, "cities@dua-dev.com", "Cities Writer", "Researcher", [["cities", "write"]]],
  ];
  for (const [uid, email, name, role, perms] of members) {
    await addAuthUser(db, uid, email);
    await db.query(
      "insert into app_users (id, full_name, role, workspace_id, account_role, is_active) values ($1,$2,$3,$4,'user',$5)",
      [uid, name, role, DEFAULT_WORKSPACE, uid !== DISABLED]
    );
    for (const [page, access] of perms) {
      await db.query("insert into user_permissions (user_id, page, access) values ($1,$2,$3)", [uid, page, access]);
    }
  }
});

after(async () => {
  await db?.close();
});

describe("migration 0009 on an existing database", () => {
  test("existing users keep full access (no lock-out)", async () => {
    const { rows } = await db.query("select workspace_id, account_role, is_active from app_users where id = $1", [LEGACY]);
    assert.equal(rows[0].workspace_id, DEFAULT_WORKSPACE);
    assert.equal(rows[0].account_role, "user");
    assert.equal(rows[0].is_active, true);
    const perms = await db.query("select page, access from user_permissions where user_id = $1 order by page", [LEGACY]);
    assert.equal(perms.rows.length, 7);
    assert.ok(perms.rows.every((r) => r.access === "write"));
  });

  test("the default workspace exists", async () => {
    const { rows } = await db.query("select name from workspaces where id = $1", [DEFAULT_WORKSPACE]);
    assert.equal(rows[0]?.name, "Dua Dev");
  });

  test("company role is free text now (was limited to ceo/cto)", async () => {
    const ok = await db.query("select role from app_users where id = $1", [WRITER]);
    assert.equal(ok.rows[0].role, "Sales Lead");
    await assert.rejects(
      db.query("update app_users set role = '   ' where id = $1", [WRITER]),
      /app_users_role_check/,
      "blank role must be rejected"
    );
  });

  test("user_permissions only accepts real pages, never 'admin'", async () => {
    await assert.rejects(
      db.query("insert into user_permissions (user_id, page, access) values ($1, 'admin', 'write')", [READER]),
      /check constraint/
    );
    await assert.rejects(
      db.query("insert into user_permissions (user_id, page, access) values ($1, 'firms', 'owner')", [NOBODY]),
      /check constraint/
    );
  });
});

describe("create_admin_saramalik.sql", () => {
  test("creates the login and makes it admin with company role CTO", async () => {
    await runAdminScript(db);
    const { rows } = await db.query(
      `select u.id, u.encrypted_password, a.role, a.account_role, a.is_active, a.workspace_id, w.name as workspace
         from auth.users u join app_users a on a.id = u.id join workspaces w on w.id = a.workspace_id
        where u.email = 'saramalik@dua-dev.com'`
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].role, "CTO");
    assert.equal(rows[0].account_role, "admin");
    assert.equal(rows[0].is_active, true);
    assert.equal(rows[0].workspace, "Dua Dev");
    assert.match(rows[0].encrypted_password, /^\$2[aby]\$/, "password stored as a bcrypt hash");
    adminId = rows[0].id;

    const identity = await db.query("select provider from auth.identities where user_id = $1", [adminId]);
    assert.equal(identity.rows[0].provider, "email");
    const perms = await db.query("select 1 from user_permissions where user_id = $1", [adminId]);
    assert.equal(perms.rows.length, 0, "admins get access implicitly, no per-page rows");
  });

  test("is idempotent and never changes an existing password", async () => {
    const before = await db.query("select encrypted_password from auth.users where id = $1", [adminId]);
    await db.query("update app_users set role = 'Something else' where id = $1", [adminId]);
    await runAdminScript(db);
    const after = await db.query(
      "select u.encrypted_password, a.role, a.account_role from auth.users u join app_users a on a.id = u.id where u.id = $1",
      [adminId]
    );
    assert.equal(after.rows[0].encrypted_password, before.rows[0].encrypted_password);
    assert.equal(after.rows[0].role, "CTO", "re-running restores the company role");
    assert.equal(after.rows[0].account_role, "admin");
    const count = await db.query("select count(*)::int as n from auth.users where email = 'saramalik@dua-dev.com'");
    assert.equal(count.rows[0].n, 1);
  });

  test("only one admin per workspace", async () => {
    await assert.rejects(
      db.query("update app_users set account_role = 'admin' where id = $1", [READER]),
      /app_users_one_admin_per_workspace/
    );
  });
});

describe("admin", () => {
  test("can read and write every page's data", async () => {
    assert.equal((await asUser(db, adminId, "select id from firms")).rows.length, 2);
    assert.equal((await asUser(db, adminId, "select id from employees")).rows.length, 1);
    assert.equal((await asUser(db, adminId, "select id from angebots")).rows.length, 1);
    const ins = await asUser(db, adminId, "insert into firms (name, country, state, city) values ('New Co','Germany','Bavaria','Munich')");
    assert.equal(ins.error, null);
    const upd = await asUser(db, adminId, "update firms set notes = 'x' where id = '" + FIRM_2 + "'");
    assert.equal(upd.rowCount, 1);
  });

  test("sees every member's permissions", async () => {
    const { rows } = await asUser(db, adminId, "select distinct user_id from user_permissions");
    assert.ok(rows.length >= 5);
  });

  test("is_admin() and has_page_access() are true", async () => {
    const { rows } = await asUser(db, adminId, "select is_admin() as a, has_page_access('invoices','write') as w");
    assert.deepEqual(rows[0], { a: true, w: true });
  });
});

describe("read-only member (firms: read)", () => {
  test("can read firms", async () => {
    assert.equal((await asUser(db, READER, "select id from firms")).rows.length, 2);
  });

  test("cannot insert, update or delete firms", async () => {
    denied(await asUser(db, READER, "insert into firms (name, country, state, city) values ('X','Germany','Bavaria','Munich')"), /row-level security/);
    assert.equal((await asUser(db, READER, `update firms set name = 'Hacked' where id = '${FIRM_1}'`)).rowCount, 0);
    assert.equal((await asUser(db, READER, `delete from firms where id = '${FIRM_1}'`)).rowCount, 0);
    const still = await db.query("select name from firms where id = $1", [FIRM_1]);
    assert.equal(still.rows[0].name, "Acme GmbH");
  });

  test("cannot see pages they weren't given", async () => {
    for (const table of ["employees", "contracts", "angebots", "invoices", "city_completion", "counters"]) {
      assert.equal((await asUser(db, READER, `select * from ${table}`)).rows.length, 0, table);
    }
  });
});

describe("read & write member (firms + offers)", () => {
  test("can write firms", async () => {
    const res = await asUser(db, WRITER, `update firms set notes = 'ok' where id = '${FIRM_2}'`);
    assert.equal(res.rowCount, 1);
  });

  test("can create offers but not touch employees", async () => {
    const ins = await asUser(db, WRITER, `insert into angebots (firm_id) values ('${FIRM_1}')`);
    assert.equal(ins.error, null);
    denied(await asUser(db, WRITER, "insert into employees (full_name) values ('Nope')"), /row-level security/);
    assert.equal((await asUser(db, WRITER, "select * from employees")).rows.length, 0);
  });

  test("accepting an offer still promotes the firm even without firms write access", async () => {
    // OFFERS_ONLY variant: give write on offers only, then accept.
    await db.query("insert into user_permissions (user_id, page, access) values ($1, 'offers', 'write') on conflict (user_id, page) do update set access = 'write'", [OFFERS_ONLY]);
    await db.exec("begin");
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${OFFERS_ONLY}', true);`);
    await db.query(`update angebots set status = 'accepted' where id = '${OFFER}'`);
    const firm = await db.query(`select status from firms where id = '${FIRM_1}'`);
    await db.exec("rollback");
    assert.equal(firm.rows[0].status, "client", "security-definer trigger promotes the firm");
    await db.query("update user_permissions set access = 'read' where user_id = $1 and page = 'offers'", [OFFERS_ONLY]);
  });
});

describe("member with a single page", () => {
  test("offers-only member can read offers and the firms they reference, not employees", async () => {
    assert.equal((await asUser(db, OFFERS_ONLY, "select id from angebots")).rows.length, 1);
    assert.ok((await asUser(db, OFFERS_ONLY, "select id from firms")).rows.length > 0);
    assert.equal((await asUser(db, OFFERS_ONLY, "select id from employees")).rows.length, 0);
    denied(await asUser(db, OFFERS_ONLY, `insert into angebots (firm_id) values ('${FIRM_1}')`), /row-level security/);
  });

  test("cities-only writer can write city overrides but cannot edit firms", async () => {
    const ok = await asUser(db, CITIES_WRITER, "insert into city_completion (country, state, city, manual_status) values ('Germany','Bavaria','Munich','completed')");
    assert.equal(ok.error, null);
    denied(await asUser(db, CITIES_WRITER, "insert into firms (name, country, state, city) values ('X','Germany','Bavaria','Munich')"), /row-level security/);
  });

  test("member with no permissions sees nothing", async () => {
    for (const table of ["firms", "employees", "contracts", "angebots", "invoices", "city_completion"]) {
      assert.equal((await asUser(db, NOBODY, `select * from ${table}`)).rows.length, 0, table);
    }
    const r = await asUser(db, NOBODY, "select is_app_user() as active, is_admin() as admin, has_page_access('firms') as firms");
    assert.deepEqual(r.rows[0], { active: true, admin: false, firms: false });
  });
});

describe("deactivated member", () => {
  test("loses all access immediately, even with permission rows still present", async () => {
    assert.equal((await asUser(db, DISABLED, "select id from firms")).rows.length, 0);
    denied(await asUser(db, DISABLED, "insert into firms (name, country, state, city) values ('X','Germany','Bavaria','Munich')"), /row-level security/);
    const r = await asUser(db, DISABLED, "select is_app_user() as a, has_page_access('firms','write') as w");
    assert.deepEqual(r.rows[0], { a: false, w: false });
  });
});

describe("privilege escalation attempts", () => {
  test("a member cannot make themselves admin or change their company role", async () => {
    denied(await asUser(db, READER, `update app_users set account_role = 'admin' where id = '${READER}'`), /permission denied/);
    denied(await asUser(db, READER, `update app_users set role = 'CEO' where id = '${READER}'`), /permission denied/);
    denied(await asUser(db, READER, `update app_users set is_active = true, workspace_id = '${DEFAULT_WORKSPACE}' where id = '${READER}'`), /permission denied/);
  });

  test("a member can still change their own theme, but not someone else's", async () => {
    const own = await asUser(db, READER, `update app_users set theme_preference = 'dark' where id = '${READER}'`);
    assert.equal(own.rowCount, 1);
    const other = await asUser(db, READER, `update app_users set theme_preference = 'dark' where id = '${WRITER}'`);
    assert.equal(other.rowCount, 0);
  });

  test("a member cannot grant themselves or others permissions", async () => {
    denied(await asUser(db, READER, `insert into user_permissions (user_id, page, access) values ('${READER}', 'invoices', 'write')`), /permission denied/);
    denied(await asUser(db, READER, `update user_permissions set access = 'write' where user_id = '${READER}'`), /permission denied/);
    denied(await asUser(db, READER, `delete from user_permissions where user_id = '${WRITER}'`), /permission denied/);
  });

  test("a member cannot create, edit or delete app_users / workspaces", async () => {
    denied(await asUser(db, READER, `insert into app_users (id, full_name, role, workspace_id) values ('${id(99)}','Ghost','CEO','${DEFAULT_WORKSPACE}')`), /permission denied/);
    denied(await asUser(db, READER, `delete from app_users where id = '${WRITER}'`), /permission denied/);
    denied(await asUser(db, READER, "update workspaces set name = 'Pwned'"), /permission denied/);
    denied(await asUser(db, READER, "insert into workspaces (name) values ('Second')"), /permission denied/);
  });

  test("members only see their own permission rows; the admin sees all", async () => {
    const mine = await asUser(db, WRITER, "select distinct user_id from user_permissions");
    assert.deepEqual(mine.rows.map((r) => r.user_id), [WRITER]);
  });

  test("members can read their own workspace, anonymous cannot", async () => {
    const own = await asUser(db, READER, "select name from workspaces");
    assert.equal(own.rows[0]?.name, "Dua Dev");
    const anon = await asUser(db, null, "select * from workspaces");
    assert.ok(anon.error || anon.rows.length === 0, "workspaces must not leak to anon");
  });

  test("anonymous users get nothing", async () => {
    for (const table of ["firms", "app_users", "user_permissions", "employees", "angebots"]) {
      const res = await asUser(db, null, `select * from ${table}`);
      assert.ok(res.error || res.rows.length === 0, `${table} must not leak to anon`);
    }
  });
});

describe("deleting a member", () => {
  test("keeps the records they created (created_by becomes null)", async () => {
    assert.equal((await db.query("select created_by from firms where id = $1", [FIRM_1])).rows[0].created_by, LEGACY);
    await db.query("delete from auth.users where id = $1", [LEGACY]); // cascades to app_users, user_permissions
    const firm = await db.query("select name, created_by from firms where id = $1", [FIRM_1]);
    assert.equal(firm.rows[0].name, "Acme GmbH");
    assert.equal(firm.rows[0].created_by, null);
    assert.equal((await db.query("select 1 from app_users where id = $1", [LEGACY])).rows.length, 0);
    assert.equal((await db.query("select 1 from user_permissions where user_id = $1", [LEGACY])).rows.length, 0);
  });
});
