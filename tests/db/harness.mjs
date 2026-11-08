// In-memory Postgres (PGlite) with just enough of Supabase stubbed — auth.uid(),
// the anon/authenticated roles, storage tables — to run the project's real
// migrations and exercise its row level security exactly as PostgREST would:
// `set role authenticated` + a `request.jwt.claim.sub` setting.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ADMIN_SCRIPT = join(root, "supabase", "scripts", "create_admin_saramalik.sql");
export const DEFAULT_WORKSPACE = "00000000-0000-0000-0000-00000000d0a0";

const SUPABASE_STUBS = `
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz,
    raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz,
    confirmation_token text, recovery_token text, email_change_token_new text, email_change text
  );
  create table auth.identities (
    id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade,
    provider_id text, provider text, identity_data jsonb,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;

  create schema cron;
  create function cron.schedule(text, text, text) returns bigint language sql as $$ select 1::bigint $$;
  create function cron.unschedule(text) returns boolean language sql as $$ select true $$;

  grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Supabase grants API roles everything on public tables by default; RLS + explicit
  -- revokes (migration 0009) are what restrict it.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export function migrationFiles() {
  const dir = join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f, sql: readFileSync(join(dir, f), "utf8") }));
}

/** Strips the two extension statements PGlite can't run; everything else is executed as written. */
export function prepareMigration(sql) {
  return sql
    .replace(/create extension if not exists "pgcrypto";/gi, "")
    .replace(/create extension if not exists pg_cron with schema extensions;/gi, "");
}

export async function createDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  return db;
}

export async function applyMigrations(db, { upTo, from } = {}) {
  for (const m of migrationFiles()) {
    const n = parseInt(m.name.slice(0, 4), 10);
    if (upTo !== undefined && n > upTo) continue;
    if (from !== undefined && n < from) continue;
    try {
      await db.exec(prepareMigration(m.sql));
    } catch (err) {
      throw new Error(`Migration ${m.name} failed: ${err.message}`);
    }
  }
}

export function runAdminScript(db) {
  return db.exec(readFileSync(ADMIN_SCRIPT, "utf8"));
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

/**
 * Runs one statement as `userId` (or as anon when null) inside a transaction that is always
 * rolled back, so tests never leak state. Resolves to { rows, error, rowCount }.
 */
export async function asUser(db, userId, sql) {
  await db.exec("begin");
  try {
    await db.exec(userId ? `set local role authenticated; select set_config('request.jwt.claim.sub', ${q(userId)}, true);` : "set local role anon;");
    const res = await db.query(sql);
    return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length, error: null };
  } catch (error) {
    return { rows: [], rowCount: 0, error };
  } finally {
    await db.exec("rollback");
  }
}

export async function addAuthUser(db, id, email) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}
