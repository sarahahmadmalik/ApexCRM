"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { COUNTRY_NAMES } from "@/lib/data/geo";
import { CountryFlag } from "@/components/ui/country-flag";

export function CountryPills({ value, resetParams = [] }: { value: string; /** Params to drop when the country changes (page, filters that belong to the old country). */ resetParams?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(country: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("country", country);
    for (const key of resetParams) params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <DropdownMenu
      align="right"
      panelClassName="max-h-80 w-full min-w-[200px] overflow-y-auto py-1"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-[140px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-navy-800 dark:text-gray-100 dark:hover:bg-navy-700"
        >
          <span className="flex items-center gap-2">
            <CountryFlag country={value} className="h-4 w-6" />
            <span>{value}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <ul role="listbox">
          {COUNTRY_NAMES.map((c) => {
            const active = c === value;
            return (
              <li key={c}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    close();
                    handleSelect(c);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-50 font-bold text-brand-900 dark:bg-brand-500/10 dark:text-brand-300"
                      : "font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <CountryFlag country={c} className="h-4 w-6" />
                    {c}
                  </span>
                  {active && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DropdownMenu>
  );
}
