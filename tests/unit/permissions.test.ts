import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PAGES,
  PAGE_KEYS,
  effectivePermissions,
  firstAccessibleHref,
  fullPermissions,
  hasAccess,
  noPermissions,
  pageForPath,
  parsePermissions,
  permissionsFromRows,
  permissionsToRows,
  readOnlyPermissions,
  summarizePermissions,
} from "../../src/lib/permissions.ts";

test("the admin area is not an assignable page", () => {
  assert.ok(!(PAGE_KEYS as string[]).includes("admin"));
  assert.ok(!PAGES.some((p) => p.href.startsWith("/user-management")));
  assert.equal(pageForPath("/user-management"), null);
});

test("hasAccess: none < read < write", () => {
  const perms = { ...noPermissions(), firms: "read" as const, offers: "write" as const };
  assert.equal(hasAccess(perms, "firms", "read"), true);
  assert.equal(hasAccess(perms, "firms", "write"), false);
  assert.equal(hasAccess(perms, "offers", "read"), true, "write implies read");
  assert.equal(hasAccess(perms, "offers", "write"), true);
  assert.equal(hasAccess(perms, "invoices", "read"), false);
});

test("parsePermissions accepts a valid map and fills missing pages with none", () => {
  const parsed = parsePermissions({ firms: "write", cities: "read" });
  assert.equal(parsed.firms, "write");
  assert.equal(parsed.cities, "read");
  assert.equal(parsed.invoices, "none");
});

test("parsePermissions rejects unknown pages — including admin — and bad levels", () => {
  assert.throws(() => parsePermissions({ admin: "write" }), /Unknown page "admin"/);
  assert.throws(() => parsePermissions({ firms: "owner" }), /Invalid access level/);
  assert.throws(() => parsePermissions({ __proto__x: "read" }), /Unknown page/);
  assert.throws(() => parsePermissions(null), /Invalid permissions/);
  assert.throws(() => parsePermissions(["firms"]), /Invalid permissions/);
  assert.throws(() => parsePermissions("firms"), /Invalid permissions/);
});

test("rows <-> permissions round trip; only real grants are stored", () => {
  const perms = { ...noPermissions(), firms: "write" as const, cities: "read" as const };
  const rows = permissionsToRows("user-1", perms);
  assert.deepEqual(
    rows.map((r) => [r.page, r.access]),
    [
      ["firms", "write"],
      ["cities", "read"],
    ]
  );
  assert.ok(rows.every((r) => r.user_id === "user-1"));
  assert.deepEqual(permissionsFromRows(rows), perms);
});

test("permissionsFromRows ignores junk rows", () => {
  const perms = permissionsFromRows([
    { page: "admin", access: "write" },
    { page: "firms", access: "none" },
    { page: "offers", access: "read" },
  ]);
  assert.equal(perms.offers, "read");
  assert.equal(perms.firms, "none");
  assert.equal((perms as Record<string, string>).admin, undefined);
});

test("admins are effectively full access; users get exactly what was stored", () => {
  const stored = readOnlyPermissions();
  assert.deepEqual(effectivePermissions("admin", noPermissions()), fullPermissions());
  assert.deepEqual(effectivePermissions("user", stored), stored);
});

test("firstAccessibleHref picks the first page the user can open", () => {
  assert.equal(firstAccessibleHref(noPermissions()), null);
  assert.equal(firstAccessibleHref({ ...noPermissions(), invoices: "read" }), "/invoices");
  assert.equal(firstAccessibleHref({ ...noPermissions(), offers: "read", cities: "write" }), "/cities");
  assert.equal(firstAccessibleHref(fullPermissions()), "/overview");
});

test("pageForPath maps nested routes and ignores lookalikes", () => {
  assert.equal(pageForPath("/firms"), "firms");
  assert.equal(pageForPath("/firms/123"), "firms");
  assert.equal(pageForPath("/firmsx"), null);
  assert.equal(pageForPath("/profile"), null);
});

test("summarizePermissions", () => {
  assert.equal(summarizePermissions(fullPermissions()), "Full access");
  assert.equal(summarizePermissions(readOnlyPermissions()), "Read only everywhere");
  assert.equal(summarizePermissions(noPermissions()), "No access");
  assert.equal(
    summarizePermissions({ ...noPermissions(), firms: "write", cities: "read", offers: "read" }),
    "1 read & write · 2 read only"
  );
});
