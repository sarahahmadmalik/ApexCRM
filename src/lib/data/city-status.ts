import { citiesForCountry } from "@/lib/data/geo";
import type { CityRow } from "@/components/cities/city-row";

/**
 * Every city we track for a country (from geo.ts) merged with its actual
 * `city_status` DB rows. The view only ever returns a row for a city that
 * has firm data or a manual override — a city with neither still needs to
 * show up as "not started", so it's filled in here rather than in SQL
 * (the full city list is static app data, not something the database knows).
 *
 * A city that has firms in the database but isn't in the built-in list is
 * kept too (it would otherwise vanish from the page even though the
 * dashboard counts its firms).
 */
export function buildCityRows(country: string, dbRows: CityRow[]): CityRow[] {
  const forCountry = dbRows.filter((r) => r.country === country);
  const byKey = new Map(forCountry.map((r) => [`${r.state}|${r.city}`, r]));
  const known = new Set<string>();

  const rows: CityRow[] = citiesForCountry(country).map(({ state, name }) => {
    const key = `${state}|${name}`;
    known.add(key);
    return (
      byKey.get(key) ?? {
        country,
        state,
        city: name,
        firm_count: 0,
        status: "not_started" as const,
        is_manual_override: false,
        note: null,
      }
    );
  });

  for (const [key, row] of byKey) if (!known.has(key)) rows.push(row);
  return rows;
}
