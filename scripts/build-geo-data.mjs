// Builds src/lib/data/geo-generated.ts: the EU countries beyond the hand-curated
// ones, plus any big city that the hand-curated countries are still missing.
//
//   node scripts/build-geo-data.mjs
//
// Source: GeoNames (https://www.geonames.org, CC BY 4.0) — cities15000 / cities5000,
// admin1CodesASCII and countryInfo. Downloads are cached in .cache/geonames.
//
// What "all cities" means here: every city / town with a population of at least
// MIN_POP (15,000). For small countries where that leaves fewer than SMALL_COUNTRY_MIN
// cities, towns of 5,000+ are added (largest first, capped) so the dropdown is never
// nearly empty, and the capital is always included. Purely-administrative fragments
// (districts / sections of a city) are excluded.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, ".cache", "geonames");
const OUT = join(root, "src", "lib", "data", "geo-generated.ts");
mkdirSync(cache, { recursive: true });

const MIN_POP = 15000;
const SMALL_MIN_POP = 5000;
const SMALL_COUNTRY_MIN = 25;
const SMALL_COUNTRY_CAP = 45;

// Countries already curated by hand in geo.ts (their lists are kept; we only add what's missing).
const CURATED = { DE: "Germany", FR: "France", BE: "Belgium", FI: "Finland", SE: "Sweden", IT: "Italy", AT: "Austria", NL: "Netherlands" };
// The rest of the EU-27.
const NEW = {
  BG: "Bulgaria", HR: "Croatia", CY: "Cyprus", CZ: "Czechia", DK: "Denmark", EE: "Estonia", GR: "Greece", HU: "Hungary",
  IE: "Ireland", LV: "Latvia", LT: "Lithuania", LU: "Luxembourg", MT: "Malta", PL: "Poland", PT: "Portugal", RO: "Romania",
  SK: "Slovakia", SI: "Slovenia", ES: "Spain",
};
// GeoNames' official name is clumsy for a few places people call by a simpler name.
const RENAME = { "Almere Stad": "Almere" };
const POPULATED = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5", "PPLC", "PPLG"]);

function download(name, url) {
  const file = join(cache, name);
  if (!existsSync(file)) {
    console.log("downloading", url);
    execFileSync("curl", ["-sSL", "--fail", "-o", file, url], { stdio: "inherit" });
  }
  return file;
}

function readZipText(zipName, url, inner) {
  const zip = download(zipName, url);
  const txt = join(cache, inner);
  if (!existsSync(txt)) {
    // `tar` (bsdtar on Windows 10+/macOS) and `unzip` (Linux) can both extract zips.
    try {
      execFileSync("tar", ["-xf", zip, "-C", cache, inner], { stdio: "inherit" });
    } catch {
      execFileSync("unzip", ["-o", zip, inner, "-d", cache], { stdio: "inherit" });
    }
  }
  return readFileSync(txt, "utf8");
}

const base = "https://download.geonames.org/export/dump/";
const cities15 = readZipText("cities15000.zip", base + "cities15000.zip", "cities15000.txt");
const cities5 = readZipText("cities5000.zip", base + "cities5000.zip", "cities5000.txt");
const admin1Text = readFileSync(download("admin1CodesASCII.txt", base + "admin1CodesASCII.txt"), "utf8");
const countryInfo = readFileSync(download("countryInfo.txt", base + "countryInfo.txt"), "utf8");

const admin1 = new Map(); // "DE.02" -> "Bavaria"
for (const line of admin1Text.split("\n")) {
  const [code, name] = line.split("\t");
  if (code && name) admin1.set(code, name);
}

const iso3 = {};
for (const line of countryInfo.split("\n")) {
  if (line.startsWith("#")) continue;
  const c = line.split("\t");
  if (c[0] && c[1]) iso3[c[0]] = c[1];
}

