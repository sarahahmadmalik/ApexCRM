"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Combobox, type Option } from "@/components/ui/combobox";
import { FilterBar } from "@/components/ui/filter-bar";
import { COUNTRY_NAMES, findCountry, citiesForCountry } from "@/lib/data/geo";
import { FIRM_STATUS_LABELS } from "@/lib/utils";

const STATUS_OPTIONS: Option[] = Object.entries(FIRM_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export function FirmsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Kept as the raw comma-joined string so it's a stable dep for useMemo.
  const countryParam = searchParams.get("country") ?? "";
  const countryValues = useMemo(() => countryParam.split(",").filter(Boolean), [countryParam]);
  const stateValues = (searchParams.get("state") ?? "").split(",").filter(Boolean);
  const cityValues = (searchParams.get("city") ?? "").split(",").filter(Boolean);
  const statusValues = (searchParams.get("status") ?? "").split(",").filter(Boolean);

  const activeCount = countryValues.length + stateValues.length + cityValues.length + statusValues.length;

  const stateOptions: Option[] = useMemo(
    () => countryValues.flatMap((c) => findCountry(c)?.states ?? []).map((s) => ({ value: s.name, label: s.name })),
    [countryValues]
  );

  const cityOptions: Option[] = useMemo(
    () => countryValues.flatMap((c) => citiesForCountry(c)).map((c) => ({ value: c.name, label: c.name })),
    [countryValues]
  );

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function setMultiParam(key: string, values: string[]) {
    setParam(key, values.length > 0 ? values.join(",") : null);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    ["country", "state", "city", "status", "page"].forEach((k) => params.delete(k));
    setQ("");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <FilterBar
      flush
      activeCount={activeCount}
      onClearAll={clearAll}
      search={{
        value: q,
        onChange: setQ,
        placeholder: "Search firm name...",
        onCommit: () => setParam("q", q || null),
      }}
    >
      <Combobox
        options={COUNTRY_NAMES.map((c) => ({ value: c, label: c }))}
        value={countryValues}
        isMulti
        placeholder="All countries"
        isClearable
        onChange={(v) => setMultiParam("country", v)}
      />
      <Combobox
        options={stateOptions}
        value={stateValues}
        isMulti
        placeholder="All states"
        isClearable
        isDisabled={countryValues.length === 0}
        onChange={(v) => setMultiParam("state", v)}
      />
      <Combobox
        options={cityOptions}
        value={cityValues}
        isMulti
        placeholder="All cities"
        isClearable
        isDisabled={countryValues.length === 0}
        onChange={(v) => setMultiParam("city", v)}
      />
      <Combobox
        options={STATUS_OPTIONS}
        value={statusValues}
        isMulti
        placeholder="All statuses"
        isClearable
        onChange={(v) => setMultiParam("status", v)}
      />
    </FilterBar>
  );
}
