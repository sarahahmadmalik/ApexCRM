"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { FirmPicker } from "@/components/offers/firm-picker";
import { LineItemsEditor } from "@/components/offers/line-items-editor";
import { collectErrors } from "@/lib/validation";
import type { Database, LineItem } from "@/lib/types/database";
import { createAngebot, updateAngebot, type AngebotInput } from "@/app/(app)/offers/actions";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
type Angebot = Database["public"]["Tables"]["angebots"]["Row"];

const today = () => new Date().toISOString().slice(0, 10);
const in30Days = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

export function OfferFormDialog({
  open,
  onClose,
  firms,
  offer,
}: {
  open: boolean;
  onClose: () => void;
  firms: Firm[];
  offer?: Angebot | null;
}) {
  const isEdit = !!offer;
  const [firmId, setFirmId] = useState<string | null>(offer?.firm_id ?? null);
  const [issueDate, setIssueDate] = useState(offer?.issue_date ?? today());
  const [validUntil, setValidUntil] = useState(offer?.valid_until ?? in30Days());
  const [vatRate, setVatRate] = useState(offer?.vat_rate ?? 19);
  const [items, setItems] = useState<LineItem[]>(
    offer?.line_items ?? [{ description: "", quantity: "1", unit_price: 0, total: 0 }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const lineItems = items.filter((i) => i.description.trim());
    const found = collectErrors({
      firm: firmId ? undefined : "Pick a firm",
      issue_date: issueDate ? undefined : "Issue date is required",
      valid_until: validUntil && validUntil < issueDate ? "Can't be before the issue date" : undefined,
      items: lineItems.length > 0 ? undefined : "Add at least one line item",
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    const input: AngebotInput = {
      firm_id: firmId!,
      issue_date: issueDate,
      valid_until: validUntil,
      vat_rate: vatRate,
      line_items: lineItems,
    };
    try {
      if (isEdit) {
        await updateAngebot(offer!.id, input);
        toast.success("Offer updated");
      } else {
        await createAngebot(input);
        toast.success("Offer created");
      }
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
      title={isEdit ? `Edit ${offer!.angebot_number}` : "New offer"}
      description="The offer number is generated automatically and never repeats."
      size="xl"
      position="right"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} loading={saving} variant="outline-brand">
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create offer"}
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <FormRow label="Firm" required error={errors.firm}>
            <FirmPicker firms={firms} value={firmId} onChange={setFirmId} />
          </FormRow>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Issue date" required error={errors.issue_date}>
              <DatePicker value={issueDate} onChange={setIssueDate} invalid={!!errors.issue_date} clearable={false} />
            </FormRow>
            <FormRow label="Valid until" error={errors.valid_until}>
              <DatePicker value={validUntil} min={issueDate} onChange={setValidUntil} invalid={!!errors.valid_until} />
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
