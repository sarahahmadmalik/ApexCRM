import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrend } from "../../src/lib/data/trends.ts";

test("normal changes are shown as a percentage", () => {
  assert.deepEqual(buildTrend(120, 100, 30), { direction: "up", label: "+20% vs 30 days ago" });
  assert.deepEqual(buildTrend(80, 100, 30), { direction: "down", label: "−20% vs 30 days ago" });
  assert.equal(buildTrend(100, 100)?.label, "No change vs 30 days ago");
});

test("a huge jump from a tiny base shows the plain number, not +5325%", () => {
  assert.equal(buildTrend(425, 8, 8)?.label, "+417 vs 8 days ago");
  assert.equal(buildTrend(10, 0, 5)?.label, "+10 vs 5 days ago");
  assert.equal(buildTrend(1000, 100, 30)?.label, "+900 vs 30 days ago", "a 900% jump is shown as a count");
});

test("no baseline means no trend", () => {
  assert.equal(buildTrend(5, null), null);
});
