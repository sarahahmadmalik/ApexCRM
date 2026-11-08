"use client";

import { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Custom-styled checkbox — a real `<input type="checkbox">` underneath (for
 * native keyboard/screen-reader support) with the browser's own box hidden
 * and a themed brand square drawn in its place, so it matches the rest of
 * the UI instead of looking like unstyled OS chrome. Used for row selection
 * (single row, or the header "select all", which supports `indeterminate`).
 *
 * `label` is accessibility-only (screen readers, the accessible name) — it
 * is never rendered as visible text. Pass `visibleLabel` to also show text
 * next to the box.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  visibleLabel,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name only — read by screen readers, never shown on screen. */
  label?: string;
  /** Text rendered next to the box, in addition to `label`. */
  visibleLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className={cn("inline-flex cursor-pointer items-center", className)}>
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={label}
          className="peer absolute inset-0 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-colors checked:border-brand-500 checked:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400/50 focus-visible:outline-none dark:border-white/20 dark:bg-navy-800 dark:checked:border-brand-400 dark:checked:bg-brand-500"
        />
        {(checked || indeterminate) && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
            {indeterminate ? <Minus className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
        )}
      </span>
      {visibleLabel && <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">{visibleLabel}</span>}
    </label>
  );
}
