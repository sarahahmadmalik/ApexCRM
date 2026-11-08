// One-time (re-run when GEO_DATA changes) data-prep script: builds
// public/geo/city-boundaries.json — a small GeoJSON FeatureCollection with
// one real administrative-boundary polygon per city tracked in
// src/lib/data/geo.ts, used by the dashboard map to fill each city by status
// instead of just plotting a dot.
//
// Sources (all free / openly licensed, attribution given in the app):
//  - Germany, Sweden, Finland, Belgium, Italy: geoBoundaries.org (mixed
//    CC0 / ODbL / CC-BY licenses per country)
//  - France: gregoiredavid/france-geojson (IGN Admin Express COG data,
//    Etalab Open License 2.0) — used instead of geoBoundaries for France
//    because geoBoundaries' French ADM4 layer is canton-level and
//    fragments larger cities (Paris, Lyon, Marseille, ...) into many
//    sub-city pieces instead of one polygon per commune.
//
// Run with: node scripts/build-city-boundaries.ts
//
// Downloads are cached on disk (CACHE_DIR below) so re-runs are fast and
// don't hit the network repeatedly.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GEO_DATA } from "../src/lib/data/geo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CACHE_DIR = join(REPO_ROOT, ".cache", "city-boundaries");
const OUT_FILE = join(REPO_ROOT, "public", "geo", "city-boundaries.json");

type GeoJSONFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: unknown;
};
type GeoJSONFeatureCollection = { type: "FeatureCollection"; features: GeoJSONFeature[] };

