// Static reference data for the countries / states / cities this tool targets.
//
// This is intentionally a plain constant (not a DB table) — it changes rarely
// and doing it this way keeps the searchable dropdowns instant with no
// round-trip. Add more countries/states/cities here any time; nothing else
// needs to change.
//
// `iso2` matches the ISO 3166-1 alpha-2 code used by the world-atlas topojson
// consumed by the dashboard map (see components/dashboard/EuropeCountryMap).

import { EXTRA_CITIES, GENERATED_COUNTRIES, type CompactCity } from "./geo-generated";
import { CUSTOM_CITIES } from "./geo-custom";

export type CityRef = { name: string; lat: number; lng: number };
export type StateRef = { name: string; cities: CityRef[] };
export type CountryRef = { name: string; iso2: string; iso3: string; states: StateRef[] };

/** The hand-curated core markets. See GEO_DATA below for the full list. */
const CURATED_GEO: CountryRef[] = [
  {
    name: "Germany",
    iso2: "DE",
    iso3: "DEU",
    states: [
      { name: "Baden-Württemberg", cities: [
        { name: "Stuttgart", lat: 48.7758, lng: 9.1829 },
        { name: "Mannheim", lat: 49.4875, lng: 8.4660 },
        { name: "Karlsruhe", lat: 49.0069, lng: 8.4037 },
        { name: "Freiburg im Breisgau", lat: 47.9990, lng: 7.8421 },
        { name: "Heidelberg", lat: 49.3988, lng: 8.6724 },
        { name: "Heilbronn", lat: 49.1427, lng: 9.2109 },
        { name: "Ulm", lat: 48.4011, lng: 9.9876 },
        { name: "Pforzheim", lat: 48.8922, lng: 8.6946 },
        { name: "Reutlingen", lat: 48.4914, lng: 9.2043 },
        { name: "Esslingen am Neckar", lat: 48.7394, lng: 9.3089 },
        { name: "Ludwigsburg", lat: 48.8974, lng: 9.1916 },
        { name: "Tübingen", lat: 48.5216, lng: 9.0576 },
        { name: "Konstanz", lat: 47.6603, lng: 9.1758 },
        { name: "Villingen-Schwenningen", lat: 48.0622, lng: 8.4590 },
        { name: "Friedrichshafen", lat: 47.6549, lng: 9.4794 },
      ]},
      { name: "Bavaria", cities: [
        { name: "Munich", lat: 48.1351, lng: 11.5820 },
        { name: "Nuremberg", lat: 49.4521, lng: 11.0767 },
        { name: "Augsburg", lat: 48.3705, lng: 10.8978 },
        { name: "Würzburg", lat: 49.7913, lng: 9.9534 },
        { name: "Regensburg", lat: 49.0134, lng: 12.1016 },
        { name: "Ingolstadt", lat: 48.7665, lng: 11.4257 },
        { name: "Fürth", lat: 49.4778, lng: 10.9886 },
        { name: "Erlangen", lat: 49.5897, lng: 11.0040 },
        { name: "Bayreuth", lat: 49.9456, lng: 11.5713 },
        { name: "Bamberg", lat: 49.8988, lng: 10.9028 },
        { name: "Aschaffenburg", lat: 49.9769, lng: 9.1508 },
        { name: "Geiselbach", lat: 50.0650, lng: 9.1550 },
        { name: "Karlstein am Main", lat: 50.0380, lng: 9.1070 },
        { name: "Alzenau", lat: 50.0700, lng: 9.0610 },
        { name: "Landshut", lat: 48.5372, lng: 12.1522 },
        { name: "Kempten", lat: 47.7267, lng: 10.3130 },
        { name: "Rosenheim", lat: 47.8561, lng: 12.1289 },
        { name: "Passau", lat: 48.5665, lng: 13.4312 },
      ]},
      { name: "Berlin", cities: [{ name: "Berlin", lat: 52.5200, lng: 13.4050 }] },
      { name: "Brandenburg", cities: [
        { name: "Potsdam", lat: 52.3906, lng: 13.0645 },
        { name: "Cottbus", lat: 51.7563, lng: 14.3329 },
        { name: "Brandenburg an der Havel", lat: 52.4125, lng: 12.5316 },
        { name: "Frankfurt (Oder)", lat: 52.3412, lng: 14.5510 },
      ]},
      { name: "Bremen", cities: [
        { name: "Bremen", lat: 53.0793, lng: 8.8017 },
        { name: "Bremerhaven", lat: 53.5396, lng: 8.5809 },
      ]},
      { name: "Hamburg", cities: [{ name: "Hamburg", lat: 53.5511, lng: 9.9937 }] },
      { name: "Hesse", cities: [
        { name: "Frankfurt am Main", lat: 50.1109, lng: 8.6821 },
        { name: "Wiesbaden", lat: 50.0782, lng: 8.2398 },
        { name: "Kassel", lat: 51.3127, lng: 9.4797 },
        { name: "Darmstadt", lat: 49.8728, lng: 8.6512 },
        { name: "Offenbach am Main", lat: 50.0956, lng: 8.7761 },
        { name: "Hanau", lat: 50.1310, lng: 8.9165 },
        { name: "Marburg", lat: 50.8021, lng: 8.7669 },
        { name: "Gießen", lat: 50.5841, lng: 8.6779 },
        { name: "Fulda", lat: 50.5558, lng: 9.6808 },
        { name: "Hasselroth", lat: 50.1520, lng: 9.2020 },
        { name: "Langenselbold", lat: 50.1800, lng: 9.0430 },
        { name: "Freigericht", lat: 50.1470, lng: 9.1520 },
        { name: "Linsengericht", lat: 50.1800, lng: 9.2130 },
        { name: "Gelnhausen", lat: 50.2010, lng: 9.1910 },
        { name: "Wächtersbach", lat: 50.2560, lng: 9.2890 },
        { name: "Gründau", lat: 50.2110, lng: 9.1150 },
        { name: "Maintal", lat: 50.1570, lng: 8.8330 },
        { name: "Seligenstadt", lat: 50.0450, lng: 8.9720 },
        { name: "Mainhausen", lat: 50.0210, lng: 8.9530 },
        { name: "Hainburg", lat: 50.0380, lng: 8.9170 },
        { name: "Rodgau", lat: 50.0190, lng: 8.8880 },
        { name: "Dietzenbach", lat: 50.0100, lng: 8.7770 },
        { name: "Heusenstamm", lat: 50.0520, lng: 8.8080 },
        { name: "Rödermark", lat: 49.9880, lng: 8.7880 },
        { name: "Obertshausen", lat: 50.0550, lng: 8.8380 },
        { name: "Mühlheim am Main", lat: 50.1170, lng: 8.8330 },
        { name: "Witzenhausen", lat: 51.3390, lng: 9.8590 },
        { name: "Wabern", lat: 51.1080, lng: 9.3610 },
        { name: "Bad Camberg", lat: 50.2940, lng: 8.2570 },
        { name: "Lübbecke", lat: 52.3080, lng: 8.6180 },
      ]},
      { name: "Lower Saxony", cities: [
        { name: "Hanover", lat: 52.3759, lng: 9.7320 },
        { name: "Braunschweig", lat: 52.2689, lng: 10.5268 },
        { name: "Oldenburg", lat: 53.1435, lng: 8.2146 },
        { name: "Osnabrück", lat: 52.2799, lng: 8.0472 },
        { name: "Wolfsburg", lat: 52.4227, lng: 10.7865 },
        { name: "Göttingen", lat: 51.5413, lng: 9.9158 },
        { name: "Salzgitter", lat: 52.1508, lng: 10.3319 },
        { name: "Hildesheim", lat: 52.1508, lng: 9.9511 },
        { name: "Celle", lat: 52.6234, lng: 10.0825 },
        { name: "Lüneburg", lat: 53.2500, lng: 10.4141 },
      ]},
      { name: "Mecklenburg-Vorpommern", cities: [
        { name: "Rostock", lat: 54.0887, lng: 12.1400 },
        { name: "Schwerin", lat: 53.6355, lng: 11.4012 },
        { name: "Neubrandenburg", lat: 53.5577, lng: 13.2610 },
        { name: "Stralsund", lat: 54.3097, lng: 13.0818 },
        { name: "Greifswald", lat: 54.0925, lng: 13.3881 },
      ]},
      { name: "North Rhine-Westphalia", cities: [
        { name: "Cologne", lat: 50.9375, lng: 6.9603 },
        { name: "Düsseldorf", lat: 51.2277, lng: 6.7735 },
        { name: "Dortmund", lat: 51.5136, lng: 7.4653 },
        { name: "Essen", lat: 51.4556, lng: 7.0116 },
        { name: "Duisburg", lat: 51.4344, lng: 6.7623 },
        { name: "Bochum", lat: 51.4818, lng: 7.2162 },
        { name: "Wuppertal", lat: 51.2562, lng: 7.1508 },
        { name: "Bielefeld", lat: 52.0302, lng: 8.5325 },
        { name: "Bonn", lat: 50.7374, lng: 7.0982 },
        { name: "Münster", lat: 51.9607, lng: 7.6261 },
        { name: "Mönchengladbach", lat: 51.1805, lng: 6.4428 },
        { name: "Gelsenkirchen", lat: 51.5177, lng: 7.0857 },
        { name: "Aachen", lat: 50.7753, lng: 6.0839 },
        { name: "Krefeld", lat: 51.3388, lng: 6.5853 },
        { name: "Oberhausen", lat: 51.4963, lng: 6.8638 },
        { name: "Hagen", lat: 51.3670, lng: 7.4633 },
        { name: "Hamm", lat: 51.6806, lng: 7.8206 },
        { name: "Leverkusen", lat: 51.0459, lng: 6.9847 },
        { name: "Paderborn", lat: 51.7189, lng: 8.7544 },
        { name: "Recklinghausen", lat: 51.6142, lng: 7.1978 },
        { name: "Solingen", lat: 51.1652, lng: 7.0671 },
        { name: "Herne", lat: 51.5386, lng: 7.2260 },
        { name: "Neuss", lat: 51.2042, lng: 6.6879 },
        { name: "Herzogenrath", lat: 50.8710, lng: 6.0860 },
        { name: "Alsdorf", lat: 50.8760, lng: 6.1700 },
        { name: "Eschweiler", lat: 50.8160, lng: 6.2680 },
        { name: "Stolberg", lat: 50.7710, lng: 6.2340 },
        { name: "Baesweiler", lat: 50.9050, lng: 6.1870 },
        { name: "Übach-Palenberg", lat: 50.9280, lng: 6.1070 },
        { name: "Geilenkirchen", lat: 50.9660, lng: 6.1270 },
        { name: "Heinsberg", lat: 51.0610, lng: 6.0980 },
        { name: "Wassenberg", lat: 51.1080, lng: 6.1560 },
        { name: "Wegberg", lat: 51.1480, lng: 6.2790 },
        { name: "Niederkrüchten", lat: 51.2260, lng: 6.2300 },
        { name: "Brüggen", lat: 51.2430, lng: 6.1690 },
        { name: "Nettetal", lat: 51.3170, lng: 6.2790 },
        { name: "Straelen", lat: 51.4430, lng: 6.2670 },
        { name: "Geldern", lat: 51.5170, lng: 6.3230 },
        { name: "Kevelaer", lat: 51.5830, lng: 6.2450 },
        { name: "Weeze", lat: 51.6280, lng: 6.2130 },
        { name: "Goch", lat: 51.6830, lng: 6.1570 },
        { name: "Kranenburg", lat: 51.7830, lng: 6.0100 },
        { name: "Kleve", lat: 51.7880, lng: 6.1390 },
        { name: "Bedburg-Hau", lat: 51.7510, lng: 6.1640 },
        { name: "Xanten", lat: 51.6600, lng: 6.4540 },
        { name: "Rees", lat: 51.7570, lng: 6.3970 },
        { name: "Emmerich am Rhein", lat: 51.8340, lng: 6.2440 },
        { name: "Wesel", lat: 51.6580, lng: 6.6180 },
        { name: "Hamminkeln", lat: 51.7400, lng: 6.5930 },
        { name: "Bocholt", lat: 51.8380, lng: 6.6140 },
        { name: "Borken", lat: 51.8440, lng: 6.8580 },
        { name: "Dorsten", lat: 51.6600, lng: 6.9650 },
        { name: "Marl", lat: 51.6560, lng: 7.0890 },
        { name: "Castrop-Rauxel", lat: 51.5560, lng: 7.3120 },
        { name: "Lünen", lat: 51.6160, lng: 7.5290 },
        { name: "Unna", lat: 51.5350, lng: 7.6870 },
        { name: "Schwerte", lat: 51.4510, lng: 7.5640 },
        { name: "Iserlohn", lat: 51.3770, lng: 7.6960 },
        { name: "Menden", lat: 51.4360, lng: 7.7980 },
        { name: "Coesfeld", lat: 51.9440, lng: 7.1690 },
        { name: "Dülmen", lat: 51.8260, lng: 7.2810 },
        { name: "Kalkar", lat: 51.7440, lng: 6.2940 },
        { name: "Mülheim an der Ruhr", lat: 51.4300, lng: 6.8800 },
      ]},
      { name: "Rhineland-Palatinate", cities: [
        { name: "Mainz", lat: 49.9929, lng: 8.2473 },
        { name: "Ludwigshafen am Rhein", lat: 49.4741, lng: 8.4340 },
        { name: "Koblenz", lat: 50.3569, lng: 7.5890 },
        { name: "Trier", lat: 49.7596, lng: 6.6441 },
        { name: "Kaiserslautern", lat: 49.4400, lng: 7.7491 },
        { name: "Worms", lat: 49.6321, lng: 8.3576 },
      ]},
      { name: "Saarland", cities: [
        { name: "Saarbrücken", lat: 49.2401, lng: 6.9969 },
        { name: "Neunkirchen", lat: 49.3467, lng: 7.1794 },
      ]},
      { name: "Saxony", cities: [
        { name: "Leipzig", lat: 51.3397, lng: 12.3731 },
        { name: "Dresden", lat: 51.0504, lng: 13.7373 },
        { name: "Chemnitz", lat: 50.8278, lng: 12.9214 },
        { name: "Zwickau", lat: 50.7189, lng: 12.4970 },
        { name: "Plauen", lat: 50.4948, lng: 12.1372 },
        { name: "Görlitz", lat: 51.1529, lng: 14.9860 },
      ]},
      { name: "Saxony-Anhalt", cities: [
        { name: "Magdeburg", lat: 52.1205, lng: 11.6276 },
        { name: "Halle (Saale)", lat: 51.4969, lng: 11.9688 },
        { name: "Dessau-Roßlau", lat: 51.8398, lng: 12.2415 },
      ]},
      { name: "Schleswig-Holstein", cities: [
        { name: "Kiel", lat: 54.3233, lng: 10.1228 },
        { name: "Lübeck", lat: 53.8655, lng: 10.6866 },
        { name: "Flensburg", lat: 54.7937, lng: 9.4464 },
        { name: "Neumünster", lat: 54.0728, lng: 9.9822 },
      ]},
      { name: "Thuringia", cities: [
        { name: "Erfurt", lat: 50.9848, lng: 11.0299 },
        { name: "Jena", lat: 50.9271, lng: 11.5892 },
        { name: "Gera", lat: 50.8802, lng: 12.0813 },
        { name: "Weimar", lat: 50.9795, lng: 11.3235 },
      ]},
    ],
  },
  {
    name: "France",
    iso2: "FR",
    iso3: "FRA",
    states: [
      { name: "Île-de-France", cities: [
        { name: "Paris", lat: 48.8566, lng: 2.3522 },
        { name: "Versailles", lat: 48.8049, lng: 2.1204 },
      ]},
      { name: "Auvergne-Rhône-Alpes", cities: [
        { name: "Lyon", lat: 45.7640, lng: 4.8357 },
        { name: "Grenoble", lat: 45.1885, lng: 5.7245 },
        { name: "Saint-Étienne", lat: 45.4397, lng: 4.3872 },
        { name: "Clermont-Ferrand", lat: 45.7772, lng: 3.0870 },
      ]},
      { name: "Provence-Alpes-Côte d'Azur", cities: [
        { name: "Marseille", lat: 43.2965, lng: 5.3698 },
        { name: "Nice", lat: 43.7102, lng: 7.2620 },
        { name: "Toulon", lat: 43.1242, lng: 5.9280 },
        { name: "Avignon", lat: 43.9493, lng: 4.8055 },
        { name: "Aix-en-Provence", lat: 43.5297, lng: 5.4474 },
      ]},
      { name: "Nouvelle-Aquitaine", cities: [
        { name: "Bordeaux", lat: 44.8378, lng: -0.5792 },
        { name: "Limoges", lat: 45.8336, lng: 1.2611 },
        { name: "Poitiers", lat: 46.5802, lng: 0.3404 },
      ]},
      { name: "Occitanie", cities: [
        { name: "Toulouse", lat: 43.6047, lng: 1.4442 },
        { name: "Montpellier", lat: 43.6108, lng: 3.8767 },
        { name: "Perpignan", lat: 42.6887, lng: 2.8948 },
        { name: "Nîmes", lat: 43.8367, lng: 4.3601 },
      ]},
      { name: "Hauts-de-France", cities: [
        { name: "Lille", lat: 50.6292, lng: 3.0573 },
        { name: "Amiens", lat: 49.8941, lng: 2.2958 },
      ]},
      { name: "Grand Est", cities: [
        { name: "Strasbourg", lat: 48.5734, lng: 7.7521 },
        { name: "Reims", lat: 49.2583, lng: 4.0317 },
        { name: "Metz", lat: 49.1193, lng: 6.1757 },
        { name: "Nancy", lat: 48.6921, lng: 6.1844 },
        { name: "Mulhouse", lat: 47.7508, lng: 7.3359 },
      ]},
      { name: "Pays de la Loire", cities: [
        { name: "Nantes", lat: 47.2184, lng: -1.5536 },
        { name: "Angers", lat: 47.4784, lng: -0.5632 },
      ]},
      { name: "Brittany", cities: [{ name: "Rennes", lat: 48.1173, lng: -1.6778 }] },
      { name: "Normandy", cities: [
        { name: "Rouen", lat: 49.4431, lng: 1.0993 },
        { name: "Le Havre", lat: 49.4944, lng: 0.1079 },
        { name: "Caen", lat: 49.1829, lng: -0.3707 },
      ]},
      { name: "Bourgogne-Franche-Comté", cities: [
        { name: "Dijon", lat: 47.3220, lng: 5.0415 },
        { name: "Besançon", lat: 47.2378, lng: 6.0241 },
      ]},
      { name: "Centre-Val de Loire", cities: [
        { name: "Tours", lat: 47.3941, lng: 0.6848 },
        { name: "Orléans", lat: 47.9029, lng: 1.9093 },
      ]},
    ],
  },
  {
    name: "Belgium",
    iso2: "BE",
    iso3: "BEL",
    states: [
      { name: "Brussels-Capital Region", cities: [{ name: "Brussels", lat: 50.8503, lng: 4.3517 }] },
      { name: "Flanders", cities: [
        { name: "Antwerp", lat: 51.2194, lng: 4.4025 },
        { name: "Ghent", lat: 51.0543, lng: 3.7174 },
        { name: "Bruges", lat: 51.2093, lng: 3.2247 },
        { name: "Leuven", lat: 50.8798, lng: 4.7005 },
        { name: "Aalst", lat: 50.9378, lng: 4.0356 },
        { name: "Hasselt", lat: 50.9307, lng: 5.3378 },
        { name: "Kortrijk", lat: 50.8280, lng: 3.2648 },
        { name: "Ostend", lat: 51.2154, lng: 2.9286 },
      ]},
      { name: "Wallonia", cities: [
        { name: "Liège", lat: 50.6326, lng: 5.5797 },
        { name: "Charleroi", lat: 50.4108, lng: 4.4446 },
        { name: "Namur", lat: 50.4669, lng: 4.8675 },
        { name: "Mons", lat: 50.4542, lng: 3.9563 },
        { name: "La Louvière", lat: 50.4790, lng: 4.1875 },
      ]},
    ],
  },
  {
    name: "Finland",
    iso2: "FI",
    iso3: "FIN",
    states: [
      { name: "Uusimaa", cities: [
        { name: "Helsinki", lat: 60.1699, lng: 24.9384 },
        { name: "Espoo", lat: 60.2055, lng: 24.6559 },
        { name: "Vantaa", lat: 60.2934, lng: 25.0378 },
        { name: "Porvoo", lat: 60.3931, lng: 25.6636 },
        { name: "Hyvinkää", lat: 60.6306, lng: 24.8594 },
        { name: "Lohja", lat: 60.2500, lng: 24.0667 },
      ]},
      { name: "Pirkanmaa", cities: [{ name: "Tampere", lat: 61.4978, lng: 23.7610 }] },
      { name: "Southwest Finland", cities: [
        { name: "Turku", lat: 60.4518, lng: 22.2666 },
        { name: "Salo", lat: 60.3839, lng: 23.1250 },
      ]},
      { name: "Northern Ostrobothnia", cities: [
        { name: "Oulu", lat: 65.0121, lng: 25.4651 },
        { name: "Raahe", lat: 64.6833, lng: 24.4833 },
      ]},
      { name: "Central Finland", cities: [{ name: "Jyväskylä", lat: 62.2426, lng: 25.7473 }] },
      { name: "Päijät-Häme", cities: [{ name: "Lahti", lat: 60.9827, lng: 25.6612 }] },
      { name: "Northern Savonia", cities: [
        { name: "Kuopio", lat: 62.8924, lng: 27.6770 },
        { name: "Iisalmi", lat: 63.5614, lng: 27.1900 },
      ]},
      { name: "South Karelia", cities: [
        { name: "Lappeenranta", lat: 61.0587, lng: 28.1887 },
        { name: "Imatra", lat: 61.1719, lng: 28.7561 },
      ]},
      { name: "Ostrobothnia", cities: [
        { name: "Vaasa", lat: 63.0951, lng: 21.6165 },
        { name: "Pietarsaari", lat: 63.6742, lng: 22.7003 },
      ]},
      { name: "North Karelia", cities: [{ name: "Joensuu", lat: 62.6010, lng: 29.7636 }] },
      { name: "Kymenlaakso", cities: [
        { name: "Kotka", lat: 60.4664, lng: 26.9458 },
        { name: "Hamina", lat: 60.5651, lng: 27.1981 },
        { name: "Kouvola", lat: 60.8681, lng: 26.7042 },
      ]},
      { name: "Lapland", cities: [
        { name: "Rovaniemi", lat: 66.5039, lng: 25.7294 },
        { name: "Kemi", lat: 65.7365, lng: 24.5637 },
        { name: "Tornio", lat: 65.8481, lng: 24.1447 },
      ]},
      { name: "Kainuu", cities: [{ name: "Kajaani", lat: 64.2273, lng: 27.7285 }] },
      { name: "Central Ostrobothnia", cities: [{ name: "Kokkola", lat: 63.8384, lng: 23.1307 }] },
      { name: "South Ostrobothnia", cities: [{ name: "Seinäjoki", lat: 62.7903, lng: 22.8403 }] },
      { name: "Satakunta", cities: [
        { name: "Pori", lat: 61.4847, lng: 21.7972 },
        { name: "Rauma", lat: 61.1279, lng: 21.5111 },
      ]},
      { name: "Kanta-Häme", cities: [
        { name: "Hämeenlinna", lat: 60.9959, lng: 24.4643 },
        { name: "Riihimäki", lat: 60.7385, lng: 24.7770 },
        { name: "Forssa", lat: 60.8167, lng: 23.6167 },
      ]},
      { name: "Southern Savonia", cities: [
        { name: "Mikkeli", lat: 61.6886, lng: 27.2723 },
        { name: "Savonlinna", lat: 61.8681, lng: 28.8789 },
      ]},
    ],
  },
  {
    name: "Sweden",
    iso2: "SE",
    iso3: "SWE",
    states: [
      { name: "Stockholm County", cities: [{ name: "Stockholm", lat: 59.3293, lng: 18.0686 }] },
      { name: "Västra Götaland County", cities: [{ name: "Gothenburg", lat: 57.7089, lng: 11.9746 }] },
      { name: "Skåne County", cities: [
        { name: "Malmö", lat: 55.6050, lng: 13.0038 },
        { name: "Helsingborg", lat: 56.0465, lng: 12.6945 },
        { name: "Lund", lat: 55.7047, lng: 13.1910 },
      ]},
      { name: "Uppsala County", cities: [{ name: "Uppsala", lat: 59.8586, lng: 17.6389 }] },
      { name: "Örebro County", cities: [{ name: "Örebro", lat: 59.2753, lng: 15.2134 }] },
      { name: "Östergötland County", cities: [
        { name: "Linköping", lat: 58.4108, lng: 15.6214 },
        { name: "Norrköping", lat: 58.5877, lng: 16.1924 },
      ]},
      { name: "Västmanland County", cities: [{ name: "Västerås", lat: 59.6099, lng: 16.5448 }] },
      { name: "Jönköping County", cities: [{ name: "Jönköping", lat: 57.7826, lng: 14.1618 }] },
      { name: "Västerbotten County", cities: [{ name: "Umeå", lat: 63.8258, lng: 20.2630 }] },
    ],
  },
  {
    name: "Italy",
    iso2: "IT",
    iso3: "ITA",
    states: [
      { name: "Lazio", cities: [{ name: "Rome", lat: 41.9028, lng: 12.4964 }] },
      { name: "Lombardy", cities: [
        { name: "Milan", lat: 45.4642, lng: 9.1900 },
        { name: "Bergamo", lat: 45.6983, lng: 9.6773 },
      ]},
      { name: "Campania", cities: [{ name: "Naples", lat: 40.8518, lng: 14.2681 }] },
      { name: "Piedmont", cities: [{ name: "Turin", lat: 45.0703, lng: 7.6869 }] },
      { name: "Veneto", cities: [
        { name: "Venice", lat: 45.4408, lng: 12.3155 },
        { name: "Verona", lat: 45.4384, lng: 10.9916 },
        { name: "Padua", lat: 45.4064, lng: 11.8768 },
      ]},
      { name: "Tuscany", cities: [{ name: "Florence", lat: 43.7696, lng: 11.2558 }] },
      { name: "Sicily", cities: [
        { name: "Palermo", lat: 38.1157, lng: 13.3615 },
        { name: "Catania", lat: 37.5079, lng: 15.0830 },
      ]},
      { name: "Emilia-Romagna", cities: [
        { name: "Bologna", lat: 44.4949, lng: 11.3426 },
        { name: "Parma", lat: 44.8015, lng: 10.3279 },
        { name: "Modena", lat: 44.6471, lng: 10.9252 },
      ]},
      { name: "Liguria", cities: [{ name: "Genoa", lat: 44.4056, lng: 8.9463 }] },
      { name: "Apulia", cities: [{ name: "Bari", lat: 41.1171, lng: 16.8719 }] },
      { name: "Friuli Venezia Giulia", cities: [{ name: "Trieste", lat: 45.6495, lng: 13.7768 }] },
    ],
  },
  {
    name: "Austria",
    iso2: "AT",
    iso3: "AUT",
    states: [
      { name: "Vienna", cities: [{ name: "Vienna", lat: 48.2082, lng: 16.3738 }] },
      { name: "Upper Austria", cities: [
        { name: "Linz", lat: 48.3069, lng: 14.2858 },
        { name: "Wels", lat: 48.1575, lng: 14.0289 },
        { name: "Steyr", lat: 48.0397, lng: 14.4210 },
        { name: "Braunau am Inn", lat: 48.2578, lng: 13.0397 },
        { name: "Traun", lat: 48.2211, lng: 14.2350 },
      ]},
      { name: "Lower Austria", cities: [
        { name: "St. Pölten", lat: 48.2047, lng: 15.6256 },
        { name: "Krems an der Donau", lat: 48.4103, lng: 15.6136 },
        { name: "Amstetten", lat: 48.1225, lng: 14.8722 },
      ]},
      { name: "Styria", cities: [
        { name: "Graz", lat: 47.0707, lng: 15.4395 },
        { name: "Bruck an der Mur", lat: 47.4139, lng: 15.2686 },
        { name: "Leoben", lat: 47.3809, lng: 15.0946 },
      ]},
      { name: "Salzburg", cities: [{ name: "Salzburg", lat: 47.8095, lng: 13.0550 }] },
      { name: "Tyrol", cities: [
        { name: "Innsbruck", lat: 47.2692, lng: 11.4041 },
        { name: "Wörgl", lat: 47.4831, lng: 12.0653 },
        { name: "Lienz", lat: 46.8281, lng: 12.7683 },
      ]},
      { name: "Carinthia", cities: [
        { name: "Klagenfurt", lat: 46.6249, lng: 14.3050 },
        { name: "Villach", lat: 46.6111, lng: 13.8558 },
      ]},
      { name: "Vorarlberg", cities: [
        { name: "Bregenz", lat: 47.5031, lng: 9.7471 },
        { name: "Dornbirn", lat: 47.4125, lng: 9.7417 },
        { name: "Feldkirch", lat: 47.2411, lng: 9.5981 },
      ]},
    ],
  },
  {
    name: "Netherlands",
    iso2: "NL",
    iso3: "NLD",
    states: [
      { name: "Limburg", cities: [
        { name: "Venlo", lat: 51.3704, lng: 6.1724 },
        { name: "Venray", lat: 51.5264, lng: 5.9764 },
      ]},
      { name: "South Holland", cities: [
        { name: "Rotterdam", lat: 51.9244, lng: 4.4777 },
        { name: "The Hague", lat: 52.0705, lng: 4.3007 },
        { name: "Gouda", lat: 52.0116, lng: 4.7106 },
        { name: "Dordrecht", lat: 51.8133, lng: 4.6901 },
        { name: "Moerdijk", lat: 51.7075, lng: 4.6117 },
      ]},
      { name: "North Brabant", cities: [
        { name: "Breda", lat: 51.5719, lng: 4.7683 },
        { name: "Eindhoven", lat: 51.4416, lng: 5.4697 },
        { name: "Helmond", lat: 51.4793, lng: 5.6570 },
        { name: "Tilburg", lat: 51.5555, lng: 5.0913 },
        { name: "Waalwijk", lat: 51.6900, lng: 5.0714 },
        { name: "'s-Hertogenbosch", lat: 51.6978, lng: 5.3037 },
      ]},
    ],
  },
];

