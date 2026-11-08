"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Mail, Phone, Loader2, Building2, Globe, ChevronDown, X } from "lucide-react";
import { StatusBadge } from "@/components/firms/status-badge";
import { FirmFormDialog } from "@/components/firms/firm-form-dialog";
import { StatusMenu } from "@/components/ui/status-menu";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { TableShell, TableHead, TableEmptyState } from "@/components/ui/table-shell";
import { Pagination } from "@/components/ui/pagination";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FIRM_STATUS_LABELS, avatarTint, cn } from "@/lib/utils";
import type { Database, FirmStatus } from "@/lib/types/database";
import { bulkDeleteFirms, bulkUpdateFirmStatus, deleteFirm, updateFirmStatus } from "@/app/(app)/firms/actions";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { ViewButton } from "@/components/ui/view-button";
import { FirmDetailsDrawer } from "@/components/details/firm-details-drawer";

type Firm = Database["public"]["Tables"]["firms"]["Row"];

const STATUS_ORDER: FirmStatus[] = [
  "not_started",
  "in_progress",
  "sent",
  "responded",
  "negotiation",
  "client",
];


export function FirmsTable({
  firms,
  currentPage = 1,
  totalItems = 0,
  pageSize = 15,
  sortBy = null,
  sortDir = "desc",
  filters,
}: {
  firms: Firm[];
  currentPage?: number;
  totalItems?: number;
  pageSize?: number;
  /** Current sort column key (matches the `sortKey`s below) and direction — sorting is server-side, driven by the `sort`/`dir` URL params. */
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  /** Filter row rendered flush inside the table card. */
  filters?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<Firm | null>(null);
  const [viewing, setViewing] = useState<Firm | null>(null);
  const canWrite = useCanWrite("firms");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Selection is scoped to the rows actually on screen — switching page or
  // filters starts fresh rather than silently carrying a stale selection.
  const visibleSelected = useMemo(() => firms.filter((f) => selected.has(f.id)), [firms, selected]);
  const allVisibleSelected = firms.length > 0 && visibleSelected.length === firms.length;
  const someVisibleSelected = visibleSelected.length > 0 && !allVisibleSelected;

  function setPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSort(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sortBy === key && sortDir === "desc") {
      // Third click on the same column: clear back to the default order.
      params.delete("sort");
      params.delete("dir");
    } else {
      params.set("sort", key);
      params.set("dir", sortBy === key && sortDir === "asc" ? "desc" : "asc");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      firms.forEach((f) => (checked ? next.add(f.id) : next.delete(f.id)));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleStatusChange(firm: Firm, status: FirmStatus) {
    setPendingId(firm.id);
    try {
      await updateFirmStatus(firm.id, status);
      toast.success(`${firm.name} marked as ${FIRM_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(firm: Firm) {
    setPendingId(firm.id);
    try {
      await deleteFirm(firm.id);
      toast.success("Firm deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete firm");
    } finally {
      setPendingId(null);
    }
  }

  async function handleBulkStatus(status: FirmStatus) {
    const ids = Array.from(selected);
    setBulkBusy(true);
    try {
      await bulkUpdateFirmStatus(ids, status);
      toast.success(`${ids.length} ${ids.length === 1 ? "firm" : "firms"} marked as ${FIRM_STATUS_LABELS[status]}`);
      clearSelection();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the selected firms");
    } finally {
      setBulkBusy(false);
    }
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    confirm({
      title: `Delete ${ids.length} ${ids.length === 1 ? "firm" : "firms"}`,
      message: (
        <>
          <strong className="font-semibold text-gray-900 dark:text-gray-100">
            {ids.length} selected {ids.length === 1 ? "firm" : "firms"}
          </strong>{" "}
          and their outreach history will be permanently removed. This can&apos;t be undone.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          await bulkDeleteFirms(ids);
          toast.success(`${ids.length} ${ids.length === 1 ? "firm" : "firms"} deleted`);
          clearSelection();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't delete the selected firms");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  }

  return (
    <>
      <TableShell
        header={
          <>
            {filters}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-brand-50/60 px-4 py-2.5 dark:border-white/10 dark:bg-brand-500/10">
                <span className="text-sm font-semibold text-brand-800 dark:text-brand-200">
                  {selected.size} {selected.size === 1 ? "firm" : "firms"} selected
                </span>
                <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                  <DropdownMenu
                    align="left"
                    panelClassName="w-52 p-1"
                    trigger={({ toggle, open }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        disabled={bulkBusy}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:border-brand-400/30 dark:bg-navy-800 dark:text-brand-300 dark:hover:bg-brand-500/10"
                      >
                        Set status
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                      </button>
                    )}
                  >
                    {(close) =>
                      STATUS_ORDER.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            close();
                            handleBulkStatus(s);
                          }}
                          className="flex w-full cursor-pointer items-center rounded-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          <StatusBadge status={s} />
                        </button>
                      ))
                    }
                  </DropdownMenu>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkBusy}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-400/30 dark:bg-navy-800 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={bulkBusy}
                    title="Clear selection"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg p-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        }
        footer={
          totalItems > pageSize ? (
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          ) : null
        }
      >
        {/* Fixed layout with proportional widths: the table always spans the
            full card, and no single column (e.g. a long firm name) can grab
            the space the others need. Long text truncates instead. */}
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <TableHead
            columns={[
              { label: "", width: "w-10" },
              { label: "Firm", width: "w-[29%]", sortKey: "firm" },
              { label: "Location", width: "w-[20%]", sortKey: "location" },
              { label: "Contact", width: "w-[15%]" },
              { label: "Status", width: "w-[18%]", sortKey: "status" },
              { label: "Actions", align: "right", width: "w-[13%]" },
            ]}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          >
            {canWrite && (
              <Checkbox
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                onChange={toggleAllVisible}
                label="Select all firms on this page"
              />
            )}
          </TableHead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/10">
            {firms.length === 0 && (
              <TableEmptyState
                colSpan={6}
                icon={Building2}
                title="No firms found"
                description="No firms match your current search and filters."
              />
            )}
            {firms.map((firm, index) => (
              <tr
                key={firm.id}
                className={cn(
                  "h-12 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5",
                  selected.has(firm.id) && "bg-brand-50/40 dark:bg-brand-500/[0.06]"
                )}
              >
                <td className="px-4 py-3">
                  {canWrite && (
                    <Checkbox
                      checked={selected.has(firm.id)}
                      onChange={(checked) => toggleRow(firm.id, checked)}
                      label={`Select ${firm.name}`}
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${avatarTint(index)}`}>
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100" title={firm.name}>{firm.name}</p>
                      {firm.notes && <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{firm.notes}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                  <p className="truncate">{firm.city}</p>
                  <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                    {firm.state}, {firm.country}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    {firm.contact_email && (
                      <a
                        href={`mailto:${firm.contact_email}`}
                        title={firm.contact_email}
                        className="rounded-md p-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                    {firm.contact_phone && (
                      <a
                        href={`tel:${firm.contact_phone}`}
                        title={firm.contact_phone}
                        className="rounded-md p-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {firm.website && (
                      <a
                        href={firm.website.startsWith('http') ? firm.website : `https://${firm.website}`}
                        target="_blank"
                        rel="noreferrer"
                        title={firm.website}
                        className="rounded-md p-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                    {!firm.contact_email && !firm.contact_phone && !firm.website && <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {canWrite ? (
                    <StatusMenu
                      value={firm.status}
                      options={STATUS_ORDER}
                      renderBadge={(s) => <StatusBadge status={s} />}
                      onChange={(s) => handleStatusChange(firm, s)}
                      disabled={pendingId === firm.id}
                    />
                  ) : (
                    <StatusBadge status={firm.status} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <ViewButton onClick={() => setViewing(firm)} />
                    {canWrite && (
                      <>
                    <button
                      onClick={() => setEditing(firm)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        confirm({
                          title: "Delete firm",
                          message: (
                            <>
                              <strong className="font-semibold text-gray-900 dark:text-gray-100">{firm.name}</strong>{" "}
                              and its outreach history will be permanently removed. This can&apos;t be undone.
                            </>
                          ),
                          onConfirm: () => handleDelete(firm),
                        })
                      }
                      disabled={pendingId === firm.id}
                      title="Delete"
                      className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      {pendingId === firm.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      {confirmDialog}

      <FirmDetailsDrawer firm={viewing} onClose={() => setViewing(null)} />

      {editing && <FirmFormDialog open={!!editing} onClose={() => setEditing(null)} firm={editing} />}
    </>
  );
}
