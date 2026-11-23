import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { MapWithPeek } from "@/components/dashboard/map-with-peek";
import { CountryPills } from "@/components/dashboard/country-pills";
import { CountryBenchmark } from "@/components/dashboard/country-benchmark";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import { COUNTRY_NAMES, citiesForCountry } from "@/lib/data/geo";
import { buildTrend, pickTrendBaseline, sparklinePath } from "@/lib/data/trends";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  UserPlus,
  FolderKanban,
  CalendarClock,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { CityManualStatus, FirmStatus } from "@/lib/types/database";
import { requirePageAccess } from "@/lib/auth/guards";

async function countByStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: FirmStatus
) {
  const { count } = await supabase
    .from("firms")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  await requirePageAccess("dashboard");
  const { country: countryParam } = await searchParams;
  const supabase = await createClient();

  // Resolve the country first so the firm list below can be filtered in SQL: fetching every firm and
  // filtering in JS was slower and silently capped at 1000 rows (there are more firms than that).
  const selectedCountry =
    countryParam ??
    (await supabase.from("firms").select("country").order("created_at", { ascending: false }).limit(1).maybeSingle()).data
      ?.country ??
    "Germany";

  const [
    inProgress,
    sent,
    responded,
    negotiation,
    clients,
    cityRows,
    allFirmsForCountry,
    activity,
    snapshots,
    openingsRes,
    candidatesRes,
    projectsRes,
    leavesRes,
    expensesRes,
    payrollRes,
  ] = await Promise.all([
    countByStatus(supabase, "in_progress"),
    countByStatus(supabase, "sent"),
    countByStatus(supabase, "responded"),
    countByStatus(supabase, "negotiation"),
    countByStatus(supabase, "client"),
    supabase.from("city_status").select("*"),
    supabase.from("firms").select("id, name, status, country, state, city").eq("country", selectedCountry).limit(1000),
    supabase.from("firm_status_history_feed").select("*").limit(8),
    supabase.from("dashboard_daily_snapshot").select("*").order("snapshot_date", { ascending: true }),
    supabase.from("job_openings").select("id, status"),
    supabase.from("job_candidates").select("id, stage"),
    supabase.from("projects").select("id, status, budget, progress"),
    supabase.from("leave_requests").select("id, status, days_count"),
    supabase.from("expense_claims").select("id, status, amount"),
    supabase.from("payroll_runs").select("id, gross_total, period_label").order("pay_date", { ascending: false }).limit(1),
  ]);

  const openingsList = openingsRes.data ?? [];
  const candidatesList = candidatesRes.data ?? [];
  const projectsList = projectsRes.data ?? [];
  const leavesList = leavesRes.data ?? [];
  const expensesList = expensesRes.data ?? [];
  const payrollList = payrollRes.data ?? [];

  const allCityRows = cityRows.data ?? [];

  // Per-city status for the selected country's markers/peek panel
  const cityStatuses: Record<string, CityManualStatus> = {};
  allCityRows
    .filter((r) => r.country === selectedCountry)
    .forEach((r) => {
      cityStatuses[`${r.state}|${r.city}`] = r.status;
    });

  const firmsByCity: Record<string, { id: string; name: string; status: FirmStatus }[]> = {};
  (allFirmsForCountry.data ?? [])
    .filter((f) => f.country === selectedCountry)
    .forEach((f) => {
      const key = `${f.state}|${f.city}`;
      (firmsByCity[key] ??= []).push({ id: f.id, name: f.name, status: f.status });
    });

  // Denominator is every city we track for that country (geo.ts), not just
  // ones that already have a firm/manual-override row — so a country with
  // zero outreach yet still shows "0 / 24 cities", not "0 / 0".
  const benchmarkRows = COUNTRY_NAMES.map((country) => {
    const completed = allCityRows.filter((r) => r.country === country && r.status === "completed").length;
    return { country, completed, total: citiesForCountry(country).length };
  });

  const activityRows = activity.data ?? [];
  const activityUnavailable = Boolean(activity.error);
  const pageError = cityRows.error ?? allFirmsForCountry.error;

  const totalContacted = inProgress + sent + responded + negotiation + clients;
  const inProgressRate = totalContacted > 0 ? Math.round((inProgress / totalContacted) * 100) : 0;
  const replyRate = totalContacted > 0 ? ((responded / totalContacted) * 100).toFixed(1) : "0.0";
  const conversionRate = totalContacted > 0 ? ((clients / totalContacted) * 100).toFixed(1) : "0.0";

  const getProgressColor = (pct: number) => {
    if (pct < 30) return "bg-red-500";
    if (pct < 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const snapshotRows = snapshots.data ?? [];
  const baselineInfo = pickTrendBaseline(snapshotRows);
  const baseline = baselineInfo?.row ?? null;
  const trendDays = baselineInfo?.days ?? 30;
  const baselineContacted = baseline
    ? baseline.sent_count + baseline.responded_count + baseline.negotiation_count + baseline.client_count + baseline.in_progress_count
    : null;

  const contactedTrend = buildTrend(totalContacted, baselineContacted, trendDays);
  const inProgressTrend = buildTrend(inProgress, baseline?.in_progress_count ?? null, trendDays);
  const respondedTrend = buildTrend(responded, baseline?.responded_count ?? null, trendDays);
  const clientsTrend = buildTrend(clients, baseline?.client_count ?? null, trendDays);

  const contactedSeries = [
    ...snapshotRows
      .slice(-13)
      .map((r) => r.sent_count + r.responded_count + r.negotiation_count + r.client_count + r.in_progress_count),
    totalContacted,
  ];
  const contactedSpark = sparklinePath(contactedSeries);
  const clientsSpark = sparklinePath([...snapshotRows.slice(-13).map((r) => r.client_count), clients]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Overview"
        description="Unified CRM outreach, talent acquisition, client project delivery, and financial operations command center"
      />

      {pageError && <ErrorNotice message={pageError.message} />}

      {/* KPI Top Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Contacted */}
        <Card className="relative overflow-hidden p-5 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold dark:text-gray-400">Total Firms Contacted</span>
              <span className="text-2xl sm:text-3xl text-gray-900 tracking-tight mt-1 font-bold dark:text-gray-100">{totalContacted.toLocaleString()}</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 dark:bg-white/10 dark:text-gray-300">
              <span className="material-symbols-outlined text-[22px]">contact_mail</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <TrendBadge trend={contactedTrend} />
            {contactedSpark ? (
              <svg className="w-20 h-6 overflow-visible text-brand-500 dark:text-brand-400" fill="none" viewBox="0 0 80 24">
                <path d={contactedSpark.line} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d={contactedSpark.area} fill="currentColor" fillOpacity="0.1" />
              </svg>
            ) : (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Building history...</span>
            )}
          </div>
        </Card>

        {/* Card 2: Firms In Progress */}
        <Card className="relative overflow-hidden p-5 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold dark:text-gray-400">Firms In Progress</span>
              <span className="text-2xl sm:text-3xl text-gray-900 tracking-tight mt-1 font-bold dark:text-gray-100">{inProgress.toLocaleString()}</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <span className="material-symbols-outlined text-[22px]">hourglass_top</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold dark:bg-brand-500/10 dark:text-brand-300">{inProgressRate}% active rate</span>
              <span className="text-gray-400 text-xs font-medium dark:text-gray-500">
                {inProgressTrend ? inProgressTrend.label : "in cadence"}
              </span>
            </div>
            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden dark:bg-white/10">
              <div className={`${getProgressColor(inProgressRate)} h-1.5 rounded-full`} style={{ width: `${inProgressRate}%` }}></div>
            </div>
          </div>
        </Card>

        {/* Card 3: Responded */}
        <Card className="relative overflow-hidden p-5 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold dark:text-gray-400">Firms Responded</span>
              <span className="text-2xl sm:text-3xl text-gray-900 tracking-tight mt-1 font-bold dark:text-gray-100">{responded.toLocaleString()}</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <span className="material-symbols-outlined text-[22px]">quickreply</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold dark:bg-indigo-500/10 dark:text-indigo-300">{replyRate}% reply rate</span>
              <span className="text-gray-400 text-xs font-medium dark:text-gray-500">
                {respondedTrend ? respondedTrend.label : "Collecting daily history…"}
              </span>
            </div>
            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden dark:bg-white/10">
              <div className={`${getProgressColor(parseFloat(replyRate))} h-1.5 rounded-full`} style={{ width: `${replyRate}%` }}></div>
            </div>
          </div>
        </Card>

        {/* Card 4: New Clients */}
        <Card className="relative overflow-hidden p-5 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold dark:text-gray-400">Clients Won</span>
              <span className="text-2xl sm:text-3xl text-emerald-600 tracking-tight mt-1 font-bold dark:text-emerald-400">{clients.toLocaleString()}</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold dark:bg-emerald-500/10 dark:text-emerald-300">
                {conversionRate}% conversion
              </span>
              <TrendBadge trend={clientsTrend} />
            </div>
            {clientsSpark && (
              <svg className="w-20 h-6 overflow-visible text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 80 24">
                <path d={clientsSpark.line} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d={clientsSpark.area} fill="currentColor" fillOpacity="0.14" />
              </svg>
            )}
          </div>
        </Card>
      </div>

      {/* Enterprise Modules Quick-Pulse Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/hiring"
          className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-white/10 dark:bg-navy-900 dark:hover:border-brand-400"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-brand-600 uppercase dark:text-brand-400">
              <UserPlus className="h-4 w-4" />
              Hiring &amp; ATS
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p className="font-display text-xl font-bold text-gray-900 dark:text-white">
                {openingsList.filter((j) => j.status === "open").length} Open Roles
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {candidatesList.length} candidates in pipeline ·{" "}
                {candidatesList.filter((c) => c.stage === "interview" || c.stage === "offer").length} active interviews/offers
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/projects"
          className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-white/10 dark:bg-navy-900 dark:hover:border-brand-400"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-400">
              <FolderKanban className="h-4 w-4" />
              Projects &amp; Tasks
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p className="font-display text-xl font-bold text-gray-900 dark:text-white">
                {projectsList.filter((p) => p.status === "active").length} Active Projects
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(projectsList.reduce((s, p) => s + Number(p.budget ?? 0), 0))} total portfolio value
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/time-leave"
          className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-white/10 dark:bg-navy-900 dark:hover:border-brand-400"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
              <CalendarClock className="h-4 w-4" />
              Time &amp; Leave
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p className="font-display text-xl font-bold text-gray-900 dark:text-white">
                {leavesList.filter((l) => l.status === "pending").length} Pending PTO
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {leavesList.filter((l) => l.status === "approved").reduce((s, l) => s + Number(l.days_count ?? 0), 0)}{" "}
                approved leave days scheduled
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/expenses"
          className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-white/10 dark:bg-navy-900 dark:hover:border-brand-400"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
              <Wallet className="h-4 w-4" />
              Expenses &amp; Payroll
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p className="font-display text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(payrollList[0]?.gross_total ?? 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {payrollList[0]?.period_label ?? "Current"} payroll ·{" "}
                {expensesList.filter((e) => e.status === "pending").length} pending claims
              </p>
            </div>
          </div>
        </Link>
      </div>

      <Card className="card-in card-in-4 shadow-sm">
        <CardHeader
          title="Geographic Coverage"
          description="Every tracked city in this market, plotted as a dot: gray/amber/green track outreach status, purple marks a city with a client on board."
          action={<CountryPills value={selectedCountry} />}
        />
        <MapWithPeek country={selectedCountry} cityStatuses={cityStatuses} firmsByCity={firmsByCity} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-in card-in-5 shadow-sm min-w-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-5 dark:border-white/10">
            <div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-gray-900 leading-none dark:text-gray-100">Real-Time Activity Log</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Live feed of status progressions and firm engagements.</p>
            </div>
          </div>
          <div className="px-3 py-4 pb-5 sm:px-5">
            <ActivityFeed rows={activityRows} unavailable={activityUnavailable} />
          </div>
        </Card>

        <Card className="card-in card-in-6 shadow-sm flex flex-col min-w-0">
          <CardHeader title="Regional Penetration" description="Market saturation metrics categorized by country." />
          <div className="flex-1 px-5 py-4">
            <CountryBenchmark rows={benchmarkRows} />
          </div>
          <div className="border-t border-gray-100 bg-brand-50 px-5 py-3 text-center dark:border-white/10 dark:bg-brand-500/10">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Performance Metrics</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_CLASS = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-600 dark:text-rose-400",
  flat: "text-gray-400 dark:text-gray-500",
};

function TrendBadge({ trend }: { trend: ReturnType<typeof buildTrend> }) {
  if (!trend) {
    return <span className="text-[11px] text-gray-400 dark:text-gray-500">Collecting daily history…</span>;
  }
  const Icon = TREND_ICON[trend.direction];
  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-semibold", TREND_CLASS[trend.direction])}>
      <Icon className="h-3.5 w-3.5" />
      <span>{trend.label}</span>
    </div>
  );
}
