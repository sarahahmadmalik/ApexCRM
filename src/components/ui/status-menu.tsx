"use client";

import type { ReactNode } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

/**
 * The one "click a status badge, pick a new status from a list of badges"
 * interaction, shared by the Firms, Cities, Contracts, Offers and Invoices tables
 * so all four look and behave identically instead of each table having its
 * own near-duplicate popover.
 */
export function StatusMenu<T extends string>({
  value,
  options,
  renderBadge,
  describe,
  onChange,
  disabled,
}: {
  value: T;
  options: readonly T[];
  renderBadge: (value: T) => ReactNode;
  /** One-line meaning of each status, shown under its badge in the menu. */
  describe?: (value: T) => string;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu
      portal
      align="left"
      panelClassName={describe ? "w-64 p-1" : "w-48 p-1"}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          title="Change status"
          className="cursor-pointer rounded-full transition-opacity disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        >
          {renderBadge(value)}
        </button>
      )}
    >
      {(close) =>
        options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              close();
              onChange(opt);
            }}
            className={
              "flex w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5 " +
              (describe ? "flex-col items-start gap-1" : "items-center")
            }
          >
            {renderBadge(opt)}
            {describe && <span className="text-xs leading-snug text-gray-500 dark:text-gray-400">{describe(opt)}</span>}
          </button>
        ))
      }
    </DropdownMenu>
  );
}