function parse(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const c = line.split("\t");
    if (c[6] !== "P" || !POPULATED.has(c[7])) continue;
    rows.push({
      name: c[1],
      ascii: c[2],
      alt: c[3] ? c[3].split(",") : [],
      lat: parseFloat(c[4]),
      lng: parseFloat(c[5]),
      code: c[7],
      cc: c[8],
      a1: c[10],
      pop: parseInt(c[14], 10) || 0,
    });
  }
  return rows;
}
const rows15 = parse(cities15);
const rows5 = parse(cities5);

const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const r4 = (n) => Math.round(n * 1e4) / 1e4;

// GeoNames and the hand-curated list sometimes name the same region differently; use the curated spelling.
const STATE_ALIAS = {
  Finland: { "North Savo": "Northern Savonia", "North Ostrobothnia": "Northern Ostrobothnia", "South Savo": "Southern Savonia" },
  Belgium: { "Brussels Capital": "Brussels-Capital Region" },
};
function canonState(country, name) {
  if (!name) return name;
  if (STATE_ALIAS[country]?.[name]) return STATE_ALIAS[country][name];
  if (country === "Sweden" && !/ County$/.test(name)) return name + " County"; // curated Swedish regions are "<name> County"
  return name;
}

const COUNTRY_OF = Object.fromEntries([...Object.entries(CURATED), ...Object.entries(NEW)]);
const stateName = (row) => canonState(COUNTRY_OF[row.cc], admin1.get(`${row.cc}.${row.a1}`) ?? null);

/** Cities to include for one country, per the population rule above. */
function pick(cc) {
  const big = rows15.filter((r) => r.cc === cc && r.pop >= MIN_POP);
  if (big.length >= SMALL_COUNTRY_MIN || !NEW[cc]) return big;
  const all = rows5.filter((r) => r.cc === cc && r.pop >= SMALL_MIN_POP).sort((a, b) => b.pop - a.pop);
  const chosen = new Map(big.map((r) => [`${r.name}|${r.a1}`, r]));
  for (const r of all) {
    if (chosen.size >= SMALL_COUNTRY_CAP) break;
    chosen.set(`${r.name}|${r.a1}`, r);
  }
  const capital = rows5.find((r) => r.cc === cc && r.code === "PPLC");
  if (capital) chosen.set(`${capital.name}|${capital.a1}`, capital);
  return [...chosen.values()];
}

