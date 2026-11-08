"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/auth/form-error";
import { cn, CITY_STATUS_HEX, CITY_STATUS_LABELS } from "@/lib/utils";
import type { CityRow } from "@/components/cities/city-row";
import type { CityManualStatus } from "@/lib/types/database";
import { setCityOverride, clearCityOverride } from "@/app/(app)/cities/actions";

const STATUS_ORDER: CityManualStatus[] = ["not_started", "in_progress", "completed"];

/** Edit a city's status and note. Mount with a `key` per city so the form resets on each open. */
export function EditCityDialog({
  city,
  onClose,
  onSaved,
}: {
  city: CityRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<CityManualStatus>(city?.status ?? "not_started");
  const [note, setNote] = useState(city?.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!city) return;
    setError("");
    setSaving(true);
    try {
      await setCityOverride(city.country, city.state, city.city, status, note.trim());
      toast.success(`${city.city} updated`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!city) return;
    setError("");
    setSaving(true);
    try {
      await clearCityOverride(city.country, city.state, city.city);
      toast.success(`${city.city} reset to automatic status`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset the status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!city}
      onClose={onClose}
      size="sm"
      title="Edit city"
      description={city ? `${city.city} · ${city.state}, ${city.country} · ${city.firm_count} firms` : undefined}
      footer={
        <div className="flex items-center justify-between gap-3">
          {city?.is_manual_override ? (
            <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
              Reset to automatic
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="edit-city-form" loading={saving}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      <form id="edit-city-form" onSubmit={save} className="space-y-5">
        <div>
          <Label>Status</Label>
          <div className="mt-1.5 grid gap-2" role="radiogroup" aria-label="Status">
            {STATUS_ORDER.map((s) => (
              <label
                key={s}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  status === s
                    ? "border-brand-500 bg-brand-50 text-gray-900 dark:bg-brand-500/10 dark:text-gray-100"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                )}
              >
                <input
                  type="radio"
                  name="city-status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="sr-only"
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CITY_STATUS_HEX[s] }} />
                <span className="font-medium">{CITY_STATUS_LABELS[s]}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="city-note">Note</Label>
          <Textarea
            id="city-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional, e.g. which firm sources were covered"
            className="mt-1.5"
          />
        </div>

        <FormError id="edit-city-error" message={error} />
      </form>
    </Dialog>
  );
}
