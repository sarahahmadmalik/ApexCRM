"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { FirmPicker } from "@/components/offers/firm-picker";
import { LineItemsEditor } from "@/components/offers/line-items-editor";
import { collectErrors } from "@/lib/validation";
import type { Database, LineItem } from "@/lib/types/database";
import { createInvoice, type InvoiceInput } from "@/app/(app)/invoices/actions";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
type Angebot = Database["public"]["Tables"]["angebots"]["Row"];

const today = () => new Date().toISOString().slice(0, 10);
const in14Days = () => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

export function InvoiceFormDialog({
  open,
  onClose,
  firms,
  angebots,
}: {
  open: boolean;
  onClose: () => void;
  firms: Firm[];
  angebots: Angebot[];
}) {
  const [firmId, setFirmId] = useState<string | null>(null);
  const [angebotId, setAngebotId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(in14Days());
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: "1", unit_price: 0, total: 0 }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const angebotOptions = useMemo(
    () =>
      angebots
        .filter((a) => !firmId || a.firm_id === firmId)
        .map((a) => ({ value: a.id, label: `${a.angebot_number} (${new Intl.NumberFormat("de-DE").format(a.total_amount)} €)` })),
    [angebots, firmId]
  );

  function applyAngebot(id: string | null) {
    setAngebotId(id);
    const angebot = angebots.find((a) => a.id === id);
    if (angebot) {
      setFirmId(angebot.firm_id);
      setVatRate(angebot.vat_rate);
      setItems(angebot.line_items);
    }
  }

  async function handleSave() {
    const lineItems = items.filter((i) => i.description.trim());
    const found = collectErrors({
      firm: firmId ? undefined : "Pick a firm",
      issue_date: issueDate ? undefined : "Issue date is required",
      due_date: dueDate && dueDate < issueDate ? "Can't be before the issue date" : undefined,
      period: !!periodStart !== !!periodEnd ? "Set both a start and an end, or neither" : undefined,
      period_end:
        periodStart && periodEnd && periodEnd < periodStart ? "Service period end can't be before its start" : undefined,
      items: lineItems.length > 0 ? undefined : "Add at least one line item",
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    const input: InvoiceInput = {
      firm_id: firmId!,
      angebot_id: angebotId,
      issue_date: issueDate,
      due_date: dueDate,
      service_period_start: periodStart,
      service_period_end: periodEnd,
      vat_rate: vatRate,
      line_items: lineItems,
    };
    try {
      await createInvoice(input);
      toast.success("Invoice created");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New invoice"
      description="The invoice number is generated automatically and never repeats."
      size="xl"
      position="right"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} loading={saving} variant="outline-brand">
            {saving ? "Saving..." : "Create invoice"}
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Firm" required hint="Client or firms in negotiation" error={errors.firm}>
              <FirmPicker
                firms={firms}
                value={firmId}
                onChange={(v) => {
                  setFirmId(v);
                  setAngebotId(null);
                }}
              />
            </FormRow>
            <FormRow label="Based on offer (optional)" hint="Pulls the line items from that offer">
              <Combobox
                options={angebotOptions}
                value={angebotId}
                onChange={applyAngebot}
                placeholder="None"
                isClearable
              />
            </FormRow>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormRow label="Issue date" required error={errors.issue_date}>
              <DatePicker value={issueDate} onChange={setIssueDate} invalid={!!errors.issue_date} clearable={false} />
            </FormRow>
            <FormRow label="Due date" error={errors.due_date}>
              <DatePicker value={dueDate} min={issueDate} onChange={setDueDate} invalid={!!errors.due_date} />
            </FormRow>
            <FormRow label="Service period start" error={errors.period}>
              <DatePicker value={periodStart} onChange={setPeriodStart} invalid={!!errors.period} />
            </FormRow>
            <FormRow label="Service period end" error={errors.period_end}>
              <DatePicker value={periodEnd} min={periodStart || undefined} onChange={setPeriodEnd} invalid={!!errors.period_end} />
            </FormRow>
          </div>

          <div>
            <LineItemsEditor items={items} onChange={setItems} vatRate={vatRate} onVatRateChange={setVatRate} />
            {errors.items && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.items}</p>}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