const expand = (cities: readonly CompactCity[]): CityRef[] => cities.map(([name, lat, lng]) => ({ name, lat, lng }));

/**
 * Every EU country: the hand-curated markets above (plus any larger city they were still
 * missing) and the rest of the EU-27 from scripts/build-geo-data.mjs (GeoNames: all cities
 * and towns of 15,000+ inhabitants, 5,000+ for the smallest countries). Alphabetical.
 */
/** Adds cities per region to a country's states; regions the base list doesn't have become new states. */
function mergeStates(base: StateRef[], additions: Record<string, readonly CompactCity[]> | undefined): StateRef[] {
  if (!additions) return base;
  // A city name is only added once per country (the hand-curated entry wins).
  const known = new Set(base.flatMap((s) => s.cities.map((c) => c.name.toLowerCase())));
  const fresh = (cities: readonly CompactCity[]) =>
    expand(cities.filter(([name]) => !known.has(name.toLowerCase()) && known.add(name.toLowerCase())));
  const merged = base.map((state) => {
    const add = additions[state.name];
    return add ? { ...state, cities: [...state.cities, ...fresh(add)] } : state;
  });
  const have = new Set(base.map((s) => s.name));
  for (const [name, cities] of Object.entries(additions)) {
    if (!have.has(name)) merged.push({ name, cities: fresh(cities) });
  }
  return merged.filter((s) => s.cities.length > 0).sort((a, b) => a.name.localeCompare(b.name));
}

