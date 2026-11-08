"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { DownloadMenu } from "@/components/ui/download-menu";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusMenu } from "@/components/ui/status-menu";
import { TableShell, TableHead, TableEmptyState } from "@/components/ui/table-shell";
import { Pagination } from "@/components/ui/pagination";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ANGEBOT_STATUS_LABELS, avatarTint, cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  OFFER_STATUS,
  OFFER_STATUS_ORDER,
  OfferStatusBadge,
  statusFilterOptions,
} from "@/components/ui/status-badges";
import type { AngebotStatus, Database } from "@/lib/types/database";
import { OfferFormDialog } from "@/components/offers/offer-form-dialog";
import { deleteAngebot, downloadAngebotDocument, updateAngebotStatus } from "@/app/(app)/offers/actions";
import { useSort } from "@/lib/hooks/use-sort";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { ViewButton } from "@/components/ui/view-button";
import { OfferDetailsDrawer } from "@/components/details/offer-details-drawer";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
export type Offer = Database["public"]["Tables"]["angebots"]["Row"] & {
  firms: Pick<Firm, "id" | "name" | "city" | "country"> | null;
};

const PAGE_SIZE = 10;
const STATUS_ORDER = OFFER_STATUS_ORDER;


export function OffersTable({ offers, firms }: { offers: Offer[]; firms: Firm[] }) {
  const [editing, setEditing] = useState<Offer | null>(null);
  const [viewing, setViewing] = useState<Offer | null>(null);
  const canWrite = useCanWrite("offers");
  const [busyId, setBusyId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string | null>("ALL");
  const [page, setPage] = useState(1);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offers.filter((o) => {
      if (statusFilter && statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (q && !o.firms?.name?.toLowerCase().includes(q) && !o.angebot_number?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [offers, search, statusFilter]);

  const { sorted, sortBy, sortDir, onSort } = useSort(filtered, (o, key) => {
    switch (key) {
      case "offer":
        return o.angebot_number;
      case "firm":
        return o.firms?.name;
      case "validity":
        return o.issue_date;
      case "total":
        return o.total_amount;
      case "status":
        return o.status;
      default:
        return null;
    }
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const today = new Date().toISOString().slice(0, 10);

  const statusOptions = statusFilterOptions({ meta: OFFER_STATUS, order: STATUS_ORDER, items: offers, allLabel: "All offers" });

  function withReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleStatus(o: Offer, status: AngebotStatus) {
    setBusyId(o.id);
    try {
      await updateAngebotStatus(o.id, status);
      toast.success(
        status === "accepted" ? `${o.firms?.name ?? "Firm"} is now a client` : `Offer marked as ${ANGEBOT_STATUS_LABELS[status]}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(o: Offer) {
    setBusyId(o.id);
    try {
      await deleteAngebot(o.id);
      toast.success("Offer deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete offer");
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
            search={{ value: search, onChange: withReset(setSearch), placeholder: "Search by firm or offer number..." }}
          >
            <Combobox
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => withReset(setStatusFilter)(v || "ALL")}
              placeholder="All offers"
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
              { label: "Offer", width: "w-[22%]", sortKey: "offer" },
              { label: "Firm", width: "w-[24%]", sortKey: "firm" },
              { label: "Validity", width: "w-[16%]", sortKey: "validity" },
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
                icon={FileSpreadsheet}
                title={offers.length === 0 ? "No offers yet" : "No offers found"}
                description={
                  offers.length === 0
                    ? "Create an offer for a firm in negotiation to get started."
                    : "No offers match your current search and filters."
                }
              />
            ) : (
              pageRows.map((o, index) => {
                const busy = busyId === o.id;
                const lapsed = o.status === "sent" && !!o.valid_until && o.valid_until < today;
                return (
                  <tr key={o.id} className="h-12 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                            avatarTint((currentPage - 1) * PAGE_SIZE + index)
                          )}
                        >
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono-brand truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {o.angebot_number}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                            {(o.line_items?.length ?? 0) === 1 ? "1 line item" : `${o.line_items?.length ?? 0} line items`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100" title={o.firms?.name}>
                        {o.firms?.name ?? "—"}
                      </p>
                      {o.firms && (
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {o.firms.city}, {o.firms.country}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="truncate text-gray-600 dark:text-gray-400">{formatDate(o.issue_date)}</p>
                      <p
                        className={cn(
                          "truncate text-xs",
                          lapsed ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
                        )}
                      >
                        {lapsed ? "Lapsed " : "Until "}
                        {formatDate(o.valid_until)}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(o.total_amount)}
                      </p>
                      <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                        net {formatCurrency(o.net_amount)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {canWrite ? (
                        <StatusMenu
                          value={o.status}
                          options={STATUS_ORDER}
                          renderBadge={(s) => <OfferStatusBadge status={s} />}
                          describe={(s) => OFFER_STATUS[s].description}
                          onChange={(status) => handleStatus(o, status)}
                          disabled={busy}
                        />
                      ) : (
                        <OfferStatusBadge status={o.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ViewButton onClick={() => setViewing(o)} />
                        <DownloadMenu
                          label="Download offer"
                          onDownload={(format) => downloadAngebotDocument(o.id, format)}
                        />
                        {canWrite && (
                          <>
                        <button
                          onClick={() => setEditing(o)}
                          title="Edit"
                          className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            confirm({
                              title: "Delete offer",
                              message: (
                                <>
                                  Offer{" "}
                                  <strong className="font-semibold text-gray-900 dark:text-gray-100">
                                    {o.angebot_number}
                                  </strong>{" "}
                                  will be permanently removed. This can&apos;t be undone.
                                </>
                              ),
                              onConfirm: () => handleDelete(o),
                            })
                          }
                          disabled={busy}
                          title="Delete"
                          className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                          </>
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

      <OfferDetailsDrawer
        offer={viewing}
        onClose={() => setViewing(null)}
        statusBadge={viewing ? <OfferStatusBadge status={viewing.status} /> : null}
      />

      {editing && (
        <OfferFormDialog key={editing.id} open={!!editing} onClose={() => setEditing(null)} firms={firms} offer={editing} />
      )}
    </>
  );
}
