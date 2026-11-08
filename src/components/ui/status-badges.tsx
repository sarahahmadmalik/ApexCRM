import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AngebotStatus, ContractStatus, InvoiceStatus } from "@/lib/types/database";
import type { Option } from "@/components/ui/combobox";

/**
 * One home for the status badges on the Offers, Invoices and Contracts pages —
 * same pill shape as the firm status badges (soft tint + dot), each with a
 * label and a one-line meaning that shows as a tooltip, in the status menu and
 * in the filter dropdowns. Tints stay inside the app's existing status palette.
 */

type StatusMeta = {
  label: string;
  /** What the status means — used as the badge tooltip and in menus. */
  description: string;
  /** Tint classes (light + dark) for the pill. */
  className: string;
  /** Solid dot colour. */
  dot: string;
};

const SLATE = "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20";
const BLUE = "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20";
const EMERALD = "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20";
const RED = "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20";
const AMBER = "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20";
const GRAY = "bg-gray-100 text-gray-500 ring-gray-400/20 dark:bg-white/5 dark:text-gray-400 dark:ring-white/10";

export const OFFER_STATUS: Record<AngebotStatus, StatusMeta> = {
  draft: { label: "Draft", description: "Being prepared, not sent yet", className: SLATE, dot: "bg-slate-400" },
  sent: { label: "Sent", description: "Sent to the firm, waiting for an answer", className: BLUE, dot: "bg-blue-500" },
  accepted: { label: "Accepted", description: "The firm accepted — it becomes a client", className: EMERALD, dot: "bg-emerald-500" },
  rejected: { label: "Rejected", description: "The firm turned the offer down", className: RED, dot: "bg-red-500" },
};
export const OFFER_STATUS_ORDER: AngebotStatus[] = ["draft", "sent", "accepted", "rejected"];

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  draft: { label: "Draft", description: "Being prepared, not sent yet", className: SLATE, dot: "bg-slate-400" },
  sent: { label: "Sent", description: "Sent to the client, payment pending", className: BLUE, dot: "bg-blue-500" },
  paid: { label: "Paid", description: "Payment received", className: EMERALD, dot: "bg-emerald-500" },
  overdue: { label: "Overdue", description: "Past the due date and still unpaid", className: RED, dot: "bg-red-500" },
  cancelled: { label: "Cancelled", description: "Voided — no payment expected", className: GRAY, dot: "bg-gray-400" },
};
export const INVOICE_STATUS_ORDER: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];

export const CONTRACT_STATUS: Record<ContractStatus, StatusMeta> = {
  draft: { label: "Template pending", description: "Details saved, the Word document isn't generated yet", className: AMBER, dot: "bg-amber-500" },
  final: { label: "Document ready", description: "The contract document has been generated", className: EMERALD, dot: "bg-emerald-500" },
};
export const CONTRACT_STATUS_ORDER: ContractStatus[] = ["draft", "final"];

function MetaBadge({ meta, className }: { meta: StatusMeta; className?: string }) {
  return (
    <Badge className={cn("gap-1.5", meta.className, className)} title={meta.description}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function OfferStatusBadge({ status, className }: { status: AngebotStatus; className?: string }) {
  return <MetaBadge meta={OFFER_STATUS[status]} className={className} />;
}

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return <MetaBadge meta={INVOICE_STATUS[status]} className={className} />;
}

export function ContractStatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  return <MetaBadge meta={CONTRACT_STATUS[status]} className={className} />;
}

/**
 * Filter-dropdown options for a status column: an "All" entry plus one row per
 * status showing its badge and how many records have it.
 */
export function statusFilterOptions<T extends string>({
  meta,
  order,
  items,
  allLabel,
}: {
  meta: Record<T, StatusMeta>;
  order: readonly T[];
  items: readonly { status: T }[];
  allLabel: string;
}): Option[] {
  return [
    { value: "ALL", label: `${allLabel} (${items.length})`, hint: String(items.length) },
    ...order.map((s) => {
      const count = items.filter((i) => i.status === s).length;
      return {
        value: s,
        label: `${meta[s].label} (${count})`,
        hint: String(count),
        badge: <MetaBadge meta={meta[s]} />,
      };
    }),
  ];
}
