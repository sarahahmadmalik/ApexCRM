"use client";

import { Combobox } from "@/components/ui/combobox";
import type { Database } from "@/lib/types/database";

type Firm = Database["public"]["Tables"]["firms"]["Row"];

/** Firms worth generating an Angebot/Invoice for float to the top: negotiation & client first. */
const PRIORITY: Record<string, number> = { negotiation: 0, client: 1 };

export function FirmPicker({
  firms,
  value,
  onChange,
  placeholder = "Search firm...",
}: {
  firms: Firm[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}) {
  const sorted = [...firms].sort((a, b) => (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9));
  const options = sorted.map((f) => ({ value: f.id, label: `${f.name} (${f.city}, ${f.country})` }));

  return <Combobox options={options} value={value} onChange={onChange} placeholder={placeholder} />;
}
