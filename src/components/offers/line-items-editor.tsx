"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input, Label } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { calcTotals, formatCurrency } from "@/lib/utils";
import type { LineItem } from "@/lib/types/database";

function parseLeadingQuantity(qty: string) {
  const match = qty.match(/^([\d.,]+)/);
  if (!match) return 1;
  const n = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function LineItemsEditor({
  items,
  onChange,
  vatRate,
  onVatRateChange,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  vatRate: number;
  onVatRateChange: (rate: number) => void;
}) {
  function updateRow(index: number, patch: Partial<LineItem>) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  }

  function autoCalcTotal(index: number) {
    const item = items[index];
    const total = Math.round(parseLeadingQuantity(item.quantity) * item.unit_price * 100) / 100;
    updateRow(index, { total });
  }

  function addRow() {
    onChange([...items, { description: "", quantity: "1", unit_price: 0, total: 0 }]);
  }

  function removeRow(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  const { net, vat, total } = calcTotals(items, vatRate);

  return (
    <div className="space-y-3">
      <Label>Line items</Label>
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500 dark:bg-white/5 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2">Description</th>
              <th className="w-28 px-3 py-2">Quantity</th>
              <th className="w-32 px-3 py-2">Unit price (€)</th>
              <th className="w-32 px-3 py-2">Total (€)</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/10">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <Input
                    value={item.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                    placeholder="e.g. UI/UX Design"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={item.quantity}
                    onChange={(e) => updateRow(i, { quantity: e.target.value })}
                    onBlur={() => autoCalcTotal(i)}
                    placeholder="8 Std. / pauschal"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateRow(i, { unit_price: parseFloat(e.target.value) || 0 })}
                    onBlur={() => autoCalcTotal(i)}
                    placeholder="0.00"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.total}
                    onChange={(e) => updateRow(i, { total: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </td>
                <td className="px-1 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer dark:text-gray-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add line
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-6 rounded-lg bg-gray-50 p-4 dark:bg-white/5">
        <div className="w-40">
          <Label>VAT rate (%)</Label>
          <Combobox
            options={[
              { value: "19", label: "19%" },
              { value: "7", label: "7%" },
              { value: "0", label: "0%" },
            ]}
            value={String(vatRate)}
            onChange={(v) => onVatRateChange(parseFloat(v ?? "19"))}
          />
        </div>
        <div className="space-y-1 text-right text-sm">
          <p className="text-gray-500 dark:text-gray-400">
            Net: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(net)}</span>
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            VAT: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(vat)}</span>
          </p>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Total: {formatCurrency(total)}</p>
        </div>
      </div>
    </div>
  );
}
