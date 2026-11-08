// Signs in and requests every page of the running app, reporting any that fail (HTTP 500 / error page).
//
//   npm run dev            (in another terminal)
//   npm run test:smoke
//
// It runs twice against your real Supabase project through the running app, exactly like a browser
// (supabase-js sign-in, then the same session cookie @supabase/ssr sets):
//   1. as a throwaway member with read & write on every page (user-management must 404 for them), and
//   2. as a throwaway workspace admin, in a throwaway workspace (user-management must load).
// Everything it creates is deleted afterwards; your real users and data are never touched.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) throw new Error("Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (use `npm run test:smoke`).");
const opts = { auth: { autoRefreshToken: false, persistSession: false } };
const service = createClient(url, secret, opts);

const PAGES = ["dashboard", "firms", "cities", "employees", "contracts", "offers", "invoices"];
const created = { users: [], workspaces: [] };

async function makeUser({ admin }) {
  const tag = randomBytes(4).toString("hex");
  const email = `smoke-${admin ? "admin" : "member"}-${tag}@example.test`;
  const password = `Smk-${randomBytes(9).toString("base64url")}9`;
  let workspaceId;
  if (admin) {
    const { data, error } = await service.from("workspaces").insert({ name: `zz smoke ${tag}` }).select("id").single();
    if (error) throw new Error(error.message);
    workspaceId = data.id;
    created.workspaces.push(workspaceId);
  } else {
    workspaceId = (await service.from("workspaces").select("id").order("created_at").limit(1).single()).data.id;
  }
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  const id = data.user.id;
  created.users.push(id);
  const row = await service.from("app_users").insert({ id, full_name: "Smoke Test", role: "Tester", workspace_id: workspaceId, account_role: admin ? "admin" : "user" });
  if (row.error) throw new Error(row.error.message);
  if (!admin) await service.from("user_permissions").insert(PAGES.map((page) => ({ user_id: id, page, access: "write" })));
  return { email, password };
}

function sessionCookies(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const size = 3180;
  if (value.length <= size) return [`${name}=${value}`];
  return value.match(new RegExp(`.{1,${size}}`, "g")).map((p, i) => `${name}.${i}=${p}`);
}

async function crawl(label, { email, password }, paths, expected404 = []) {
  const client = createClient(url, publishable, opts);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label}: sign-in failed: ${error.message}`);
  const cookie = sessionCookies(data.session).join("; ");
  const out = [];
  for (const path of paths) {
    const res = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
    const text = res.status === 200 ? await res.text() : "";
    const serverError = res.status >= 500 || /Internal Server Error|Application error/.test(text.slice(0, 300000));
    const wrong404 = expected404.includes(path) ? res.status !== 404 : false;
    out.push({ label, path, status: res.status, location: res.headers.get("location") ?? "", bad: serverError || wrong404, note: wrong404 ? "expected 404" : "" });
  }
  return out;
}

const common = [
  "/overview", "/overview?country=Germany", "/overview?country=Spain", "/overview?country=Netherlands", "/firms", "/firms?page=2",
  "/firms?country=Netherlands&status=sent", "/cities", "/cities?country=Sweden", "/cities?country=Sweden&status=in_progress", "/cities?country=Germany&q=k%C3%B6ln&state=North%20Rhine-Westphalia", "/cities?country=Spain&page=3", "/cities?country=Nowhere", "/employees", "/contracts", "/offers", "/invoices", "/settings",
];
const results = [];
try {
  const member = await makeUser({ admin: false });
  results.push(...(await crawl("member", member, [...common, "/user-management", "/this-page-does-not-exist"], ["/user-management", "/this-page-does-not-exist"])));
  const admin = await makeUser({ admin: true });
  results.push(...(await crawl("admin", admin, ["/user-management", "/settings"])));
} finally {
  for (const id of created.users) await service.auth.admin.deleteUser(id);
  for (const id of created.workspaces) await service.from("workspaces").delete().eq("id", id);
}

let failed = 0;
for (const r of results) {
  if (r.bad) failed++;
  console.log(`${r.bad ? "✖" : "✔"} ${r.label.padEnd(6)} ${String(r.status).padEnd(4)} ${r.path}${r.location ? "  -> " + r.location : ""}${r.note ? "  (" + r.note + ")" : ""}`);
}
console.log(failed ? `\n${failed} problem(s)` : "\nNo server errors.");
process.exit(failed ? 1 : 0);
