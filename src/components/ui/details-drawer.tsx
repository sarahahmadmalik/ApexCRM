"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { LineItem } from "@/lib/types/database";

/** Read-only slide-over used by every "View details" action. */
export function DetailsDrawer({
  open,
  onClose,
  title,
  description,
  badge,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Status badge etc., shown at the top of the body. */
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      position="right"
      size="md"
      footer={
        footer ?? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      {badge && <div className="mb-5">{badge}</div>}
      <div className="space-y-6">{children}</div>
    </Dialog>
  );
}

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:border-white/10 dark:text-gray-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The 2-3 facts you'd look for first, as large tiles above the detailed sections. */
export function DetailHighlights({ items }: { items: { label: string; value: React.ReactNode; mono?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
        >
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
          <p
            className={cn(
              "mt-0.5 truncate text-base font-semibold text-gray-900 dark:text-gray-100",
              item.mono && "font-mono-brand text-sm"
            )}
            title={typeof item.value === "string" ? item.value : undefined}
          >
            {item.value || "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

export function DetailItem({
  label,
  children,
  mono,
  full,
}: {
  label: string;
  children?: React.ReactNode;
  mono?: boolean;
  /** Spans both columns (long text, notes). */
  full?: boolean;
}) {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-sm leading-relaxed break-words text-gray-900 dark:text-gray-100",
          mono && "font-mono-brand text-[13px]",
          empty && "text-gray-400 dark:text-gray-500"
        )}
      >
        {empty ? "—" : children}
      </dd>
    </div>
  );
}

/** Line items + net / VAT / total, shared by offers and invoices. */
export function LineItemsView({
  items,
  vatRate,
  net,
  vat,
  total,
}: {
  items: LineItem[];
  vatRate: number;
  net: number;
  vat: number;
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:bg-white/5 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Qty</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Unit</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/10">
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400 dark:text-gray-500">
                  No line items
                </td>
              </tr>
            )}
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{item.description}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-gray-600 dark:text-gray-400">{item.quantity}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-gray-600 dark:text-gray-400">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="space-y-1.5 border-t border-gray-200 bg-gray-50/60 px-3 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <dt>Net</dt>
          <dd>{formatCurrency(net)}</dd>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <dt>VAT ({vatRate}%)</dt>
          <dd>{formatCurrency(vat)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1.5 font-semibold text-gray-900 dark:border-white/10 dark:text-gray-100">
          <dt>Total</dt>
          <dd>{formatCurrency(total)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** "19.09.2026, 14:05" — for created/updated timestamps. */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
