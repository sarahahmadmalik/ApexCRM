import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EXTRA_CITIES, GENERATED_COUNTRIES } from "../../src/lib/data/geo-generated.ts";

const EU27 = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France",
  "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
];

const geoSrc = readFileSync("src/lib/data/geo.ts", "utf8").replace(/\r\n/g, "\n");
const curatedNames = [...geoSrc.matchAll(/name: "([^"]+)",\s*\n\s*iso2: "(\w+)"/g)].map((m) => m[1]);
const generatedNames = GENERATED_COUNTRIES.map((c) => c.name);
const allNames = [...curatedNames, ...generatedNames];

test("every EU-27 country is available, each exactly once", () => {
  assert.deepEqual([...allNames].sort(), [...EU27].sort());
});

test("every country has a map id that exists in the map data", () => {
  const ids = Object.fromEntries([...geoSrc.matchAll(/^\s{2}(\w+): "(\d{3})",$/gm)].map((m) => [m[1], m[2]]));
  const topology = JSON.parse(readFileSync("public/geo/countries-50m.json", "utf8"));
  const inMap = new Set(topology.objects.countries.geometries.map((g: { id: string | number }) => String(g.id).padStart(3, "0")));
  for (const name of EU27) {
    assert.ok(ids[name], `${name} has no COUNTRY_NUMERIC_ID`);
    assert.ok(inMap.has(ids[name]), `${name} (${ids[name]}) is not in countries-50m.json`);
  }
});

test("every country has a flag", () => {
  const flagSrc = readFileSync("src/components/ui/country-flag.tsx", "utf8");
  const all = [
    ...[...geoSrc.matchAll(/iso2: "(\w+)"/g)].map((m) => m[1]),
    ...GENERATED_COUNTRIES.map((c) => c.iso2),
  ];
  for (const iso of all) assert.match(flagSrc, new RegExp(`\\n  ${iso}: \\(`), `no flag for ${iso}`);
});

test("generated countries have ISO3 codes, real regions and plenty of cities", () => {
  for (const c of GENERATED_COUNTRIES) {
    assert.match(c.iso3, /^[A-Z]{3}$/, c.name);
    const cities = c.states.flatMap((s) => s.cities);
    assert.ok(cities.length >= 19, `${c.name} only has ${cities.length} cities`);
    for (const s of c.states) {
      const seen = new Set<string>();
      for (const [name, lat, lng] of s.cities) {
        assert.ok(name.trim(), `${c.name}/${s.name}: empty city name`);
        assert.ok(!seen.has(name), `${c.name}/${s.name}: duplicate city ${name}`);
        seen.add(name);
        // Cyprus/Malta/Canary Islands excluded from bounds only by being real coordinates in Europe or its islands.
        assert.ok(lat > 27 && lat < 72 && lng > -32 && lng < 45, `${c.name}/${name}: implausible coordinates ${lat},${lng}`);
      }
    }
  }
});

test("the big-country lists are actually comprehensive", () => {
  const count = (name: string) => GENERATED_COUNTRIES.find((c) => c.name === name)!.states.reduce((n, s) => n + s.cities.length, 0);
  assert.ok(count("Spain") > 400, "Spain");
  assert.ok(count("Poland") > 250, "Poland");
  assert.ok(count("Portugal") > 100, "Portugal");
  assert.ok(count("Romania") > 100, "Romania");
  // capitals must be present
  const has = (country: string, city: string) =>
    GENERATED_COUNTRIES.find((c) => c.name === country)!.states.some((s) => s.cities.some(([n]) => n === city));
  for (const [country, capital] of [["Spain", "Madrid"], ["Poland", "Warsaw"], ["Portugal", "Lisbon"], ["Greece", "Athens"], ["Ireland", "Dublin"], ["Denmark", "Copenhagen"], ["Malta", "Valletta"], ["Luxembourg", "Luxembourg"], ["Cyprus", "Nicosia"]]) {
    assert.ok(has(country, capital), `${capital} missing from ${country}`);
  }
});

test("additions to the hand-curated countries only add cities that are not already listed in that country", () => {
  // Names can repeat across countries (Lille exists in both France and Belgium), so compare per country.
  const starts = [...geoSrc.matchAll(/name: "([^"]+)",\s*\n\s*iso2: "(\w+)"/g)].map((m) => ({ name: m[1], at: m.index! }));
  const curatedByCountry: Record<string, Set<string>> = {};
  starts.forEach((s, i) => {
    const block = geoSrc.slice(s.at, starts[i + 1]?.at ?? geoSrc.indexOf("/** ISO 3166-1 numeric"));
    curatedByCountry[s.name] = new Set([...block.matchAll(/name: "([^"]+)", lat:/g)].map((m) => m[1].toLowerCase()));
  });
  for (const [country, states] of Object.entries(EXTRA_CITIES)) {
    assert.ok(curatedByCountry[country], `${country} is not a curated country`);
    for (const cities of Object.values(states)) {
      for (const [name] of cities) assert.ok(!curatedByCountry[country].has(name.toLowerCase()), `${country}: ${name} is already curated`);
    }
  }
});
