import { CountryFlag } from "@/components/ui/country-flag";

export type CountryBenchmarkRow = { country: string; completed: number; total: number };

export function CountryBenchmark({ rows }: { rows: CountryBenchmarkRow[] }) {
  if (rows.length === 0) {
    return <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No regional data available.</div>;
  }

  const getProgressColor = (pct: number) => {
    if (pct < 30) return "bg-red-500";
    if (pct < 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  // Furthest along first, then alphabetical — with 27 countries the active ones should be on top.
  const sorted = [...rows].sort((a, b) => {
    const pa = a.total > 0 ? a.completed / a.total : 0;
    const pb = b.total > 0 ? b.completed / b.total : 0;
    return pb - pa || b.completed - a.completed || a.country.localeCompare(b.country);
  });

  return (
    // Capped height + its own scrollbar, so the long country list never stretches the page.
    <div className="max-h-[420px] space-y-5 overflow-y-auto pr-2" tabIndex={0} aria-label="Countries, scrollable">
      {sorted.map((row) => {
        const pct = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
        return (
          <div key={row.country} className="group">
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-2">
                <CountryFlag country={row.country} className="h-4 w-6" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">{row.country}</span>
                <span className="hidden text-xs font-medium tracking-widest text-gray-400 uppercase sm:inline-block dark:text-gray-500">
                  &middot; {row.total} MARKETS
                </span>
              </div>
              <span className="font-mono-brand text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div 
                className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(pct)}`} 
                style={{ width: `${pct}%` }} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
