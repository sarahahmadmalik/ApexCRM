"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw, PauseCircle, ShieldCheck, MapPinned, Users, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditCityDialog } from "@/components/cities/edit-city-dialog";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CITY_STATUS_BADGE_COLORS, CITY_STATUS_HEX, CITY_STATUS_LABELS, cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { FilterBar } from "@/components/ui/filter-bar";
import { Card, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { StatusMenu } from "@/components/ui/status-menu";
import { TableShell, TableHead, TableEmptyState } from "@/components/ui/table-shell";
import type { CityRow } from "@/components/cities/city-row";
import type { CityManualStatus } from "@/lib/types/database";
import { setCityOverride } from "@/app/(app)/cities/actions";
import { useSort } from "@/lib/hooks/use-sort";
import { useCanWrite } from "@/components/auth/permissions-provider";

const STATUS_ORDER: CityManualStatus[] = ["not_started", "in_progress", "completed"];

function CityStatusBadge({ status }: { status: CityManualStatus }) {
  const isInProgress = status === "in_progress";
  return (
    <span
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase ring-1 ring-inset",
        CITY_STATUS_BADGE_COLORS[status]
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", isInProgress && "animate-pulse")}
        style={{ backgroundColor: CITY_STATUS_HEX[status] }}
      />
      {CITY_STATUS_LABELS[status]}
    </span>
  );
}

export type CityFilterState = { q: string; state: string; status: string };
export type CityStatusCounts = { all: number; completed: number; in_progress: number; not_started: number };

export function CityStatusTable({
  rows,
  currentPage = 1,
  totalCount = 0,
  pageSize = 15,
  activeCountry = "Germany",
  states,
  statusCounts,
  filters,
}: {
  /** Only the current page of the (already filtered and sorted) cities. */
  rows: CityRow[];
  currentPage?: number;
  /** Cities matching the filters, across all pages. */
  totalCount?: number;
  pageSize?: number;
  activeCountry?: string;
  /** Every region of the country (not just the ones on this page). */
  states: string[];
  /** Whole-country totals per status, for the filter labels. */
  statusCounts: CityStatusCounts;
  filters: CityFilterState;
}) {
  // Search, state and status live in the URL and are applied by the server to the country's FULL city list,
  // so they find cities on any page (filtering just the visible page would hide almost everything).
  const [searchVal, setSearchVal] = useState(filters.q);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<CityRow | null>(null);
  const canWrite = useCanWrite("cities");
  const [, startTransition] = useTransition();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === "ALL") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in patch)) params.delete("page"); // a new filter starts from page 1
    router.push(`${pathname}?${params.toString()}`);
  }

  function setPage(p: number) {
    pushParams({ page: p === 1 ? null : String(p) });
  }

  // Debounce typing so every keystroke isn't a server round trip.
  useEffect(() => {
    if (searchVal.trim() === filters.q) return;
    const t = setTimeout(() => pushParams({ q: searchVal.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchVal]);

  const stateVal = filters.state || "ALL";
  const statusFilter = filters.status || "ALL";
  const hasFilters = !!filters.q || stateVal !== "ALL" || statusFilter !== "ALL";
  const activeFilterCount = (stateVal !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0);

  const { sorted: sortedRows, sortBy: auditSortBy, sortDir: auditSortDir, onSort: onAuditSort } = useSort(
    rows,
    (row, key) => {
      switch (key) {
        case "city":
          return row.city;
        case "firms":
          return row.firm_count;
        case "status":
          return row.status;
        default:
          return null;
      }
    }
  );

  function clearAll() {
    setSearchVal("");
    pushParams({ q: null, state: null, status: null });
  }

  async function handleStatusChange(row: CityRow, status: CityManualStatus) {
    const key = `${row.country}-${row.state}-${row.city}`;
    setPendingKey(key);
    try {
      await setCityOverride(row.country, row.state, row.city, status, row.note ?? "");
      toast.success(`${row.city} marked as ${CITY_STATUS_LABELS[status]}`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setPendingKey(null);
    }
  }

  const editButton = (row: CityRow) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setEditing(row)}
      aria-label={`Edit ${row.city}`}
    >
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </Button>
  );

  return (
    <>
      <EditCityDialog
        key={editing ? `${editing.country}-${editing.state}-${editing.city}` : "none"}
        city={editing}
        onClose={() => setEditing(null)}
        onSaved={() => startTransition(() => router.refresh())}
      />
      <FilterBar
        activeCount={activeFilterCount}
        onClearAll={clearAll}
        search={{ value: searchVal, onChange: setSearchVal, placeholder: `Search ${activeCountry} cities or regions...` }}
      >
        <Combobox
          options={[{ value: "ALL", label: `All states (${states.length})` }, ...states.map((st) => ({ value: st, label: st }))]}
          value={stateVal}
          onChange={(v) => pushParams({ state: v })}
          placeholder="All states"
        />
        <Combobox
          options={[
            { value: "ALL", label: `All cities (${statusCounts.all})` },
            { value: "in_progress", label: `In progress (${statusCounts.in_progress})` },
            { value: "completed", label: `Completed (${statusCounts.completed})` },
            { value: "not_started", label: `Not started (${statusCounts.not_started})` },
          ]}
          value={statusFilter}
          onChange={(v) => pushParams({ status: v })}
          placeholder="All cities"
        />
      </FilterBar>

      {/* City cards */}
      {rows.length === 0 ? (
        <div className="mb-6 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-white/15 dark:bg-navy-900">
          <MapPinned className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No cities found</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {hasFilters
              ? "No cities match your current search and filters."
              : `No cities tracked for ${activeCountry} yet.`}
          </p>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const isCompleted = row.status === "completed";
            const isInProgress = row.status === "in_progress";
            const key = `${row.country}-${row.state}-${row.city}`;
            const busy = pendingKey === key;

            let Icon = PauseCircle;
            if (isCompleted) Icon = ShieldCheck;
            if (isInProgress) Icon = RefreshCw;

            return (
              <div
                key={key}
                className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md dark:border-white/10 dark:bg-navy-900"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="font-display truncate text-base font-semibold tracking-tight text-gray-900 sm:text-lg dark:text-gray-100">
                          {row.city}
                        </h2>
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isCompleted ? "text-emerald-500" : isInProgress ? "text-amber-500" : "text-slate-400"
                          )}
                        />
                      </div>
                      <span className="text-[11px] tracking-wider text-gray-400 uppercase dark:text-gray-500">
                        {row.state} · {row.country}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center">
                      {canWrite ? (
                        <StatusMenu
                          value={row.status}
                          options={STATUS_ORDER}
                          renderBadge={(s) => <CityStatusBadge status={s} />}
                          onChange={(status) => handleStatusChange(row, status)}
                          disabled={busy}
                        />
                      ) : (
                        <CityStatusBadge status={row.status} />
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                        Firms tracked
                      </span>
                      <span className="font-mono-brand font-semibold text-gray-900 dark:text-gray-100">
                        {row.firm_count}
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isCompleted ? "bg-emerald-500" : isInProgress ? "bg-amber-500" : "bg-slate-400"
                        )}
                        style={{ width: isCompleted ? "100%" : isInProgress ? "50%" : "0%" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Status is set by hand only — the tool has no way to know
                    how many firms actually exist in an area, so it can't be
                    computed. */}
                {row.note && (
                  <p className="mt-3 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{row.note}</p>
                )}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {row.is_manual_override ? "Status set manually" : "Not set yet."}
                  </p>
                  {canWrite && editButton(row)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalCount > pageSize && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
          <Pagination currentPage={currentPage} totalItems={totalCount} pageSize={pageSize} onPageChange={setPage} />
        </div>
      )}

      {/* Regional breakdown */}
      <Card>
        <CardHeader
          title={`${activeCountry} completion audit`}
          description="Every tracked city in this market. Click a status to update it."
        />
        <TableShell
          className="rounded-none border-0 bg-transparent dark:bg-transparent"
          footer={
            totalCount > pageSize ? (
              <Pagination
                currentPage={currentPage}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            ) : null
          }
        >
          <table className="w-full min-w-[560px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "City & region", width: canWrite ? "w-[38%]" : "w-[46%]", sortKey: "city" },
                { label: "Total targets", width: canWrite ? "w-[20%]" : "w-[22%]", sortKey: "firms" },
                { label: "Lifecycle state", width: canWrite ? "w-[26%]" : "w-[32%]", sortKey: "status" },
                ...(canWrite ? [{ label: "", width: "w-[16%]" }] : []),
              ]}
              sortBy={auditSortBy}
              sortDir={auditSortDir}
              onSort={onAuditSort}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {rows.length === 0 ? (
                <TableEmptyState
                  colSpan={canWrite ? 4 : 3}
                  icon={MapPinned}
                  title="No cities tracked"
                  description={`No cities recorded for ${activeCountry} yet.`}
                />
              ) : (
                sortedRows.map((row) => {
                  const key = `audit-${row.state}-${row.city}`;
                  const busy = pendingKey === `${row.country}-${row.state}-${row.city}`;
                  return (
                    <tr key={key} className="h-12 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: CITY_STATUS_HEX[row.status] }}
                          />
                          <span className="truncate">
                            {row.city} <span className="text-gray-400 dark:text-gray-500">({row.state})</span>
                          </span>
                        </span>
                      </td>
                      <td className="font-mono-brand px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                          {row.firm_count} firms
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                          <StatusMenu
                            value={row.status}
                            options={STATUS_ORDER}
                            renderBadge={(s) => <CityStatusBadge status={s} />}
                            onChange={(status) => handleStatusChange(row, status)}
                            disabled={busy}
                          />
                        ) : (
                          <CityStatusBadge status={row.status} />
                        )}
                      </td>
                      {canWrite && <td className="px-4 py-3 text-right">{editButton(row)}</td>}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableShell>
      </Card>
    </>
  );
}
