// Turns the extracted PDF rows into clean firm records for the app.
//
//   Sources (both produced by the extract scripts, same row shape):
//     supabase/data/lead-register.json       the full outreach register   (S.No 1-1426, emails 7 Aug - 14 Sep 2026)
//     supabase/data/firm-contact-list.json   the later contact list       (S.No 1427-1859, emails 14-16 Sep 2026)
//   Outputs:
//     supabase/data/firms-import.json        one clean row per firm (name, country, state, city, status, ...)
//     src/lib/data/geo-custom.ts             towns from the lists that the built-in city list doesn't have yet
//
//   node scripts/import-firms.mjs
//
// City matching uses the app's own city list (hand-curated + generated) and GeoNames (cities500, cached in
// .cache/geonames) to recognise other spellings and typos ("Den Haag" = The Hague, "Köln" = Cologne,
// "Utrech" = Utrecht) and to find the region of a town that isn't in the list yet.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTRA_CITIES, GENERATED_COUNTRIES } from "../src/lib/data/geo-generated.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = (f) => join(root, "supabase", "data", f);
const OUT_FIRMS = data("firms-import.json");
const OUT_GEO = join(root, "src", "lib", "data", "geo-custom.ts");
const cache = join(root, ".cache", "geonames");

// Register first (it is the older one), then the later list.
const SOURCES = [
  { name: "register", file: data("lead-register.json") },
  { name: "list", file: data("firm-contact-list.json") },
];

const COUNTRIES = {
  Germany: "DE", Austria: "AT", Finland: "FI", Netherlands: "NL", Sweden: "SE", Belgium: "BE",
};
// Country as it is (mis)spelled in the PDFs.
const COUNTRY_TOKEN = [
  [/\b(DEU|DUE|Deutschland|Germany)\b/i, "Germany"],
  [/\b(Austria|Asutria|Austra?ia|Österreich)\b/i, "Austria"],
  [/\b(Finn?land|Finalnd|Filand|Finlnd)\b/i, "Finland"],
  [/\b(Holland|Netherlands|Niederlande)\b/i, "Netherlands"],
  [/\bSweden\b/i, "Sweden"],
  [/\b(Belgium|Belgien)\b/i, "Belgium"],
];

// Words the PDFs broke with a stray hyphen ("Ser-vices"). Real hyphens (Sint-Truiden, AM-Pharma) are left alone.
const JOIN = [
  "Alme-re", "Cathe-ters", "Chemi-cals", "Compa-ny", "Diagnos-tics", "Es-tate", "In-dustries", "Karls-tad", "Linkö-ping",
  "Man-agement", "Mellansveri-ge", "Nether-lands", "Pletten-berg", "Profes-sionals", "Ruit-er", "Samkörn-ings", "Ser-vices",
  "Solu-tions", "Sveri-ge", "vastgoedmake-laar", "Ver-huurmakelaar", "Möbel-spedition", "WARE-HOUSING",
];
// Rows whose location cell has no country in the PDF (read from the PDF pages by hand: all in Germany).
const LOCATION_FIX = { "register:8": "Alzenau, DEU", "register:191": "Übach-Palenberg, DEU", "register:192": "Übach-Palenberg, DEU", "register:193": "Übach-Palenberg, DEU", "register:194": "Übach-Palenberg, DEU" };
// Naming differences between the PDFs and the app's city list (checked by hand).
const CITY_FIX = {
  Utrech: "Utrecht", "Den Haag": "The Hague", Köln: "Cologne", "Westerlo/Oev el": "Westerlo", "Großkrotzenb urg": "Großkrotzenburg",
  Vaanta: "Vantaa", Vernay: "Venray", Karlstein: "Karlstein am Main", "Ebenthal in Kärnten": "Ebenthal",
};

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

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const dist2 = (a, b) => (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) ** 2;

