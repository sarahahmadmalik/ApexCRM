"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/**
 * Custom date field — a button that opens a calendar popover, never a native
 * `<input type="date">` (those render a different, unstyleable picker per
 * browser/OS and can't be made to match the rest of the UI in either theme).
 * `min`/`max` accept "yyyy-MM-dd" strings; days outside that range are shown
 * but disabled, so the month is never empty next to a boundary.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  disabled,
  clearable = true,
  className,
  invalid,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Shows an inline clear (×) button once a date is picked. Default true. */
  clearable?: boolean;
  className?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? minDate ?? new Date()));

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; flip: boolean } | null>(null);

  function openPicker() {
    if (disabled) return;
    setViewMonth(startOfMonth(selected ?? minDate ?? new Date()));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelHeight = 340;
    const below = window.innerHeight - rect.bottom;
    const flip = below < panelHeight && rect.top > below;
    // Clamp so the calendar never spills past the viewport edge even when
    // neither side has the full 340px (short windows, drawers near the fold).
    const top = flip ? Math.max(panelHeight + 8, rect.top - 6) : Math.min(rect.bottom + 6, window.innerHeight - panelHeight - 8);
    setCoords({
      top: Math.max(8, top),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)),
      flip,
    });
    const close = () => setOpen(false);
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = new Date();

  function isDisabled(day: Date) {
    if (minDate && isBefore(day, minDate) && !isSameDay(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate) && !isSameDay(day, maxDate)) return true;
    return false;
  }

  function pick(day: Date) {
    if (isDisabled(day)) return;
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  }

  const fieldBase =
    "flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-sm transition-all duration-200 ease-in-out outline-none dark:bg-navy-800";
  const fieldState = disabled
    ? "cursor-not-allowed border-gray-200 text-gray-400 dark:border-white/10 dark:text-gray-600"
    : invalid
      ? "cursor-pointer border-red-400 text-gray-900 hover:border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-red-400/60 dark:text-gray-100"
      : "cursor-pointer border-gray-200 text-gray-900 hover:border-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-white/10 dark:text-gray-100 dark:hover:border-white/20 dark:focus:border-brand-400 dark:focus:ring-brand-400/10";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(fieldBase, fieldState, className)}
      >
        <Calendar className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        <span className={cn("flex-1 truncate text-left", !selected && "text-gray-400 dark:text-gray-500")}>
          {selected ? format(selected, "dd MMM yyyy") : placeholder}
        </span>
        {clearable && selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            className={cn(
              "dropdown-menu-pop fixed z-[110] w-[272px] rounded-xl border border-gray-100 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-navy-800",
              coords.flip && "origin-bottom"
            )}
            style={{ top: coords.top, left: coords.left, transform: coords.flip ? "translateY(-100%)" : undefined }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <NavButton label="Previous year" onClick={() => setViewMonth((m) => subMonths(m, 12))}>
                  <ChevronsLeft className="h-4 w-4" />
                </NavButton>
                <NavButton label="Previous month" onClick={() => setViewMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </NavButton>
              </div>
              <span className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">
                {format(viewMonth, "MMMM yyyy")}
              </span>
              <div className="flex items-center gap-0.5">
                <NavButton label="Next month" onClick={() => setViewMonth((m) => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </NavButton>
                <NavButton label="Next year" onClick={() => setViewMonth((m) => addMonths(m, 12))}>
                  <ChevronsRight className="h-4 w-4" />
                </NavButton>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] font-semibold text-gray-400 uppercase dark:text-gray-500">
                  {w}
                </span>
              ))}
              {days.map((day) => {
                const outside = !isSameMonth(day, viewMonth);
                const isToday = isSameDay(day, today);
                const isSelected = selected && isSameDay(day, selected);
                const blocked = isDisabled(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(day)}
                    className={cn(
                      "mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-medium transition-colors",
                      outside && "text-gray-300 dark:text-gray-600",
                      !outside && !blocked && !isSelected && "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                      isToday && !isSelected && "ring-1 ring-inset ring-brand-400 dark:ring-brand-400/60",
                      isSelected && "bg-brand-500 font-semibold text-white hover:bg-brand-600",
                      blocked && "cursor-not-allowed text-gray-300 hover:bg-transparent dark:text-gray-700"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-white/10">
              <button
                type="button"
                onClick={() => pick(new Date())}
                disabled={isDisabled(startOfMonth(today)) && isDisabled(endOfMonth(today))}
                className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:text-brand-400 dark:hover:bg-brand-500/10 dark:disabled:text-gray-600"
              >
                Today
              </button>
              {clearable && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
    >
      {children}
    </button>
  );
}