// ------------------------------------------------------------------ new countries
const generated = [];
for (const [cc, name] of Object.entries(NEW).sort((a, b) => a[1].localeCompare(b[1]))) {
  const byState = new Map();
  const seen = new Set();
  for (const r of pick(cc).sort((a, b) => b.pop - a.pop)) {
    const state = stateName(r) ?? name;
    const key = `${state}|${fold(r.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push([RENAME[r.name] ?? r.name, r4(r.lat), r4(r.lng)]);
  }
  let entries = [...byState.entries()];
  // Where GeoNames' "region" is really a municipality (Malta, Slovenia, Latvia: about one town
  // each), a region dropdown of one-town regions is useless — keep one region for the country.
  const cityCount = entries.reduce((n, [, cities]) => n + cities.length, 0);
  if (entries.length > cityCount * 0.6) entries = [[name, entries.flatMap(([, cities]) => cities)]];
  const states = entries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sname, cities]) => ({ name: sname, cities: cities.sort((a, b) => a[0].localeCompare(b[0])) }));
  generated.push({ name, iso2: cc, iso3: iso3[cc], states });
}

// ------------------------------------------------------------------ additions to curated countries
// Read the curated lists straight out of geo.ts (names, states, coordinates).
const geoSrc = readFileSync(join(root, "src", "lib", "data", "geo.ts"), "utf8").replace(/\r\n/g, "\n");
const curated = {};
{
  const countryRe = /name: "([^"]+)",\s*\n\s*iso2: "(\w+)"/g;
  const starts = [...geoSrc.matchAll(countryRe)].map((m) => ({ name: m[1], at: m.index }));
  starts.forEach((s, i) => {
    const block = geoSrc.slice(s.at, starts[i + 1]?.at ?? geoSrc.indexOf("/** ISO 3166-1 numeric"));
    const states = [];
    for (const sm of block.matchAll(/\{ name: "([^"]+)", cities: \[([\s\S]*?)\]\s*\}/g)) {
      const cities = [...sm[2].matchAll(/name: "([^"]+)", lat: ([\d.-]+), lng: ([\d.-]+)/g)].map((c) => ({
        name: c[1],
        lat: parseFloat(c[2]),
        lng: parseFloat(c[3]),
      }));
      states.push({ name: sm[1], cities });
    }
    curated[s.name] = states;
  });
}

const dist2 = (a, b) => (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) ** 2;
const extra = {};
const report = [];
for (const [cc, country] of Object.entries(CURATED)) {
  const states = curated[country];
  if (!states?.length) throw new Error(`Couldn't read curated states for ${country} from geo.ts`);
  const known = new Set();
  const stateByFold = new Map(states.map((s) => [fold(s.name), s.name]));
  for (const s of states) for (const c of s.cities) known.add(fold(c.name));
  const flat = states.flatMap((s) => s.cities.map((c) => ({ ...c, state: s.name })));

  const added = {};
  let count = 0;
  for (const r of pick(cc).sort((a, b) => b.pop - a.pop)) {
    const names = [r.name, r.ascii, ...r.alt].map(fold);
    if (names.some((n) => known.has(n))) continue;
    const gnState = stateName(r);
    let st = stateByFold.get(fold(gnState ?? ""));
    if (!st && gnState) {
      // A region the hand-curated list doesn't have (it only lists a few): add it as a new region.
      st = gnState;
      stateByFold.set(fold(gnState), gnState);
    }
    if (!st) {
      // No region known at all: use the state of the nearest curated city.
      st = flat.reduce((best, c) => (dist2(c, r) < dist2(best, r) ? c : best), flat[0]).state;
    }
    known.add(fold(r.name));
    (added[st] ??= []).push([RENAME[r.name] ?? r.name, r4(r.lat), r4(r.lng)]);
    count++;
  }
  for (const st of Object.keys(added)) added[st].sort((a, b) => a[0].localeCompare(b[0]));
  extra[country] = added;
  report.push(`${country}: ${flat.length} curated + ${count} added`);
}

// ------------------------------------------------------------------ write
const header = `// GENERATED by scripts/build-geo-data.mjs — do not edit by hand (re-run the script instead).
// Source: GeoNames (https://www.geonames.org), CC BY 4.0. Cities and towns with a population of
// 15,000+ (5,000+ for small countries). Cities are compact [name, lat, lng] tuples; geo.ts expands them.

export type CompactCity = readonly [name: string, lat: number, lng: number];
export type CompactCountry = {
  name: string;
  iso2: string;
  iso3: string;
  states: { name: string; cities: CompactCity[] }[];
};

`;
const body =
  `/** EU countries that are not hand-curated in geo.ts. */\nexport const GENERATED_COUNTRIES: CompactCountry[] = ${JSON.stringify(generated)};\n\n` +
  `/** Larger cities missing from the hand-curated countries, keyed by country then state. */\nexport const EXTRA_CITIES: Record<string, Record<string, CompactCity[]>> = ${JSON.stringify(extra)};\n`;
writeFileSync(OUT, header + body);

const total = generated.reduce((n, c) => n + c.states.reduce((m, s) => m + s.cities.length, 0), 0);
console.log(`Wrote ${OUT}`);
console.log(`new countries: ${generated.length}, cities: ${total}`);
for (const c of generated) console.log(`  ${c.name}: ${c.states.reduce((m, s) => m + s.cities.length, 0)} cities in ${c.states.length} regions`);
for (const line of report) console.log("  " + line);
