// SQL that marks cities as COMPLETED (a manual status; in progress is derived automatically from the firms).
// Input entries look like { "country": "Germany", "city": "Hasselroth" } — the region is looked up from the imported
// firms, or can be given as "state".
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

/** Resolves list entries against the imported firms; returns { rows, unknown }. */
export function resolveCompleted(list, firms) {
  const rows = [];
  const unknown = [];
  const seen = new Set();
  for (const e of list) {
    const match = firms.find((f) => f.country === e.country && f.city === e.city && (!e.state || f.state === e.state));
    if (!match) { unknown.push(e); continue; }
    const key = `${match.country}|${match.state}|${match.city}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ country: match.country, state: match.state, city: match.city, note: e.note ?? null });
  }
  return { rows, unknown };
}

export function completedCitiesSql(rows) {
  if (rows.length === 0) return "-- (no cities are marked completed yet — list them in supabase/data/completed-cities.json)\n";
  const values = rows.map((r) => `  (${lit(r.country)}, ${lit(r.state)}, ${lit(r.city)}, 'completed', ${r.note ? lit(r.note) : "null"})`).join(",\n");
  return `insert into city_completion (country, state, city, manual_status, note)
values
${values}
on conflict (country, state, city) do update set manual_status = 'completed', updated_at = now();
`;
}
