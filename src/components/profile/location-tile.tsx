"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Pencil, Check, X, Loader2 } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { CountryFlag } from "@/components/ui/country-flag";
import { COUNTRY_NAMES } from "@/lib/data/geo";
import { updateMyLocation } from "@/app/(app)/profile/actions";

const COUNTRY_OPTIONS = COUNTRY_NAMES.map((c) => ({ value: c, label: c }));

/** The location InfoTile, editable in place — the one field on the profile page the signed-in user can change themselves rather than asking leadership to edit the roster. */
export function LocationTile({ country }: { country: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null>(country);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!pending || pending === country) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await updateMyLocation(pending);
      toast.success(`Location updated to ${pending}`);
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update location");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-brand-300 bg-white p-3.5 dark:border-brand-400/40 dark:bg-navy-800">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          <MapPin className="h-3.5 w-3.5" />
          Location
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Combobox options={COUNTRY_OPTIONS} value={pending} onChange={setPending} placeholder="Select country" />
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            title="Save"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(country);
              setEditing(false);
            }}
            disabled={busy}
            title="Cancel"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setPending(country);
        setEditing(true);
      }}
      className="group cursor-pointer rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 text-left transition-colors hover:border-gray-200 hover:bg-gray-100/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          Location
        </span>
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
        {country ? (
          <>
            <CountryFlag country={country} />
            {country}
          </>
        ) : (
          <span className="font-normal text-gray-400 dark:text-gray-500">Not set — click to add</span>
        )}
      </p>
    </button>
  );
}
