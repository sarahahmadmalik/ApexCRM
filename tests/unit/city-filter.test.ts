import { test } from "node:test";
import assert from "node:assert/strict";
import { countByStatus, filterCityRows, sortCityRows } from "../../src/lib/data/city-filter.ts";

type Row = Parameters<typeof filterCityRows>[0][number];
const row = (city: string, state: string, status: Row["status"], firm_count = 0): Row => ({
  country: "Germany", state, city, firm_count, status, is_manual_override: false, note: null,
});

// A country with far more cities than fit on one page of 12, where the busy ones sort late alphabetically.
const many: Row[] = [
  ...Array.from({ length: 60 }, (_, i) => row(`Aachen-${String(i).padStart(2, "0")}`, "Bavaria", "not_started")),
  row("Zwickau", "Saxony", "in_progress", 9),
  row("Wuppertal", "North Rhine-Westphalia", "in_progress", 4),
  row("Ulm", "Baden-Württemberg", "completed", 3),
];
const none = { q: "", state: "", status: "" };

test("the default order puts what is happening first, not the alphabet", () => {
  const sorted = sortCityRows(many, { by: "activity", dir: "desc" });
  assert.deepEqual(sorted.slice(0, 3).map((r) => r.city), ["Zwickau", "Wuppertal", "Ulm"]);
  assert.equal(sorted[3].status, "not_started");
});

test("filtering by status finds cities that would be on a later page", () => {
  const inProgress = filterCityRows(many, { ...none, status: "in_progress" });
  assert.deepEqual(inProgress.map((r) => r.city).sort(), ["Wuppertal", "Zwickau"]);
  assert.equal(filterCityRows(many, { ...none, status: "completed" }).length, 1);
});

test("search matches city or region, case-insensitively, across the whole list", () => {
  assert.deepEqual(filterCityRows(many, { ...none, q: "zwick" }).map((r) => r.city), ["Zwickau"]);
  assert.equal(filterCityRows(many, { ...none, q: "saxony" }).length, 1);
  assert.equal(filterCityRows(many, { ...none, q: "  ULM " }).length, 1);
  assert.equal(filterCityRows(many, { ...none, q: "nothing-like-this" }).length, 0);
});

test("the region filter and the other filters combine", () => {
  assert.equal(filterCityRows(many, { ...none, state: "Bavaria" }).length, 60);
  assert.equal(filterCityRows(many, { q: "", state: "Bavaria", status: "in_progress" }).length, 0);
  assert.equal(filterCityRows(many, { q: "wupp", state: "North Rhine-Westphalia", status: "in_progress" }).length, 1);
  assert.equal(filterCityRows(many, { ...none, state: "ALL", status: "ALL" }).length, many.length);
});

test("status counts cover the whole country", () => {
  assert.deepEqual(countByStatus(many), { all: 63, completed: 1, in_progress: 2, not_started: 60 });
});

test("explicit sorts by city, firms and status still work", () => {
  assert.equal(sortCityRows(many, { by: "city", dir: "asc" })[0].city, "Aachen-00");
  assert.equal(sortCityRows(many, { by: "firms", dir: "desc" })[0].city, "Zwickau");
  assert.equal(sortCityRows(many, { by: "status", dir: "asc" })[0].status, "in_progress");
});
