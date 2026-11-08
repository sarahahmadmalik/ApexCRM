"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Combobox } from "@/components/ui/combobox";
import { COUNTRY_NAMES } from "@/lib/data/geo";

export function CountrySelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="w-full sm:w-56">
      <Combobox
        options={COUNTRY_NAMES.map((c) => ({ value: c, label: c }))}
        value={value}
        onChange={(v) => {
          const params = new URLSearchParams(searchParams.toString());
          if (v) params.set("country", v);
          router.push(`${pathname}?${params.toString()}`);
        }}
      />
    </div>
  );
}
