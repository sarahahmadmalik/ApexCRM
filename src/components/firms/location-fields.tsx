"use client";

import { Combobox, type Option } from "@/components/ui/combobox";
import { FormRow } from "@/components/ui/field";
import { ALL_CITIES, COUNTRY_NAMES, findCountry } from "@/lib/data/geo";
import { useMemo } from "react";

export type LocationValue = { country: string; state: string; city: string };

/**
 * Cascading, independently-searchable Country / State / City picker.
 * Picking a city auto-fills its country + state. Country/state can also be
 * picked first to narrow down the city list.
 */
export function LocationFields({
  value,
  onChange,
  error,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  error?: string;
}) {
  const countryOptions: Option[] = COUNTRY_NAMES.map((c) => ({ value: c, label: c }));

  const stateOptions: Option[] = useMemo(() => {
    const country = findCountry(value.country);
    return country ? country.states.map((s) => ({ value: s.name, label: s.name })) : [];
  }, [value.country]);

  const cityOptions: Option[] = useMemo(() => {
    return ALL_CITIES.filter(
      (c) => (!value.country || c.country === value.country) && (!value.state || c.state === value.state)
    ).map((c) => ({
      value: `${c.country}|${c.state}|${c.name}`,
      label: value.country ? c.name : `${c.name}, ${c.state}, ${c.country}`,
    }));
  }, [value.country, value.state]);

  const cityValue = value.city
    ? `${value.country}|${value.state}|${value.city}`
    : null;

  return (
    // Three comboboxes side by side get too narrow to read their own
    // placeholders in a drawer — only split them up once there's real width.
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <FormRow label="Country">
        <Combobox
          options={countryOptions}
          value={value.country || null}
          placeholder="Search country..."
          onChange={(v) => onChange({ country: v ?? "", state: "", city: "" })}
        />
      </FormRow>
      <FormRow label="State / Region">
        <Combobox
          options={stateOptions}
          value={value.state || null}
          placeholder={value.country ? "Search state..." : "Pick a country first"}
          isDisabled={!value.country}
          onChange={(v) => onChange({ ...value, state: v ?? "", city: "" })}
        />
      </FormRow>
      <FormRow label="City" required error={error} hint="Picking a city fills in its country & state automatically">
        <Combobox
          options={cityOptions}
          value={cityValue}
          placeholder="Search city..."
          onChange={(v) => {
            if (!v) return onChange({ ...value, city: "" });
            const [country, state, city] = v.split("|");
            onChange({ country, state, city });
          }}
        />
      </FormRow>
    </div>
  );
}
