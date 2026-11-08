"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one filter strip used above every table/grid: a search box, any number
 * of dropdown filters, and — the same on every page — a collapsed "Filters"
 * button + slide-over drawer once the screen is too narrow for them to sit
 * inline. `flush` drops the standalone card styling for embedding inside
 * another surface (e.g. a TableShell header slot).
 */
export function FilterBar({
  search,
  children,
  activeCount = 0,
  onClearAll,
  drawerTitle = "Filters",
  flush = false,
  className,
}: {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Fires on blur / Enter — lets callers debounce a URL push instead of firing on every keystroke. */
    onCommit?: () => void;
  };
  children?: React.ReactNode;
  /** Shows a count badge on the mobile "Filters" button and a "Clear" link on desktop. */
  activeCount?: number;
  onClearAll?: () => void;
  drawerTitle?: string;
  /** Border-bottom only, no card chrome — for embedding inside another card. */
  flush?: boolean;
  className?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasFilters = Boolean(children);

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        flush
          ? "border-b border-gray-200 px-4 py-3 dark:border-white/10"
          : "mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900",
        className
      )}
    >
      {search && (
        <div className="relative flex-1 lg:max-w-xs lg:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <Input
            type="text"
            value={search.value}
            placeholder={search.placeholder ?? "Search..."}
            onChange={(e) => search.onChange(e.target.value)}
            onBlur={search.onCommit}
            onKeyDown={(e) => e.key === "Enter" && search.onCommit?.()}
            className="pl-9"
          />
        </div>
      )}

      {hasFilters && (
        <>
          {/* Desktop: filters inline. Mobile: one button that opens the drawer. */}
          <div className="hidden flex-1 gap-3 lg:grid lg:grid-cols-4">{children}</div>

          <Button variant="outline" className="shrink-0 lg:hidden" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        </>
      )}

      {onClearAll && activeCount > 0 && (
        <button
          onClick={onClearAll}
          className="hidden shrink-0 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-800 lg:block dark:text-gray-400 dark:hover:text-gray-200"
        >
          Clear
        </button>
      )}

      {hasFilters && drawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-navy-900/40 backdrop-blur-[2px] lg:hidden">
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="slide-over-panel relative flex h-full w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-navy-800">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4 dark:border-white/10 dark:bg-navy-900">
              <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">{drawerTitle}</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
                className="cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
            <div className="flex gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-white/10 dark:bg-navy-900">
              {onClearAll && (
                <Button variant="outline" className="flex-1" onClick={onClearAll}>
                  Clear all
                </Button>
              )}
              <Button variant="outline-fill" className="flex-1" onClick={() => setDrawerOpen(false)}>
                Show results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