function fixText(s) {
  let out = s ?? "";
  for (const j of JOIN) out = out.replaceAll(j, j.replace("-", ""));
  return out.replace(/\s+/g, " ").trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// ------------------------------------------------------------------ the app's city list
const geoSrc = readFileSync(join(root, "src", "lib", "data", "geo.ts"), "utf8").replace(/\r\n/g, "\n");
const geo = {}; // country -> [{state, name, lat, lng}]
{
  const starts = [...geoSrc.matchAll(/name: "([^"]+)",\s*\n\s*iso2: "(\w+)"/g)].map((m) => ({ name: m[1], at: m.index }));
  starts.forEach((s, i) => {
    const block = geoSrc.slice(s.at, starts[i + 1]?.at ?? geoSrc.indexOf("/** ISO 3166-1 numeric"));
    geo[s.name] = [];
    for (const sm of block.matchAll(/\{ name: "([^"]+)", cities: \[([\s\S]*?)\]\s*\}/g)) {
      for (const c of sm[2].matchAll(/name: "([^"]+)", lat: ([\d.-]+), lng: ([\d.-]+)/g)) {
        geo[s.name].push({ state: sm[1], name: c[1], lat: parseFloat(c[2]), lng: parseFloat(c[3]) });
      }
    }
  });
  for (const [country, states] of Object.entries(EXTRA_CITIES)) {
    for (const [state, cities] of Object.entries(states)) for (const [name, lat, lng] of cities) geo[country].push({ state, name, lat, lng });
  }
  for (const c of GENERATED_COUNTRIES) geo[c.name] = c.states.flatMap((s) => s.cities.map(([name, lat, lng]) => ({ state: s.name, name, lat, lng })));
}

// ------------------------------------------------------------------ GeoNames
const admin1 = new Map();
for (const line of readFileSync(join(cache, "admin1CodesASCII.txt"), "utf8").split("\n")) {
  const [code, name] = line.split("\t");
  if (code && name) admin1.set(code, name);
}
const wantedCodes = new Set(Object.values(COUNTRIES));
const gn = []; // every GeoNames place of the six countries
const gnByFold = new Map(); // "DE|hasselroth" -> [places]
for (const line of readFileSync(join(cache, "cities500.txt"), "utf8").split("\n")) {
  const c = line.split("\t");
  if (c[6] !== "P" || !wantedCodes.has(c[8])) continue;
  const place = { name: c[1], ascii: c[2], alt: (c[3] ?? "").split(","), lat: parseFloat(c[4]), lng: parseFloat(c[5]), cc: c[8], a1: c[10], pop: parseInt(c[14], 10) || 0 };
  gn.push(place);
  for (const n of new Set([place.name, place.ascii, ...place.alt])) {
    if (!n) continue;
    const k = `${place.cc}|${fold(n)}`;
    if (!gnByFold.has(k)) gnByFold.set(k, []);
    gnByFold.get(k).push(place);
  }
}
const best = (places) => places.slice().sort((a, b) => b.pop - a.pop)[0];

const cityCache = new Map();
const added = {}; // country -> state -> [[name, lat, lng]]
const fuzzy = []; // [country, raw, resolved] — printed for review

function placeInGeo(country, place) {
  const list = geo[country];
  return list.find((c) => fold(c.name) === fold(place.name));
}

function addPlace(country, cc, place) {
  const list = geo[country];
  const stateFromGn = canonState(country, admin1.get(`${cc}.${place.a1}`));
  const states = [...new Set(list.map((c) => c.state))];
  let state = states.find((s) => stateFromGn && fold(s) === fold(stateFromGn));
  if (!state && stateFromGn) state = stateFromGn;
  if (!state) state = list.reduce((b, c) => (dist2(c, place) < dist2(b, place) ? c : b), list[0]).state;
  ((added[country] ??= {})[state] ??= []).push([place.name, r4(place.lat), r4(place.lng)]);
  list.push({ state, name: place.name, lat: place.lat, lng: place.lng });
  return { state, city: place.name };
}