export const GEO_DATA: CountryRef[] = [
  ...CURATED_GEO.map((country) => ({
    ...country,
    states: mergeStates(mergeStates(country.states, EXTRA_CITIES[country.name]), CUSTOM_CITIES[country.name]),
  })),
  ...GENERATED_COUNTRIES.map((c) => ({
    name: c.name,
    iso2: c.iso2,
    iso3: c.iso3,
    states: mergeStates(
      c.states.map((s) => ({ name: s.name, cities: expand(s.cities) })),
      CUSTOM_CITIES[c.name]
    ),
  })),
].sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_NAMES = GEO_DATA.map((c) => c.name);

/** ISO2 codes in the same order as GEO_DATA, for compact flag-style chips in the UI. */
export const COUNTRY_CODES = GEO_DATA.map((c) => c.iso2);

/** ISO2 -> flag emoji (regional indicator symbols), and a lookup by country name. */
function flagEmoji(iso2: string) {
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}
export const COUNTRY_FLAG: Record<string, string> = Object.fromEntries(
  GEO_DATA.map((c) => [c.name, flagEmoji(c.iso2)])
);

/** ISO 3166-1 numeric codes — match the `id` field in the world-atlas topojson used by the dashboard map. */
export const COUNTRY_NUMERIC_ID: Record<string, string> = {
  Germany: "276",
  France: "250",
  Belgium: "056",
  Finland: "246",
  Sweden: "752",
  Italy: "380",
  Austria: "040",
  Netherlands: "528",
  Bulgaria: "100",
  Croatia: "191",
  Cyprus: "196",
  Czechia: "203",
  Denmark: "208",
  Estonia: "233",
  Greece: "300",
  Hungary: "348",
  Ireland: "372",
  Latvia: "428",
  Lithuania: "440",
  Luxembourg: "442",
  Malta: "470",
  Poland: "616",
  Portugal: "620",
  Romania: "642",
  Slovakia: "703",
  Slovenia: "705",
  Spain: "724",
};