async function fetchCached(url: string, cacheKey: string): Promise<GeoJSONFeatureCollection> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, cacheKey);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  }
  console.log(`  fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  writeFileSync(cachePath, text);
  return JSON.parse(text);
}

// Round every coordinate to 5 decimal places (~1m precision) to shrink the
// output file — far more precision than a country-zoomed-out map needs.
function roundCoords(coords: unknown): unknown {
  const arr = coords as unknown[];
  if (typeof arr[0] === "number") {
    return (arr as number[]).map((n) => Math.round(n * 1e5) / 1e5);
  }
  return arr.map(roundCoords);
}

function simplifyFeature(f: GeoJSONFeature, properties: Record<string, unknown>): GeoJSONFeature {
  const geom = f.geometry as { type: string; coordinates: unknown };
  return {
    type: "Feature",
    properties,
    geometry: { type: geom.type, coordinates: roundCoords(geom.coordinates) },
  };
}

// ============================================================================
// Germany — geoBoundaries DEU ADM3 (Kreis / kreisfreie Stadt level)
// ============================================================================

const DEU_ALIASES: Record<string, string> = {
  Munich: "München",
  Nuremberg: "Nürnberg",
  Cologne: "Köln",
  // Hannover city and its surrounding Landkreis were merged into one
  // administrative unit in 2001 — "Region Hannover" is the closest real
  // boundary available (city dominates the region).
  Hanover: "Region Hannover",
  Saarbrücken: "Regionalverband Saarbrücken",
};

// Some Kreis names exist twice (an independent city — "Stadtkreis" in
// Baden-Württemberg, "Kreisfreie Stadt" elsewhere — plus a surrounding,
// differently-shaped "Landkreis" of the same base name). Always prefer the
// city itself, never the surrounding county.
function pickBestGermanMatch(matches: GeoJSONFeature[], wantedName: string): GeoJSONFeature {
  if (matches.length === 1) return matches[0];
  const independentCity = matches.find(
    (m) => String(m.properties.shapeName).includes("Stadtkreis") || String(m.properties.shapeName).includes("Kreisfreie Stadt")
  );
  if (independentCity) return independentCity;
  const notLandkreis = matches.filter((m) => !String(m.properties.shapeName).includes("Landkreis"));
  if (notLandkreis.length === 1) return notLandkreis[0];
  // Source data sometimes carries the exact same Kreis as two identical
  // rows (seen for the city-states) — harmless, just take the first.
  const names = new Set(matches.map((m) => m.properties.shapeName));
  if (names.size === 1) {
    console.warn(`  [dup row] Germany / ${wantedName}: ${matches.length}x identical "${matches[0].properties.shapeName}" — using first`);
    return matches[0];
  }
  throw new Error(`Ambiguous German match for "${wantedName}": ${matches.map((m) => m.properties.shapeName).join(", ")}`);
}

async function buildGermany(): Promise<GeoJSONFeature[]> {
  const meta = await (await fetch("https://www.geoboundaries.org/api/current/gbOpen/DEU/ADM3/")).json();
  const fc = await fetchCached(meta.simplifiedGeometryGeoJSON, "DEU_ADM3.geojson");

  const out: GeoJSONFeature[] = [];
  for (const state of GEO_DATA.find((c) => c.name === "Germany")!.states) {
    for (const city of state.cities) {
      const sourceName = DEU_ALIASES[city.name] ?? city.name;
      const matches = fc.features.filter((f) => String(f.properties.shapeName).split(",")[0].trim() === sourceName);
      if (matches.length === 0) {
        console.warn(`  [MISS] Germany / ${city.name} (looked for "${sourceName}")`);
        continue;
      }
      const best = pickBestGermanMatch(matches, city.name);
      out.push(simplifyFeature(best, { country: "Germany", state: state.name, city: city.name }));
    }
  }
  return out;
}

// ============================================================================
// Sweden — geoBoundaries SWE ADM2 (Municipality)
// ============================================================================

const SWE_ALIASES: Record<string, string> = { Gothenburg: "Gothenburg" };

async function buildSweden(): Promise<GeoJSONFeature[]> {
  const meta = await (await fetch("https://www.geoboundaries.org/api/current/gbOpen/SWE/ADM2/")).json();
  const fc = await fetchCached(meta.simplifiedGeometryGeoJSON, "SWE_ADM2.geojson");

  const out: GeoJSONFeature[] = [];
  for (const state of GEO_DATA.find((c) => c.name === "Sweden")!.states) {
    for (const city of state.cities) {
      const sourceName = SWE_ALIASES[city.name] ?? city.name;
      const matches = fc.features.filter((f) => f.properties.shapeName === sourceName);
      if (matches.length !== 1) {
        console.warn(`  [MISS] Sweden / ${city.name} (${matches.length} matches for "${sourceName}")`);
        continue;
      }
      out.push(simplifyFeature(matches[0], { country: "Sweden", state: state.name, city: city.name }));
    }
  }
  return out;
}

// ============================================================================
// Finland — geoBoundaries FIN ADM3 (Kunta / municipality)
// ============================================================================

async function buildFinland(): Promise<GeoJSONFeature[]> {
  const meta = await (await fetch("https://www.geoboundaries.org/api/current/gbOpen/FIN/ADM3/")).json();
  const fc = await fetchCached(meta.simplifiedGeometryGeoJSON, "FIN_ADM3.geojson");

  const out: GeoJSONFeature[] = [];
  for (const state of GEO_DATA.find((c) => c.name === "Finland")!.states) {
    for (const city of state.cities) {
      const matches = fc.features.filter((f) => f.properties.shapeName === city.name);
      if (matches.length !== 1) {
        console.warn(`  [MISS] Finland / ${city.name} (${matches.length} matches)`);
        continue;
      }
      out.push(simplifyFeature(matches[0], { country: "Finland", state: state.name, city: city.name }));
    }
  }
  return out;
}

// ============================================================================
// Belgium — geoBoundaries BEL ADM4 (Gemeente / commune)
// ============================================================================

const BEL_ALIASES: Record<string, string> = {
  Brussels: "Bruxelles | Brussel",
  Antwerp: "Antwerpen",
  Ghent: "Gent",
  Bruges: "Brugge",
};

async function buildBelgium(): Promise<GeoJSONFeature[]> {
  const meta = await (await fetch("https://www.geoboundaries.org/api/current/gbOpen/BEL/ADM4/")).json();
  const fc = await fetchCached(meta.simplifiedGeometryGeoJSON, "BEL_ADM4.geojson");

  const out: GeoJSONFeature[] = [];
  for (const state of GEO_DATA.find((c) => c.name === "Belgium")!.states) {
    for (const city of state.cities) {
      const sourceName = BEL_ALIASES[city.name] ?? city.name;
      const matches = fc.features.filter((f) => f.properties.shapeName === sourceName);
      if (matches.length !== 1) {
        console.warn(`  [MISS] Belgium / ${city.name} (${matches.length} matches for "${sourceName}")`);
        continue;
      }
      out.push(simplifyFeature(matches[0], { country: "Belgium", state: state.name, city: city.name }));
    }
  }
  return out;
}

// ============================================================================
// Italy — geoBoundaries ITA ADM4 (Comune)
// ============================================================================

const ITA_ALIASES: Record<string, string> = {
  Rome: "Roma",
  Milan: "Milano",
  Naples: "Napoli",
  Turin: "Torino",
  Venice: "Venezia",
  Florence: "Firenze",
  Genoa: "Genova",
};

async function buildItaly(): Promise<GeoJSONFeature[]> {
  const meta = await (await fetch("https://www.geoboundaries.org/api/current/gbOpen/ITA/ADM4/")).json();
  const fc = await fetchCached(meta.simplifiedGeometryGeoJSON, "ITA_ADM4.geojson");

  const out: GeoJSONFeature[] = [];
  for (const state of GEO_DATA.find((c) => c.name === "Italy")!.states) {
    for (const city of state.cities) {
      const sourceName = ITA_ALIASES[city.name] ?? city.name;
      const matches = fc.features.filter((f) => f.properties.shapeName === sourceName);
      if (matches.length !== 1) {
        console.warn(`  [MISS] Italy / ${city.name} (${matches.length} matches for "${sourceName}")`);
        continue;
      }
      out.push(simplifyFeature(matches[0], { country: "Italy", state: state.name, city: city.name }));
    }
  }
  return out;
}

// ============================================================================
// France — gregoiredavid/france-geojson, per-department commune files
// (IGN Admin Express COG — resolves Paris/Lyon as single clean communes,
// unlike geoBoundaries' canton-fragmented FRA ADM4 layer)
// ============================================================================

const FRA_DEPARTMENTS: Record<string, string> = {
  Paris: "75-paris",
  Versailles: "78-yvelines",
  Lyon: "69-rhone",
  Grenoble: "38-isere",
  Marseille: "13-bouches-du-rhone",
  Nice: "06-alpes-maritimes",
  Bordeaux: "33-gironde",
  Toulouse: "31-haute-garonne",
  Montpellier: "34-herault",
  Lille: "59-nord",
  Strasbourg: "67-bas-rhin",
  Nantes: "44-loire-atlantique",
  Rennes: "35-ille-et-vilaine",
  Rouen: "76-seine-maritime",
  Dijon: "21-cote-d-or",
  Tours: "37-indre-et-loire",
};

async function buildFrance(): Promise<GeoJSONFeature[]> {
  const out: GeoJSONFeature[] = [];
  for (const state of GEO_DATA.find((c) => c.name === "France")!.states) {
    for (const city of state.cities) {
      const dept = FRA_DEPARTMENTS[city.name];
      if (!dept) {
        console.warn(`  [MISS] France / ${city.name} (no department mapping)`);
        continue;
      }
      const url = `https://cdn.jsdelivr.net/gh/gregoiredavid/france-geojson@master/departements/${dept}/communes-${dept}.geojson`;
      const fc = await fetchCached(url, `FRA_${dept}.geojson`);
      const matches = fc.features.filter((f) => f.properties.nom === city.name);
      if (matches.length !== 1) {
        console.warn(`  [MISS] France / ${city.name} (${matches.length} matches in ${dept})`);
        continue;
      }
      out.push(simplifyFeature(matches[0], { country: "France", state: state.name, city: city.name }));
    }
  }
  return out;
}

// ============================================================================

async function main() {
  console.log("Germany...");
  const deu = await buildGermany();
  console.log("Sweden...");
  const swe = await buildSweden();
  console.log("Finland...");
  const fin = await buildFinland();
  console.log("Belgium...");
  const bel = await buildBelgium();
  console.log("Italy...");
  const ita = await buildItaly();
  console.log("France...");
  const fra = await buildFrance();

  const allFeatures = [...deu, ...swe, ...fin, ...bel, ...ita, ...fra];

  const totalCities = GEO_DATA.flatMap((c) => c.states.flatMap((s) => s.cities)).length;
  console.log(`\nResolved ${allFeatures.length} / ${totalCities} cities to real boundary polygons.`);

  const fc: GeoJSONFeatureCollection = { type: "FeatureCollection", features: allFeatures };
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(fc));
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
