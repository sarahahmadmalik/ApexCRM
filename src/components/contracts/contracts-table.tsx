"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileSignature } from "lucide-react";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_ORDER,
  ContractStatusBadge,
  statusFilterOptions,
} from "@/components/ui/status-badges";
import { Combobox } from "@/components/ui/combobox";
import { DownloadMenu } from "@/components/ui/download-menu";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusMenu } from "@/components/ui/status-menu";
import { TableShell, TableHead, TableEmptyState } from "@/components/ui/table-shell";
import { Pagination } from "@/components/ui/pagination";
import { avatarTint, cn, formatDate } from "@/lib/utils";
import type { Database } from "@/lib/types/database";
import { downloadContractDocument, updateContractStatus } from "@/app/(app)/employees/actions";
import { useSort } from "@/lib/hooks/use-sort";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { ViewButton } from "@/components/ui/view-button";
import { ContractDetailsDrawer } from "@/components/details/contract-details-drawer";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Contract = Database["public"]["Tables"]["contracts"]["Row"] & { employees: Pick<Employee, "id" | "full_name" | "email" | "country" | "employment_type"> | null };
type StoredContractData = { position?: string; start_date?: string; end_date?: string | null; salary?: string };

const PAGE_SIZE = 10;

export function ContractsTable({ contracts }: { contracts: Contract[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Contract | null>(null);
  const canWrite = useCanWrite("contracts");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string | null>("ALL");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter && statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (q && !c.employees?.full_name?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contracts, search, statusFilter]);

  const { sorted, sortBy, sortDir, onSort } = useSort(filtered, (c, key) => {
    const data = (c.data ?? {}) as StoredContractData;
    switch (key) {
      case "employee":
        return c.employees?.full_name;
      case "duration":
        return data.start_date;
      case "salary":
        return data.salary;
      case "status":
        return c.status;
      default:
        return null;
    }
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusOptions = statusFilterOptions({ meta: CONTRACT_STATUS, order: CONTRACT_STATUS_ORDER, items: contracts, allLabel: "All contracts" });

  function withReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleStatusChange(contract: Contract, newStatus: "draft" | "final") {
    setBusyId(contract.id);
    try {
      await updateContractStatus(contract.id, newStatus);
      toast.success(`Contract marked as ${newStatus === "final" ? "document ready" : "template pending"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <TableShell
        header={
          <FilterBar
            flush
            activeCount={statusFilter && statusFilter !== "ALL" ? 1 : 0}
            onClearAll={() => withReset(setStatusFilter)("ALL")}
            search={{ value: search, onChange: withReset(setSearch), placeholder: "Search employees..." }}
          >
            <Combobox
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => withReset(setStatusFilter)(v || "ALL")}
              placeholder="All contracts"
            />
          </FilterBar>
        }
        footer={
          filtered.length > PAGE_SIZE ? (
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          ) : null
        }
      >
        <table className="w-full min-w-[860px] table-fixed text-sm">
          <TableHead
            columns={[
              { label: "Employee", width: "w-[26%]", sortKey: "employee" },
              { label: "Duration", width: "w-[22%]", sortKey: "duration" },
              { label: "Salary", width: "w-[16%]", sortKey: "salary" },
              { label: "Status", width: "w-[20%]", sortKey: "status" },
              { label: "Actions", align: "right", width: "w-[16%]" },
            ]}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={(key) => {
              onSort(key);
              setPage(1);
            }}
          />
          <tbody className="divide-y divide-gray-100 dark:divide-white/10">
            {pageRows.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                icon={FileSignature}
                title={contracts.length === 0 ? "No contracts yet" : "No contracts found"}
                description={
                  contracts.length === 0
                    ? "No contracts have been drafted yet. Generate one from an employee to get started."
                    : "No contracts match your current search and filters."
                }
              />
            ) : (
              pageRows.map((c, index) => {
                const data = (c.data ?? {}) as StoredContractData;
                const busy = busyId === c.id;
                return (
                  <tr key={c.id} className="h-12 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-inset",
                            avatarTint((currentPage - 1) * PAGE_SIZE + index)
                          )}
                        >
                          {(c.employees?.full_name ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                            {c.employees?.full_name ?? "—"}
                          </p>
                          <p className="truncate text-xs text-gray-400 dark:text-gray-500">{data.position || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      <p className="truncate">{formatDate(data.start_date)}</p>
                      <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                        {data.end_date ? `until ${formatDate(data.end_date)}` : "Open-ended"}
                      </p>
                    </td>
                    <td className="font-mono-brand px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      <span className="block truncate">{data.salary || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {canWrite ? (
                        <StatusMenu
                          value={c.status}
                          options={CONTRACT_STATUS_ORDER}
                          renderBadge={(s) => <ContractStatusBadge status={s} />}
                          describe={(s) => CONTRACT_STATUS[s].description}
                          onChange={(status) => handleStatusChange(c, status)}
                          disabled={busy}
                        />
                      ) : (
                        <ContractStatusBadge status={c.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ViewButton onClick={() => setViewing(c)} />
                        <DownloadMenu
                          label="Download contract"
                          onDownload={(format) => downloadContractDocument(c.id, format)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>

      <ContractDetailsDrawer
        contract={viewing}
        onClose={() => setViewing(null)}
        statusBadge={viewing ? <ContractStatusBadge status={viewing.status} /> : null}
      />
    </>
  );
}
