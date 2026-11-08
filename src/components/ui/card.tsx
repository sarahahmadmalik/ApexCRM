import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-navy-900",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:gap-4 sm:px-5 dark:border-white/10">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** vs. ~30 days ago, from dashboard_daily_snapshot — null until that history exists. */
export type StatTrend = { direction: "up" | "down" | "flat"; label: string } | null;

const trendClasses: Record<NonNullable<StatTrend>["direction"], string> = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-gray-400",
};
const trendIcon: Record<NonNullable<StatTrend>["direction"], React.ComponentType<{ className?: string }>> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

/** Icon chip colors — pick a different one per card on a page so a row of stat cards isn't monochrome. */
export type StatTone = "brand" | "emerald" | "amber" | "rose" | "indigo" | "slate";

const toneClasses: Record<StatTone, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300",
};

export function StatCard({
  label,
  value,
  sublabel,
  trend,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: StatTrend;
  icon?: React.ReactNode;
  /** Icon chip color — vary this across a row of stat cards. Defaults to brand. */
  tone?: StatTone;
}) {
  const TrendIcon = trend ? trendIcon[trend.direction] : null;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">{label}</p>
        {icon && (
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneClasses[tone])}>
            {icon}
          </div>
        )}
      </div>
      <p className="font-display mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {trend && TrendIcon ? (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", trendClasses[trend.direction])}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trend.label}
        </p>
      ) : (
        sublabel && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sublabel}</p>
      )}
    </Card>
  );
}
