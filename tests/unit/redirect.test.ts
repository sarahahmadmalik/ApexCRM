import { test } from "node:test";
import assert from "node:assert/strict";

import { safeRedirectPath, rateLimit, resetRateLimit } from "../../src/lib/security-core.ts";

test("safeRedirectPath keeps same-site paths", () => {
  assert.equal(safeRedirectPath("/reset-password"), "/reset-password");
  assert.equal(safeRedirectPath("/firms?q=abc"), "/firms?q=abc");
});

test("safeRedirectPath blocks open redirects", () => {
  for (const evil of ["@evil.com", "//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", ""]) {
    assert.equal(safeRedirectPath(evil), "/overview", `should reject ${JSON.stringify(evil)}`);
  }
  assert.equal(safeRedirectPath(null), "/overview");
  assert.equal(safeRedirectPath(undefined, "/login"), "/login");
});

test("rateLimit allows `limit` attempts then blocks until reset", () => {
  const key = `test:${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 60_000).ok, true);
  const blocked = rateLimit(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0);
  resetRateLimit(key);
  assert.equal(rateLimit(key, 3, 60_000).ok, true);
});
