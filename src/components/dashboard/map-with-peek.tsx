"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Search, X } from "lucide-react";
import { EuropeCountryMap } from "@/components/dashboard/europe-country-map";
import { MapLegend } from "@/components/dashboard/map-legend";
import { StatusBadge } from "@/components/firms/status-badge";
import { CITY_STATUS_LABELS, CITY_STATUS_BADGE_COLORS, cn } from "@/lib/utils";
import { citiesForCountry } from "@/lib/data/geo";
import type { CityManualStatus, FirmStatus } from "@/lib/types/database";

type CityFirm = { id: string; name: string; status: FirmStatus };
type CityKey = { state: string; city: string };

export function MapWithPeek({
  country,
  cityStatuses,
  firmsByCity,
}: {
  country: string;
  cityStatuses: Record<string, CityManualStatus>;
  firmsByCity: Record<string, CityFirm[]>;
}) {
  const clientCities = useMemo(
    () => new Set(Object.entries(firmsByCity).filter(([, firms]) => firms.some((f) => f.status === "client")).map(([key]) => key)),
    [firmsByCity]
  );
  const [picked, setPicked] = useState<CityKey | null>(null);
  const [citySearch, setCitySearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const allCities = useMemo(() => citiesForCountry(country), [country]);
  const citySearchMatches = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return [];
    return allCities.filter((c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)).slice(0, 8);
  }, [allCities, citySearch]);

  // Until the user clicks a marker, preview the first city that actually has
  // firms — derived rather than stored, so switching country re-derives it
  // instead of leaving a stale selection from the previous country behind.
  const selected = useMemo(() => {
    if (picked) return picked;
    const [firstKey] = Object.keys(firmsByCity);
    if (!firstKey) return null;
    const [state, city] = firstKey.split("|");
    return { state, city };
  }, [picked, firmsByCity]);

  const setSelected = setPicked;
  const selectedKey = selected ? `${selected.state}|${selected.city}` : null;
  const selectedFirms = useMemo(
    () => (selectedKey ? (firmsByCity[selectedKey] ?? []) : []),
    [selectedKey, firmsByCity]
  );
  const selectedStatus = selectedKey ? (cityStatuses[selectedKey] ?? "not_started") : null;

  const selectedCounts = useMemo(() => {
    const counts: Record<FirmStatus, number> = {
      not_started: 0,
      in_progress: 0,
      sent: 0,
      responded: 0,
      negotiation: 0,
      client: 0,
    };
    selectedFirms.forEach((f) => counts[f.status]++);
    return counts;
  }, [selectedFirms]);

  return (
    <div className="flex flex-col lg:flex-row">
      {/* Map Area — min-w-0 so the flex child can shrink instead of forcing
          the row wider than the card (which overflowed the panel beside it). */}
      <div className="min-w-0 flex-1 lg:border-r lg:border-gray-200 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-3 text-xs font-semibold tracking-widest text-gray-500 uppercase sm:px-5 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
          <span>Regional coverage</span>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {Object.keys(firmsByCity).length} active markets
          </span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="relative mb-4" ref={searchBoxRef}>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
              placeholder={`Search for a city in ${country}...`}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pr-9 pl-9 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-white/10 dark:bg-navy-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/10"
            />
            {citySearch && (
              <button
                type="button"
                onClick={() => setCitySearch("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {searchFocused && citySearch && (
              <div className="dropdown-menu-pop absolute top-full left-0 z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl dark:border-white/10 dark:bg-navy-800">
                {citySearchMatches.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500">No cities match &ldquo;{citySearch}&rdquo;.</p>
                ) : (
                  citySearchMatches.map((c) => {
                    const key = `${c.state}|${c.name}`;
                    const status = cityStatuses[key] ?? "not_started";
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelected({ state: c.state, city: c.name });
                          setCitySearch("");
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-white/5",
                          selected?.state === c.state && selected?.city === c.name && "bg-brand-50/60 dark:bg-brand-500/10"
                        )}
                      >
                        <span className="min-w-0 truncate text-gray-900 dark:text-gray-100">
                          {c.name} <span className="text-gray-400 dark:text-gray-500">({c.state})</span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ring-inset ${CITY_STATUS_BADGE_COLORS[status]}`}
                        >
                          {CITY_STATUS_LABELS[status]}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <EuropeCountryMap
            country={country}
            cityStatuses={cityStatuses}
            clientCities={clientCities}
            selectedCity={selected}
            onCitySelect={setSelected}
          />
          <MapLegend />
        </div>
      </div>

      {/* Peek Panel — min-w-0 + a fixed basis only from lg up, so it can't
          push the map sideways on narrower screens. */}
      <div className="flex w-full min-w-0 shrink-0 flex-col border-t border-gray-100 bg-gray-50/40 lg:w-80 lg:border-t-0 dark:border-white/10 dark:bg-white/[0.02]">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-gray-400 dark:text-gray-500">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-white/10">
              <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <p>Select a city marker to see its outreach detail.</p>
          </div>
        ) : (
          <div className="animate-fade-in flex flex-1 flex-col p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display flex items-center gap-1.5 text-lg leading-tight font-semibold text-gray-900 sm:text-xl dark:text-gray-100">
                  <MapPin className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{selected.city}</span>
                </h3>
                <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{selected.state}</p>
              </div>
              {selectedStatus && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ring-1 ring-inset ${CITY_STATUS_BADGE_COLORS[selectedStatus]}`}
                >
                  {CITY_STATUS_LABELS[selectedStatus]}
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white px-1 py-2.5 ring-1 ring-gray-200 dark:bg-white/5 dark:ring-white/10">
                <p className="font-display text-xl leading-none font-bold text-gray-900 dark:text-gray-100">
                  {selectedFirms.length}
                </p>
                <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">Firms</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-1 py-2.5 ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
                <p className="font-display text-xl leading-none font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedCounts.client}
                </p>
                <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Clients</p>
              </div>
              <div className="rounded-lg bg-white px-1 py-2.5 ring-1 ring-gray-200 dark:bg-white/5 dark:ring-white/10">
                <p className="font-display text-xl leading-none font-bold text-gray-900 dark:text-gray-100">
                  {selectedCounts.not_started}
                </p>
                <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">Not started</p>
              </div>
            </div>

            <p className="mt-5 mb-2 text-[11px] font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Firms in this city
            </p>

            {selectedFirms.length > 0 ? (
              <div className="-mr-1 max-h-64 flex-1 space-y-1.5 overflow-y-auto pr-1 lg:max-h-none">
                {selectedFirms.slice(0, 8).map((firm) => (
                  <div
                    key={firm.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{firm.name}</span>
                    <StatusBadge status={firm.status} />
                  </div>
                ))}
                {selectedFirms.length > 8 && (
                  <p className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                    + {selectedFirms.length - 8} more
                  </p>
                )}
              </div>
            ) : (
              <p className="flex-1 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No firms tracked here yet.
              </p>
            )}

            <Link
              href={`/firms?country=${encodeURIComponent(country)}&city=${encodeURIComponent(selected.city)}`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 dark:bg-brand-500 dark:hover:bg-brand-400 dark:text-navy-950"
            >
              View firms in {selected.city}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
