"use client";

import { addDays, differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { CalendarRange } from "lucide-react";
import { FormRow } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";

export type ContractDuration = { start: string; end: string };

/** Human summary like "12 months" / "45 days" for a valid start → end range. */
function durationLabel({ start, end }: ContractDuration) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (!isValid(s) || !isValid(e) || e <= s) return null;
  const days = differenceInCalendarDays(e, s);
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30.44);
  return months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} months`;
}

/**
 * Start / end date pair for a contract. The end picker's `min` follows the
 * chosen start date so it can't land on an earlier day; the real rules live
 * in `validateContractDates` and surface through `errors`.
 */
export function ContractDurationFields({
  value,
  onChange,
  errors,
  requireStart,
  requireEnd,
}: {
  value: ContractDuration;
  onChange: (value: ContractDuration) => void;
  errors?: { start?: string; end?: string };
  requireStart?: boolean;
  requireEnd?: boolean;
}) {
  const startDate = value.start ? parseISO(value.start) : null;
  const minEnd = startDate && isValid(startDate) ? format(addDays(startDate, 1), "yyyy-MM-dd") : undefined;
  const summary = value.start && value.end ? durationLabel(value) : null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormRow label="Start date" required={requireStart} error={errors?.start}>
          <DatePicker
            value={value.start}
            min="1990-01-01"
            max="2100-12-31"
            onChange={(v) => onChange({ ...value, start: v })}
            invalid={!!errors?.start}
            placeholder="Select start date"
          />
        </FormRow>
        <FormRow
          label="End date"
          required={requireEnd}
          error={errors?.end}
          hint={requireEnd ? undefined : "Leave empty for an open-ended role"}
        >
          <DatePicker
            value={value.end}
            min={minEnd ?? "1990-01-01"}
            max="2100-12-31"
            onChange={(v) => onChange({ ...value, end: v })}
            invalid={!!errors?.end}
            placeholder="Select end date"
          />
        </FormRow>
      </div>
      {summary && !errors?.start && !errors?.end && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <CalendarRange className="h-3.5 w-3.5" />
          Contract runs {summary}
        </p>
      )}
    </div>
  );
}
