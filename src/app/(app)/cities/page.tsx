import { createClient } from "@/lib/supabase/server";
import { CityStatusTable } from "@/components/cities/city-status-table";
import type { CityRow } from "@/components/cities/city-row";
import { ShieldCheck, ListTodo, Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import { COUNTRY_NAMES } from "@/lib/data/geo";
import { buildCityRows } from "@/lib/data/city-status";
import { countByStatus, filterCityRows, sortCityRows } from "@/lib/data/city-filter";
import { CountryPills } from "@/components/dashboard/country-pills";
import { cn } from "@/lib/utils";
import { requirePageAccess } from "@/lib/auth/guards";

const PAGE_SIZE = 12;

export default async function CitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; country?: string; q?: string; state?: string; status?: string }>;
}) {
  await requirePageAccess("cities");
  const { page: pageParam, country: countryParam, q, state, status } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  // One unfiltered fetch (city_status has one row per city that has firms or a manual status).
  const { data, error } = await supabase.from("city_status").select("*");
  const dbRows = (data ?? []) as CityRow[];

  // Default to the country with the most firms, so the page opens on the market that's being worked.
  const firmsByCountry = new Map<string, number>();
  for (const r of dbRows) firmsByCountry.set(r.country, (firmsByCountry.get(r.country) ?? 0) + r.firm_count);
  const busiest = [...firmsByCountry.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const activeCountry = COUNTRY_NAMES.includes(countryParam ?? "") ? (countryParam as string) : (busiest ?? "Germany");

  // Every city we track for this country — with or without firm data — is the base list.
  const allRowsForCountry = buildCityRows(activeCountry, dbRows);
  const statusCounts = countByStatus(allRowsForCountry);
  const states = Array.from(new Set(allRowsForCountry.map((r) => r.state))).sort((a, b) => a.localeCompare(b));

  // Filters and paging run on the FULL list, so a search / region / status filter finds cities on any page.
  const filters = { q: q ?? "", state: states.includes(state ?? "") ? (state as string) : "", status: ["completed", "in_progress", "not_started"].includes(status ?? "") ? (status as string) : "" };
  const matching = sortCityRows(filterCityRows(allRowsForCountry, filters), { by: "activity", dir: "desc" });
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Percentages are for the selected country's own full city list.
  const totalForCountry = statusCounts.all;
  const completed = statusCounts.completed;
  const inProgress = statusCounts.in_progress;
  const notStarted = statusCounts.not_started;

  const pct = (n: number) => (totalForCountry > 0 ? Math.round((n / totalForCountry) * 1000) / 10 : 0);

  const stats = [
    {
      label: "Completed cities",
      value: completed,
      percent: pct(completed),
      icon: ShieldCheck,
      iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
      pillClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
      barClass: "bg-emerald-500",
    },
    {
      label: "In progress cities",
      value: inProgress,
      percent: pct(inProgress),
      icon: ListTodo,
      iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
      pillClass: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
      barClass: "bg-amber-500",
    },
    {
      label: "Not started cities",
      value: notStarted,
      percent: pct(notStarted),
      icon: Hourglass,
      iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-400/10 dark:text-slate-300",
      pillClass: "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300",
      barClass: "bg-slate-400",
    },
  ];

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="City Progress"
        description="Not started and in progress are detected automatically from firm data. Completed status is set by hand, since the tool cannot know when a city's firm list is complete."
      />

      {/* Country dropdown (27 countries don't fit as tabs) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <CountryPills value={activeCountry} resetParams={["page", "q", "state", "status"]} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{totalForCountry.toLocaleString()}</span> cities tracked in {activeCountry}
          {" · "}
          <span className="font-semibold text-amber-600 dark:text-amber-400">{inProgress}</span> in progress
          {" · "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{completed}</span> completed
        </p>
      </div>

      {/* Metric overview — same card anatomy as the dashboard KPI strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="group flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    {stat.label}
                  </span>
                  <span className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
                    {stat.value.toLocaleString()}
                  </span>
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.iconClass)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", stat.pillClass)}>
                  {stat.percent}% of {activeCountry}
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className={cn("h-1.5 rounded-full", stat.barClass)} style={{ width: `${stat.percent}%` }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {error ? (
        <ErrorNotice message={error.message} />
      ) : (
        <CityStatusTable
          rows={rows}
          currentPage={currentPage}
          totalCount={matching.length}
          pageSize={PAGE_SIZE}
          activeCountry={activeCountry}
          states={states}
          statusCounts={statusCounts}
          filters={filters}
        />
      )}
    </div>
  );
}
