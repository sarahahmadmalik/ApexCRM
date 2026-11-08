import type { CityRow } from "../../components/cities/city-row";

// Pure list helpers for the City Progress page (no app imports, so they can be unit-tested in plain Node).

export type CityFilters = { q: string; state: string; status: string };
export type CitySort = { by: "activity" | "city" | "firms" | "status"; dir: "asc" | "desc" };

const STATUS_RANK = { in_progress: 0, completed: 1, not_started: 2 } as const;

/** Search / state / status filters, applied to the country's full city list. */
export function filterCityRows(rows: CityRow[], { q, state, status }: CityFilters): CityRow[] {
  const needle = q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!needle || r.city.toLowerCase().includes(needle) || r.state.toLowerCase().includes(needle)) &&
      (!state || state === "ALL" || r.state === state) &&
      (!status || status === "ALL" || r.status === status)
  );
}

/**
 * Default order ("activity"): cities with something going on first — in progress, then completed,
 * then the rest — busiest first, so what matters is on page 1 instead of buried alphabetically.
 */
export function sortCityRows(rows: CityRow[], { by, dir }: CitySort): CityRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: CityRow, b: CityRow) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city);
  return [...rows].sort((a, b) => {
    switch (by) {
      case "city":
        return sign * a.city.localeCompare(b.city);
      case "firms":
        return sign * (a.firm_count - b.firm_count) || byName(a, b);
      case "status":
        return sign * (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || byName(a, b);
      default:
        return STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.firm_count - a.firm_count || byName(a, b);
    }
  });
}

export function countByStatus(rows: CityRow[]) {
  return {
    all: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    in_progress: rows.filter((r) => r.status === "in_progress").length,
    not_started: rows.filter((r) => r.status === "not_started").length,
  };
}