export function findCountry(name: string) {
  return GEO_DATA.find((c) => c.name === name);
}

export function findState(countryName: string, stateName: string) {
  return findCountry(countryName)?.states.find((s) => s.name === stateName);
}

/** Look up a city by name across all countries — used to auto-fill state/country. */
export function findCityGlobally(cityName: string) {
  for (const country of GEO_DATA) {
    for (const state of country.states) {
      const city = state.cities.find((c) => c.name.toLowerCase() === cityName.toLowerCase());
      if (city) return { country: country.name, state: state.name, city };
    }
  }
  return null;
}

/** Resolves a city's state within one specific country (case-insensitive) — used by bulk firm import, where a source list has city + country but no state column. */
export function findStateForCity(countryName: string, cityName: string): string | null {
  const country = findCountry(countryName);
  if (!country) return null;
  const target = cityName.trim().toLowerCase();
  for (const state of country.states) {
    if (state.cities.some((c) => c.name.toLowerCase() === target)) return state.name;
  }
  return null;
}

export function citiesForCountry(countryName: string): (CityRef & { state: string })[] {
  const country = findCountry(countryName);
  if (!country) return [];
  return country.states.flatMap((s) => s.cities.map((c) => ({ ...c, state: s.name })));
}

/** Flat list of every city across every target country, for the firm search dropdown. */
export const ALL_CITIES = GEO_DATA.flatMap((country) =>
  country.states.flatMap((state) =>
    state.cities.map((city) => ({
      ...city,
      state: state.name,
      country: country.name,
      label: `${city.name}, ${state.name}, ${country.name}`,
    }))
  )
);
