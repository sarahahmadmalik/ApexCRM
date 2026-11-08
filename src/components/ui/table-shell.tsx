import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared table chrome: rounded bordered surface, horizontal scroll, a
 * consistent min-height so short/empty tables don't collapse, and one
 * empty-state treatment. Every table page uses this.
 */
export function TableShell({
  children,
  header,
  footer,
  className,
}: {
  children: React.ReactNode;
  /** Filter row etc. — rendered flush inside the card but OUTSIDE the
   * horizontal scroll area, so dropdowns aren't clipped and the filters don't
   * slide sideways with the table. */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-navy-900",
        className
      )}
    >
      {header}
      <div className="min-h-[420px] overflow-x-auto">{children}</div>
      {footer}
    </div>
  );
}

export type SortDirection = "asc" | "desc";

export type TableColumn = {
  label: string;
  align?: "left" | "right";
  /**
   * Column width. `w-[1%]` shrink-wraps a column to its content (dates,
   * numbers, action buttons) so the leftover width goes to the columns that
   * actually need it — otherwise the browser spreads width evenly and long
   * text wraps into tall, uneven rows.
   */
  width?: string;
  /** Present to make the column clickable-to-sort — the key passed to `onSort`. */
  sortKey?: string;
};

export function TableHead({
  columns,
  children,
  sortBy,
  sortDir,
  onSort,
}: {
  columns: TableColumn[];
  /** Rendered in the first column's cell instead of its label — the "select all" checkbox for a bulk-select table. */
  children?: React.ReactNode;
  /** The `sortKey` of the column currently sorted on, if any. */
  sortBy?: string | null;
  sortDir?: SortDirection;
  /** Called with a column's `sortKey` when its header is clicked. Omit to render columns as plain (non-sortable) headers even if they declare a `sortKey`. */
  onSort?: (key: string) => void;
}) {
  return (
    <thead className="bg-gray-50 text-left text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:bg-white/5 dark:text-gray-400">
      <tr>
        {columns.map((col, i) => {
          const sortable = onSort && col.sortKey;
          const active = sortable && sortBy === col.sortKey;
          const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
          return (
            <th
              key={col.label || i}
              className={cn("px-4 py-3 whitespace-nowrap", col.align === "right" && "text-right", col.width)}
            >
              {i === 0 && children ? (
                children
              ) : sortable ? (
                <button
                  type="button"
                  onClick={() => onSort(col.sortKey!)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200",
                    col.align === "right" && "flex-row-reverse",
                    active && "text-gray-700 dark:text-gray-200"
                  )}
                >
                  {col.label}
                  <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
                </button>
              ) : (
                col.label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export function TableEmptyState({
  title,
  description,
  colSpan,
  icon: Icon = SearchX,
}: {
  title: string;
  description: string;
  colSpan: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/5">
            <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </td>
    </tr>
  );
}
