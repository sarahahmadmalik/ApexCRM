"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { StatusBadge } from "@/components/firms/status-badge";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FirmStatus } from "@/lib/types/database";

export type Option = {
  value: string;
  label: string;
  /** Rendered instead of the plain label (status pills in the status filters). */
  badge?: React.ReactNode;
  /** Small trailing text, e.g. a record count next to a badge. */
  hint?: string;
};

const STATUS_VALUES = ["not_started", "in_progress", "sent", "responded", "negotiation", "client"];

/** Long option lists (cities, states) get a type-to-filter box in the panel. */
const SEARCHABLE_THRESHOLD = 8;

/** Very long lists (every city in a country) render only the first rows; typing narrows them. */
const MAX_RENDERED = 150;

type BaseProps = {
  options: Option[];
  placeholder?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
};

type SingleProps = BaseProps & {
  isMulti?: false;
  value: string | null;
  onChange: (value: string | null) => void;
};

type MultiProps = BaseProps & {
  isMulti: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export function Combobox(props: SingleProps | MultiProps) {
  const { options, value, placeholder = "Select...", isDisabled, isClearable, isMulti } = props;
  const [query, setQuery] = useState("");
  const panelId = useId();

  const selectedArray = isMulti ? (value ?? []) : value ? [value] : [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function handleSelect(val: string, close: () => void) {
    if (props.isMulti) {
      const current = props.value ?? [];
      props.onChange(current.includes(val) ? current.filter((v) => v !== val) : [...current, val]);
    } else {
      props.onChange(val);
      close();
    }
  }

  function handleClear() {
    if (props.isMulti) props.onChange([]);
    else props.onChange(null);
  }

  const selectedOption = !isMulti && selectedArray.length === 1 ? options.find((o) => o.value === selectedArray[0]) : undefined;

  const triggerLabel =
    selectedArray.length === 0 ? null : selectedOption?.badge ? (
      <span className="inline-flex items-center gap-2">
        {selectedOption.badge}
        {selectedOption.hint && <span className="text-xs text-gray-400 dark:text-gray-500">{selectedOption.hint}</span>}
      </span>
    ) : isMulti ? (
      selectedArray.length === 1 ? (
        (options.find((o) => o.value === selectedArray[0])?.label ?? `${selectedArray.length} selected`)
      ) : (
        `${selectedArray.length} selected`
      )
    ) : (
      (options.find((o) => o.value === selectedArray[0])?.label ?? null)
    );

  return (
    <DropdownMenu
      align="left"
      panelId={panelId}
      // Portalled so the list floats above drawers/dialogs instead of being
      // clipped by (or stretching) their scroll area.
      portal
      matchTriggerWidth
      panelClassName="min-w-[220px]"
      trigger={({ open, toggle }) => (
        <div
          role="combobox"
          aria-expanded={open}
          aria-controls={panelId}
          tabIndex={isDisabled ? -1 : 0}
          onClick={() => !isDisabled && toggle()}
          onKeyDown={(e) => {
            if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              toggle();
            }
          }}
          className={cn(
            "flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-all duration-200",
            "dark:border-white/10 dark:bg-navy-800",
            isDisabled ? "cursor-not-allowed opacity-50" : "hover:border-gray-300 dark:hover:border-white/20",
            open && "border-brand-500 ring-4 ring-brand-500/10 dark:border-brand-400"
          )}
        >
          <span className="flex-1 truncate">
            {triggerLabel === null ? (
              <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
            ) : (
              <span className="text-gray-900 dark:text-gray-100">{triggerLabel}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-gray-400 dark:text-gray-500">
            {isClearable && selectedArray.length > 0 && (
              <X
                className="h-4 w-4 cursor-pointer transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              />
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
          </span>
        </div>
      )}
    >
      {(close) => (
        <>
          {options.length > SEARCHABLE_THRESHOLD && (
            <div className="relative border-b border-gray-100 p-2 dark:border-white/10">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter..."
                className="w-full rounded-md border border-gray-200 bg-white py-1.5 pr-2 pl-7 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-500 dark:border-white/10 dark:bg-navy-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          )}
          <div className="max-h-64 min-h-0 overflow-y-auto p-1">
            {filtered.slice(0, MAX_RENDERED).map((opt) => {
              const isSelected = selectedArray.includes(opt.value);
              const isStatusOpt = STATUS_VALUES.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value, close)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-[13px] transition-colors",
                    isSelected && !isMulti
                      ? "bg-brand-50 text-brand-900 dark:bg-brand-500/10 dark:text-brand-300"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {isMulti && (
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-gray-300 bg-white dark:border-white/20 dark:bg-transparent"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    )}
                    {opt.badge ? (
                      <span className="inline-flex items-center gap-2">
                        {opt.badge}
                        {opt.hint && <span className="text-xs text-gray-400 dark:text-gray-500">{opt.hint}</span>}
                      </span>
                    ) : isStatusOpt ? (
                      <StatusBadge status={opt.value as FirmStatus} />
                    ) : (
                      <span>{opt.label}</span>
                    )}
                  </div>
                  {!isMulti && isSelected && <Check className="h-4 w-4 text-brand-500" />}
                </div>
              );
            })}
            {filtered.length > MAX_RENDERED && (
              <div className="px-3 py-2 text-center text-xs text-gray-400 dark:text-gray-500">
                Showing {MAX_RENDERED} of {filtered.length} — type to narrow down
              </div>
            )}
            {filtered.length === 0 && (
              <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">No matches</div>
            )}
          </div>
        </>
      )}
    </DropdownMenu>
  );
}
