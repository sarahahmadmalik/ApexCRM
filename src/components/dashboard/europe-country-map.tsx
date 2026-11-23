"use client";

import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { geoMercator } from "d3-geo";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import { COUNTRY_NUMERIC_ID, citiesForCountry } from "@/lib/data/geo";
import { CITY_CLIENT_HEX, CITY_STATUS_HEX } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import type { CityManualStatus } from "@/lib/types/database";

type CityStatusMap = Record<string, CityManualStatus>; // key: "state|city"

/**
 * Country outlines include far-away territories (Canary Islands, Madeira, the Azores,
 * French Guiana, ...). Keep only the parts that sit in mainland Europe so the map zooms
 * to the country instead of the whole globe.
 */
function mainlandOnly(feature: Feature<Geometry>): Feature<Geometry> {
  if (feature.geometry.type !== "MultiPolygon") return feature;
  const inEurope = (polygon: Polygon["coordinates"]) => {
    const ring = polygon[0];
    const lng = ring.reduce((n, p) => n + p[0], 0) / ring.length;
    const lat = ring.reduce((n, p) => n + p[1], 0) / ring.length;
    return lng > -12 && lng < 45 && lat > 34 && lat < 72;
  };
  const kept = (feature.geometry as MultiPolygon).coordinates.filter(inEurope);
  if (kept.length === 0 || kept.length === (feature.geometry as MultiPolygon).coordinates.length) return feature;
  return { ...feature, geometry: { type: "MultiPolygon", coordinates: kept } };
}

const WIDTH = 640;
const HEIGHT = 520;

export function EuropeCountryMap({
  country,
  cityStatuses,
  clientCities,
  selectedCity,
  onCitySelect,
}: {
  country: string;
  cityStatuses: CityStatusMap;
  /** "state|city" keys of cities with at least one client firm — drawn blue, taking priority over the status color. */
  clientCities?: Set<string>;
  selectedCity?: { state: string; city: string } | null;
  onCitySelect?: (city: { state: string; city: string }) => void;
}) {
  const [topology, setTopology] = useState<Topology | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const landFill = isDark ? "#1e293b" : "#eef2f7";
  const landHoverFill = isDark ? "#293548" : "#e2e8f0";
  const landStroke = isDark ? "#334155" : "#cbd5e1";
  const markerRingFill = isDark ? "#0f172a" : "#ffffff";

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries-50m.json")
      .then((res) => res.json())
      .then((data: Topology) => !cancelled && setTopology(data));
    return () => {
      cancelled = true;
    };
  }, []);

  const feature = useMemo(() => {
    if (!topology) return null;
    const id = COUNTRY_NUMERIC_ID[country];
    const collection = topojson.feature(
      topology,
      topology.objects.countries as GeometryCollection
    ) as unknown as { features: Feature<Geometry>[] };
    const found = collection.features.find((f) => f.id?.toString().padStart(3, "0") === id);
    return found ? mainlandOnly(found) : null;
  }, [topology, country]);

  const projection = useMemo(() => {
    const proj = geoMercator();
    if (feature) {
      proj.fitExtent(
        [
          [24, 24],
          [WIDTH - 24, HEIGHT - 24],
        ],
        feature
      );
    }
    return proj;
  }, [feature]);

  // Only cities with something going on are plotted (in progress, completed, or a client won) — plus
  // whichever city is currently selected — so the map isn't a wall of empty "not started" dots.
  const visibleCities = citiesForCountry(country).filter((city) => {
    const key = `${city.state}|${city.name}`;
    const isSelected = selectedCity?.state === city.state && selectedCity?.city === city.name;
    return (cityStatuses[key] ?? "not_started") !== "not_started" || (clientCities?.has(key) ?? false) || isSelected;
  });

  if (!topology || !feature) {
    return (
      <div className="flex h-[520px] items-center justify-center text-sm text-gray-400">
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative">
    <ComposableMap
      width={WIDTH}
      height={HEIGHT}
      // react-simple-maps accepts a pre-configured d3 projection instance directly
      // (it checks `typeof projection === "function"` and uses it as-is) even
      // though its bundled types only describe the factory-function form.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      projection={projection as any}
      className="mx-auto w-full max-w-2xl"
    >
      {/* react-simple-maps' bundled types don't line up with the actual
          runtime API (it happily takes a raw Topology object and per-feature
          objects with an attached `svgPath`), so this section leans on `any`
          rather than fighting the type-only mismatch. */}
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      {/* Only the (mainland) country itself is drawn, from the feature filtered above. */}
      <Geographies geography={{ type: "FeatureCollection", features: [feature] } as any}>
        {({ geographies }: { geographies: any[] }) =>
          (geographies as (Feature<Geometry> & { rsmKey: string })[]).map((geo) => (
            // react-simple-maps v5 dropped the old `style={{ default, hover, pressed }}`
            // API — Geography now just takes plain SVG props (fill/stroke/style),
            // with actual hover handled via onMouseEnter/onMouseLeave below.
            <Geography
              key={geo.rsmKey}
              geography={geo as any}
              fill={landFill}
              stroke={landStroke}
              strokeWidth={0.75}
              style={{ outline: "none" }}
              onMouseEnter={(e: React.MouseEvent<SVGPathElement>) => {
                e.currentTarget.setAttribute("fill", landHoverFill);
              }}
              onMouseLeave={(e: React.MouseEvent<SVGPathElement>) => {
                e.currentTarget.setAttribute("fill", landFill);
              }}
            />
          ))
        }
      </Geographies>
      {/* eslint-enable @typescript-eslint/no-explicit-any */}

      {visibleCities.map((city) => {
        const key = `${city.state}|${city.name}`;
        const status = cityStatuses[key] ?? "not_started";
        const hasClient = clientCities?.has(key) ?? false;
        const color = hasClient ? CITY_CLIENT_HEX : CITY_STATUS_HEX[status];
        const isSelected = selectedCity?.state === city.state && selectedCity?.city === city.name;
        return (
          <Marker
            key={key}
            coordinates={[city.lng, city.lat] as [number, number]}
            onClick={() => onCitySelect?.({ state: city.state, city: city.name })}
          >
            <g style={{ cursor: onCitySelect ? "pointer" : "default" }} data-tooltip={city.name}>
              {/* Soft halo behind the marker ring, same color as status */}
              <circle r={isSelected ? 12 : 9} fill={color} fillOpacity={isSelected ? 0.25 : 0.16} />
              {/* Ring with a surface-colored centre, so it reads on either theme */}
              <circle r={isSelected ? 6 : 5} fill={markerRingFill} stroke={color} strokeWidth={2.25} />
            </g>
          </Marker>
        );
      })}
    </ComposableMap>
    {visibleCities.length === 0 && (
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-gray-400 dark:text-gray-500">
        No cities in progress in {country} yet
      </p>
    )}
    </div>
  );
}
