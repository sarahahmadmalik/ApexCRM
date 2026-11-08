"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormRow, Input, Textarea } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { LocationFields, type LocationValue } from "@/components/firms/location-fields";
import { CompanyLookupButton } from "@/components/firms/company-lookup-button";
import type { CompanyLookupResult } from "@/app/(app)/firms/actions";
import { FIRM_STATUS_LABELS } from "@/lib/utils";
import { collectErrors, validateEmail, validatePhone, validateRequired, validateUrl } from "@/lib/validation";
import type { Database, FirmStatus } from "@/lib/types/database";
import { createFirm, updateFirm } from "@/app/(app)/firms/actions";

type Firm = Database["public"]["Tables"]["firms"]["Row"];

const STATUS_ORDER: FirmStatus[] = [
  "not_started",
  "in_progress",
  "sent",
  "responded",
  "negotiation",
  "client",
];

const STATUS_OPTIONS = STATUS_ORDER.map((s) => ({ value: s, label: FIRM_STATUS_LABELS[s] }));

export function FirmFormDialog({
  open,
  onClose,
  firm,
}: {
  open: boolean;
  onClose: () => void;
  firm?: Firm | null;
}) {
  const isEdit = !!firm;
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<LocationValue>({
    country: firm?.country ?? "",
    state: firm?.state ?? "",
    city: firm?.city ?? "",
  });
  const [status, setStatus] = useState<FirmStatus>(firm?.status ?? "not_started");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);

  function applyCompanyLookup(result: CompanyLookupResult) {
    if (nameRef.current) nameRef.current.value = result.name;
    if (websiteRef.current) websiteRef.current.value = result.website;
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest.name;
      delete rest.website;
      return rest;
    });
  }

  async function handleSubmit(formData: FormData) {
    const input = {
      name: String(formData.get("name") ?? ""),
      country: location.country,
      state: location.state,
      city: location.city,
      status,
      contact_name: String(formData.get("contact_name") ?? ""),
      contact_email: String(formData.get("contact_email") ?? ""),
      contact_phone: String(formData.get("contact_phone") ?? ""),
      website: String(formData.get("website") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    const found = collectErrors({
      name: validateRequired(input.name, "Firm name"),
      location: input.city ? undefined : "Pick a city so the firm lands on the map",
      contact_email: validateEmail(input.contact_email),
      contact_phone: validatePhone(input.contact_phone),
      website: validateUrl(input.website),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {

      if (isEdit) {
        await updateFirm(firm!.id, input);
        toast.success("Firm updated");
      } else {
        await createFirm(input);
        toast.success("Firm added");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit firm" : "Add new firm"}
      description="Enter firm details and outreach classification."
      size="md"
      position="right"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="firm-form" variant="outline-brand" disabled={saving} loading={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Save firm"}
          </Button>
        </div>
      }
    >
      <form id="firm-form" action={handleSubmit} noValidate className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <FormRow
            label={
              <span className="flex items-center justify-between gap-2">
                <span>
                  Firm name<span className="ml-0.5 text-red-500">*</span>
                </span>
                <CompanyLookupButton getQuery={() => nameRef.current?.value ?? ""} onSelect={applyCompanyLookup} />
              </span>
            }
            error={errors.name}
          >
            <Input ref={nameRef} name="name" defaultValue={firm?.name} placeholder="e.g. Nordic Systems AB" />
          </FormRow>

          <LocationFields value={location} onChange={setLocation} error={errors.location} />

          <FormRow label="Outreach status">
            <Combobox options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus((v as FirmStatus) ?? "not_started")} />
          </FormRow>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Contact name">
              <Input name="contact_name" defaultValue={firm?.contact_name ?? ""} placeholder="e.g. Anna Lindqvist" />
            </FormRow>
            <FormRow label="Contact email" error={errors.contact_email}>
              <Input name="contact_email" type="email" defaultValue={firm?.contact_email ?? ""} placeholder="contact@firm.com" />
            </FormRow>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Contact phone" error={errors.contact_phone}>
              <Input name="contact_phone" defaultValue={firm?.contact_phone ?? ""} placeholder="+46 70 123 45 67" />
            </FormRow>
            <FormRow label="Website (optional)" error={errors.website}>
              <Input ref={websiteRef} name="website" type="url" defaultValue={firm?.website ?? ""} placeholder="https://example.com" />
            </FormRow>
          </div>

          <FormRow label="Notes & context">
            <Textarea name="notes" rows={4} defaultValue={firm?.notes ?? ""} placeholder="e.g. Initial pitch sent via LinkedIn & executive outreach." />
          </FormRow>
        </div>

      </form>
    </Dialog>
  );
}
