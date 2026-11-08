"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Receipt, Trash2 } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { DownloadMenu } from "@/components/ui/download-menu";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusMenu } from "@/components/ui/status-menu";
import { TableShell, TableHead, TableEmptyState } from "@/components/ui/table-shell";
import { Pagination } from "@/components/ui/pagination";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { avatarTint, cn, INVOICE_STATUS_LABELS, formatCurrency, formatDate } from "@/lib/utils";
import {
  INVOICE_STATUS,
  INVOICE_STATUS_ORDER,
  InvoiceStatusBadge,
  statusFilterOptions,
} from "@/components/ui/status-badges";
import type { Database, InvoiceStatus } from "@/lib/types/database";
import { deleteInvoice, downloadInvoiceDocument, updateInvoiceStatus } from "@/app/(app)/invoices/actions";
import { useSort } from "@/lib/hooks/use-sort";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { ViewButton } from "@/components/ui/view-button";
import { InvoiceDetailsDrawer } from "@/components/details/invoice-details-drawer";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & {
  firms: Pick<Firm, "id" | "name" | "city" | "country"> | null;
};

const PAGE_SIZE = 10;
const STATUS_ORDER = INVOICE_STATUS_ORDER;


export function InvoicesTable({
  invoices,
  offerNumbers = {},
}: {
  invoices: Invoice[];
  /** offer id -> offer number, for the "created from offer" line in the details drawer. */
  offerNumbers?: Record<string, string>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const canWrite = useCanWrite("invoices");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string | null>("ALL");
  const [page, setPage] = useState(1);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter && statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (q && !inv.firms?.name?.toLowerCase().includes(q) && !inv.invoice_number?.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [invoices, search, statusFilter]);

  const { sorted, sortBy, sortDir, onSort } = useSort(filtered, (inv, key) => {
    switch (key) {
      case "invoice":
        return inv.invoice_number;
      case "firm":
        return inv.firms?.name;
      case "dates":
        return inv.issue_date;
      case "total":
        return inv.total_amount;
      case "status":
        return inv.status;
      default:
        return null;
    }
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusOptions = statusFilterOptions({ meta: INVOICE_STATUS, order: STATUS_ORDER, items: invoices, allLabel: "All invoices" });

  function withReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleStatus(inv: Invoice, status: InvoiceStatus) {
    setBusyId(inv.id);
    try {
      await updateInvoiceStatus(inv.id, status);
      toast.success(`Invoice marked as ${INVOICE_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(inv: Invoice) {
    setBusyId(inv.id);
    try {
      await deleteInvoice(inv.id);
      toast.success("Invoice deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
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
            search={{ value: search, onChange: withReset(setSearch), placeholder: "Search by firm or invoice number..." }}
          >
            <Combobox
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => withReset(setStatusFilter)(v || "ALL")}
              placeholder="All invoices"
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
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <TableHead
            columns={[
              { label: "Invoice", width: "w-[22%]", sortKey: "invoice" },
              { label: "Firm", width: "w-[24%]", sortKey: "firm" },
              { label: "Dates", width: "w-[16%]", sortKey: "dates" },
              { label: "Total", width: "w-[13%]", sortKey: "total" },
              { label: "Status", width: "w-[14%]", sortKey: "status" },
              { label: "Actions", align: "right", width: "w-[11%]" },
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
                colSpan={6}
                icon={Receipt}
                title={invoices.length === 0 ? "No invoices yet" : "No invoices found"}
                description={
                  invoices.length === 0
                    ? "No invoices have been raised yet. Create one for a client to get started."
                    : "No invoices match your current search and filters."
                }
              />
            ) : (
              pageRows.map((inv, index) => {
                const busy = busyId === inv.id;
                const overdue = inv.status === "sent" && !!inv.due_date && inv.due_date < today;
                return (
                  <tr key={inv.id} className="h-12 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                            avatarTint((currentPage - 1) * PAGE_SIZE + index)
                          )}
                        >
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono-brand truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {inv.invoice_number}
                          </p>
                          {overdue && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-red-600 dark:text-red-400">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              Overdue
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100" title={inv.firms?.name}>
                        {inv.firms?.name ?? "—"}
                      </p>
                      {inv.firms && (
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {inv.firms.city}, {inv.firms.country}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="truncate text-gray-600 dark:text-gray-400">Issued {formatDate(inv.issue_date)}</p>
                      <p
                        className={cn(
                          "truncate text-xs",
                          overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
                        )}
                      >
                        Due {formatDate(inv.due_date)}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(inv.total_amount)}
                      </p>
                      <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                        net {formatCurrency(inv.net_amount)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {canWrite ? (
                        <StatusMenu
                          value={inv.status}
                          options={STATUS_ORDER}
                          renderBadge={(s) => <InvoiceStatusBadge status={s} />}
                          describe={(s) => INVOICE_STATUS[s].description}
                          onChange={(status) => handleStatus(inv, status)}
                          disabled={busy}
                        />
                      ) : (
                        <InvoiceStatusBadge status={inv.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ViewButton onClick={() => setViewing(inv)} />
                        <DownloadMenu
                          label="Download invoice"
                          onDownload={(format) => downloadInvoiceDocument(inv.id, format)}
                        />
                        {canWrite && (
                        <button
                          onClick={() =>
                            confirm({
                              title: "Delete invoice",
                              message: (
                                <>
                                  Invoice{" "}
                                  <strong className="font-semibold text-gray-900 dark:text-gray-100">
                                    {inv.invoice_number}
                                  </strong>{" "}
                                  will be permanently removed. This can&apos;t be undone.
                                </>
                              ),
                              onConfirm: () => handleDelete(inv),
                            })
                          }
                          disabled={busy}
                          title="Delete"
                          className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>

      {confirmDialog}

      <InvoiceDetailsDrawer
        invoice={viewing}
        offerNumber={viewing?.angebot_id ? offerNumbers[viewing.angebot_id] : null}
        onClose={() => setViewing(null)}
        statusBadge={viewing ? <InvoiceStatusBadge status={viewing.status} /> : null}
      />
    </>
  );
}