function resolveCity(country, rawCity) {
  const key = `${country}|${rawCity}`;
  if (cityCache.has(key)) return cityCache.get(key);
  const cc = COUNTRIES[country];
  const list = geo[country];
  const base = CITY_FIX[rawCity] ?? fixText(rawCity);

  // candidate spellings: as written, without brackets, and the parts of "A / B", "A-B"
  const variants = [base, base.replace(/\(.*?\)/g, "").trim(), ...base.split(/\s*[\/,]\s*/), ...base.split("-")].filter(Boolean);
  let result = null;
  let how = "exact";
  for (const v of [...new Set(variants)]) {
    const hit = list.find((c) => fold(c.name) === fold(v));
    if (hit) { result = { state: hit.state, city: hit.name }; break; }
    const places = gnByFold.get(`${cc}|${fold(v)}`);
    if (places) {
      const p = best(places);
      const inGeo = placeInGeo(country, p);
      result = inGeo ? { state: inGeo.state, city: inGeo.name } : addPlace(country, cc, p);
      if (v !== base) how = `part "${v}"`;
      break;
    }
  }
  if (!result) {
    // typo: closest GeoNames name of that country (edit distance), preferring bigger places
    const f = fold(base);
    let bestMatch = null;
    for (const p of gn) {
      if (p.cc !== cc) continue;
      for (const n of new Set([p.name, p.ascii])) {
        const d = levenshtein(f, fold(n));
        const limit = f.length >= 10 ? 2 : 1; // short names: only a single typo counts
        if (d <= limit && (!bestMatch || d < bestMatch.d || (d === bestMatch.d && p.pop > bestMatch.p.pop))) bestMatch = { d, p };
      }
    }
    if (!bestMatch) throw new Error(`Can't place "${rawCity}" (${country}) — add it to CITY_FIX`);
    const inGeo = placeInGeo(country, bestMatch.p);
    result = inGeo ? { state: inGeo.state, city: inGeo.name } : addPlace(country, cc, bestMatch.p);
    how = "typo";
  }
  if (how !== "exact") fuzzy.push([country, rawCity, `${result.city} (${result.state})`, how]);
  cityCache.set(key, result);
  return result;
}

// ------------------------------------------------------------------ location text -> country + city
function parseLocation(text) {
  const t = (text ?? "").replace(/­/g, "").replace(/\s+/g, " ").trim();
  let country = null;
  let rest = t;
  for (const [re, name] of COUNTRY_TOKEN) {
    const m = t.match(re);
    if (m) { country = name; rest = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length)).trim(); break; }
  }
  // "Hainburg." / "Geiselbach / Ufr." / "Alzenau, Alzenau" -> the first place name
  const city = rest.replace(/[.,;]+$/g, "").split(/\s*,\s*/)[0].replace(/\s*\/\s*Ufr\.?$/i, "").replace(/[.,;]+$/g, "").trim();
  return { country, city };
}

// ------------------------------------------------------------------ firms
const REPLIED = /no interest|not interested|kein|not now|dont|don't|need services|no further/i;
const OFFER = /\boffer\b/i;
const isoDate = (d) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

const firms = [];
const skipped = [];
const notes = []; // things worth telling the user
const seen = new Map();
let previous = { country: "Germany", sent_on: null };

