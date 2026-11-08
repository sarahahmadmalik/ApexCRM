"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Combobox } from "@/components/ui/combobox";
import type { Database } from "@/lib/types/database";

type Firm = Database["public"]["Tables"]["firms"]["Row"];

export function InvoiceFirmFilter({ firms }: { firms: Firm[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firmId = searchParams.get("firm");

  return (
    <div className="w-72">
      <Combobox
        options={firms.map((f) => ({ value: f.id, label: f.name }))}
        value={firmId}
        isClearable
        placeholder="Filter by firm to see all their invoices"
        onChange={(v) => {
          const params = new URLSearchParams(searchParams.toString());
          if (v) params.set("firm", v);
          else params.delete("firm");
          router.push(`${pathname}?${params.toString()}`);
        }}
      />
    </div>
  );
}
