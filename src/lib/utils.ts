import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value)
  );
}

export const FIRM_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  sent: "Sent",
  responded: "Responded",
  negotiation: "Negotiation",
  client: "Client",
};

// Each pill carries its own dark-mode tint so badges stay legible on the dark
// canvas without every call site having to add `dark:` variants.
export const FIRM_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
  sent: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  responded: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
  negotiation: "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/20",
  client: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
};

/**
 * Tints for firm/person avatars. Deliberately the same palette as the status
 * pills — no colours outside it — and applied by row index so they cycle in a
 * predictable pattern instead of hashing (which kept repeating a colour on
 * adjacent rows).
 */
export const AVATAR_TINTS = [
  "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
  "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/20",
  "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
  "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20",
];

export function avatarTint(index: number) {
  return AVATAR_TINTS[index % AVATAR_TINTS.length];
}

/** Solid dot colors for the same statuses, used next to badges / in tables. */
export const FIRM_STATUS_DOT: Record<string, string> = {
  not_started: "bg-slate-400",
  in_progress: "bg-blue-600",
  sent: "bg-amber-500",
  responded: "bg-violet-500",
  negotiation: "bg-cyan-600",
  client: "bg-emerald-500",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
};

export const ANGEBOT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
};

export const SALARY_PERIOD_LABELS: Record<string, string> = {
  month: "per month",
  year: "per year",
};

/** "4.500,00 € / month" — the one salary display format (tables, contract documents). */
export function formatSalary(amount: number | null | undefined, period: string | null | undefined) {
  if (amount == null || !period) return "—";
  return `${formatCurrency(amount)} / ${period === "year" ? "year" : "month"}`;
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const CITY_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export const CITY_STATUS_BADGE_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
};

/** Hex colors used for the map fill / markers — kept separate from the Tailwind badge classes. */
export const CITY_STATUS_HEX: Record<string, string> = {
  not_started: "#94a3b8",
  in_progress: "#f59e0b",
  completed: "#10b981",
};

/** Map-marker color for a city that has landed at least one client firm — takes
 * priority over the status color, since it's the single most notable outcome. */
export const CITY_CLIENT_HEX = "#8b5cf6";

export function calcTotals(lineItems: { unit_price: number; total: number }[], vatRate: number) {
  const net = lineItems.reduce((sum, li) => sum + (Number(li.total) || 0), 0);
  const vat = Math.round(net * (vatRate / 100) * 100) / 100;
  const total = Math.round((net + vat) * 100) / 100;
  return { net: Math.round(net * 100) / 100, vat, total };
}