for (const src of SOURCES) {
  const rows = JSON.parse(readFileSync(src.file, "utf8"));
  previous = { country: previous.country, sent_on: null };
  for (const r of rows) {
    let { country, city } = parseLocation(LOCATION_FIX[`${src.name}:${r.sno}`] ?? r.location);
    if (!city) { skipped.push({ src: src.name, sno: r.sno, reason: `no city ("${r.location}")` }); continue; }
    // Resolve the town in the country the PDF names; if it isn't there (or the PDF gives no country / a typo'd one),
    // try the row before's country and then the others — and say so.
    const stated = country;
    const order = [...new Set([stated, previous.country, ...Object.keys(COUNTRIES)].filter(Boolean))];
    let place = null;
    for (const c of order) {
      try { place = resolveCity(c, city); country = c; break; } catch { /* not in that country */ }
    }
    if (!place) { skipped.push({ src: src.name, sno: r.sno, reason: `"${city}" not found in any country` }); continue; }
    if (country !== stated) notes.push(`S.No ${r.sno} (${src.name}): location "${r.location}" says ${stated ?? "no country"} but the town is in ${country} — placed in ${country}`);

    const emails = (r.emails ?? []).filter((e) => EMAIL_OK.test(e));
    const badEmails = (r.emails ?? []).filter((e) => !EMAIL_OK.test(e));
    if (badEmails.length) notes.push(`S.No ${r.sno} (${src.name}): incomplete email dropped: ${badEmails.join(", ")}`);

    let name = fixText(r.company);
    let nameNote = "";
    if (!name && emails[0]) {
      // The PDF row has no company name at all; the email domain is the best label available.
      const label = emails[0].split("@")[1].split(".")[0].replace(/[-_]/g, " ");
      name = label.replace(/\b\w/g, (m) => m.toUpperCase());
      nameNote = "Company name missing in the PDF — taken from the email domain.";
      notes.push(`S.No ${r.sno} (${src.name}): no company name in the PDF, used "${name}" from the email domain`);
    }
    if (!name) { skipped.push({ src: src.name, sno: r.sno, reason: "no company name and no email" }); continue; }

    const dedupe = `${fold(name)}|${fold(place.city)}|${(emails[0] ?? "").toLowerCase()}`;
    const byEmail = emails[0] ? `${emails[0].toLowerCase()}|${fold(place.city)}` : null;
    if (seen.has(dedupe) || (byEmail && seen.has(byEmail))) {
      skipped.push({ src: src.name, sno: r.sno, reason: `already listed (${seen.get(dedupe) ?? seen.get(byEmail)})` });
      continue;
    }
    seen.set(dedupe, `${src.name} S.No ${r.sno}`);
    if (byEmail) seen.set(byEmail, `${src.name} S.No ${r.sno}`);

    const website = r.website && !/^https?:\/\//i.test(r.website) ? `https://${r.website}` : r.website;
    // Every hyphen inside an industry word ("Equip-ment", "Es-tate") is a PDF line-break artifact.
    const industry = fixText((r.industry ?? "").replace("Commercialreal es-tate", "Commercial real estate"))
      .replace(/(?<=[A-Za-z])-(?=[a-z])/g, "")
      .replace(/\s*\/\s*/g, " / ");
    const remark = fixText(r.remarks ?? "");
    const sent = r.sent_dates?.[0] ? isoDate(r.sent_dates[0]) : previous.sent_on; // one undated row: use the row before
    if (!r.sent_dates?.[0]) notes.push(`S.No ${r.sno} (${src.name}): no send date in the PDF, used ${sent} from the row before`);

    let status = "sent";
    if (remark && OFFER.test(remark)) status = "negotiation";
    else if (remark && REPLIED.test(remark)) status = "responded";

    const noteLines = [industry, remark, emails.length > 1 ? `More contacts: ${emails.slice(1).join(", ")}` : "", nameNote].filter(Boolean);
    firms.push({
      sno: r.sno,
      source: src.name,
      name,
      country,
      state: place.state,
      city: place.city,
      status,
      contact_email: emails[0] ?? null,
      website: website || null,
      notes: noteLines.join("\n") || null,
      sent_on: sent,
    });
    previous = { country, sent_on: sent ?? previous.sent_on };
  }
}

writeFileSync(OUT_FIRMS, JSON.stringify(firms, null, 1));

// ------------------------------------------------------------------ towns to add to the built-in list
const header = `// GENERATED by scripts/import-firms.mjs — towns that appear in the imported firm lists but were not in
// the built-in city list yet. Merged into GEO_DATA by geo.ts. Source: GeoNames (CC BY 4.0).
import type { CompactCity } from "./geo-generated";

`;
writeFileSync(OUT_GEO, `${header}export const CUSTOM_CITIES: Record<string, Record<string, CompactCity[]>> = ${JSON.stringify(added, null, 1)};\n`);

const count = (key) => firms.reduce((a, f) => ({ ...a, [f[key]]: (a[key ? f[key] : ""] ?? 0) + 1 }), {});
const tally = (key) => Object.entries(firms.reduce((a, f) => ((a[f[key]] = (a[f[key]] ?? 0) + 1), a), {})).map(([k, v]) => `${k}: ${v}`).join(", ");
console.log(`firms: ${firms.length} | skipped: ${skipped.length}`);
for (const s of skipped) console.log(`  skipped ${s.src} S.No ${s.sno}: ${s.reason}`);
console.log("by country:", tally("country"));
console.log("by status:", tally("status"));
console.log("by source:", tally("source"));
console.log("emailed on:", [...new Set(firms.map((f) => f.sent_on))].sort()[0], "to", [...new Set(firms.map((f) => f.sent_on))].sort().at(-1));
console.log(`cities used: ${new Set(firms.map((f) => `${f.country}|${f.state}|${f.city}`)).size}, towns added to the city list: ${Object.values(added).reduce((n, s) => n + Object.values(s).reduce((m, c) => m + c.length, 0), 0)}`);
console.log(`\nspelling variants / typos matched (${fuzzy.length}) — please eyeball:`);
for (const [c, raw, res, how] of fuzzy) console.log(`  ${c}: "${raw}" -> ${res}  [${how}]`);
console.log("\nnotes:");
for (const n of notes) console.log("  " + n);
