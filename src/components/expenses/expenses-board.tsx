"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { FormRow, Input, Textarea } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusMenu } from "@/components/ui/status-menu";
import { TableEmptyState, TableHead, TableShell } from "@/components/ui/table-shell";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { avatarTint, cn, formatCurrency, formatDate } from "@/lib/utils";
import type {
  Database,
  ExpenseCategory,
  ExpenseStatus,
  PayrollStatus,
} from "@/lib/types/database";
import {
  createExpenseClaim,
  createPayrollRun,
  deleteExpenseClaim,
  deletePayrollRun,
  updateExpenseStatus,
  updatePayrollStatus,
} from "@/app/(app)/expenses/actions";

type ExpenseClaim = Database["public"]["Tables"]["expense_claims"]["Row"];
type PayrollRun = Database["public"]["Tables"]["payroll_runs"]["Row"];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  software: "Cloud & SaaS",
  travel: "Travel & Lodging",
  equipment: "Hardware & Gear",
  marketing: "Growth & Marketing",
  office: "Office & Facilities",
  other: "General Expense",
};

const EXPENSE_STATUS_ORDER: ExpenseStatus[] = ["pending", "approved", "reimbursed", "rejected"];
const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: "Pending Review",
  approved: "Approved",
  reimbursed: "Reimbursed",
  rejected: "Rejected",
};
const EXPENSE_STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  approved: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300",
  reimbursed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
};

const PAYROLL_STATUS_ORDER: PayrollStatus[] = ["draft", "processing", "paid"];
const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: "Draft Batch",
  processing: "SEPA Processing",
  paid: "Disbursed",
};
const PAYROLL_STATUS_STYLES: Record<PayrollStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300",
  processing: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
};

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge className={EXPENSE_STATUS_STYLES[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>;
}

function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return <Badge className={PAYROLL_STATUS_STYLES[status]}>{PAYROLL_STATUS_LABELS[status]}</Badge>;
}

export function ExpensesBoard({
  initialClaims,
  initialPayroll,
  isDemoFallback = false,
}: {
  initialClaims: ExpenseClaim[];
  initialPayroll: PayrollRun[];
  isDemoFallback?: boolean;
}) {
  const canWrite = useCanWrite("expenses");

  const [claims, setClaims] = useState<ExpenseClaim[]>(initialClaims);
  const [payroll, setPayroll] = useState<PayrollRun[]>(initialPayroll);
  const [tab, setTab] = useState<"expenses" | "payroll">("expenses");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddClaim, setShowAddClaim] = useState(false);
  const [showAddPayroll, setShowAddPayroll] = useState(false);

  const filteredClaims = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (categoryFilter !== "ALL" && c.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !c.employee_name.toLowerCase().includes(q) &&
        !(c.receipt_ref?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [claims, search, categoryFilter, statusFilter]);

  async function handleExpenseStatus(item: ExpenseClaim, status: ExpenseStatus) {
    const prev = claims;
    setClaims((cur) => cur.map((c) => (c.id === item.id ? { ...c, status } : c)));
    try {
      if (!isDemoFallback) await updateExpenseStatus(item.id, status);
      toast.success(`Expense marked as ${EXPENSE_STATUS_LABELS[status]}`);
    } catch (err) {
      setClaims(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update expense");
    }
  }

  async function handleDeleteClaim(item: ExpenseClaim) {
    const prev = claims;
    setClaims((cur) => cur.filter((c) => c.id !== item.id));
    try {
      if (!isDemoFallback) await deleteExpenseClaim(item.id);
      toast.success("Expense claim deleted");
    } catch (err) {
      setClaims(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't delete expense");
    }
  }

  async function handlePayrollStatus(run: PayrollRun, status: PayrollStatus) {
    const prev = payroll;
    setPayroll((cur) => cur.map((p) => (p.id === run.id ? { ...p, status } : p)));
    try {
      if (!isDemoFallback) await updatePayrollStatus(run.id, status);
      toast.success(`${run.period_label} payroll marked as ${PAYROLL_STATUS_LABELS[status]}`);
    } catch (err) {
      setPayroll(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update payroll run");
    }
  }

  async function handleDeletePayroll(run: PayrollRun) {
    const prev = payroll;
    setPayroll((cur) => cur.filter((p) => p.id !== run.id));
    try {
      if (!isDemoFallback) await deletePayrollRun(run.id);
      toast.success("Payroll run deleted");
    } catch (err) {
      setPayroll(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't delete payroll run");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-navy-900">
          {(
            [
              { id: "expenses", label: `Expense Claims (${claims.length})` },
              { id: "payroll", label: `Payroll Runs (${payroll.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                tab === item.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" onClick={() => setShowAddPayroll(true)}>
              <Banknote className="h-4 w-4" />
              Run Monthly Payroll
            </Button>
            <Button variant="outline-fill" onClick={() => setShowAddClaim(true)}>
              <Plus className="h-4 w-4" />
              Submit Expense
            </Button>
          </div>
        )}
      </div>

      {tab === "expenses" && (
        <FilterBar
          activeCount={(categoryFilter !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0)}
          onClearAll={() => {
            setSearch("");
            setCategoryFilter("ALL");
            setStatusFilter("ALL");
          }}
          search={{ value: search, onChange: setSearch, placeholder: "Search expenses, employees or receipt numbers..." }}
        >
          <Combobox
            options={[
              { value: "ALL", label: "All categories" },
              ...(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => ({
                value: k,
                label: CATEGORY_LABELS[k],
              })),
            ]}
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v || "ALL")}
            placeholder="All categories"
          />
          <Combobox
            options={[
              { value: "ALL", label: "All statuses" },
              ...EXPENSE_STATUS_ORDER.map((s) => ({ value: s, label: EXPENSE_STATUS_LABELS[s] })),
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || "ALL")}
            placeholder="All statuses"
          />
        </FilterBar>
      )}

      {/* VIEW 1: EXPENSE CLAIMS */}
      {tab === "expenses" && (
        <TableShell>
          <table className="w-full min-w-[880px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "Expense & Receipt", width: "w-[30%]" },
                { label: "Submitted by", width: "w-[18%]" },
                { label: "Category", width: "w-[14%]" },
                { label: "Date", width: "w-[11%]" },
                { label: "Amount", width: "w-[11%]" },
                { label: "Status", width: "w-[11%]" },
                { label: "", align: "right", width: "w-[5%]" },
              ]}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {filteredClaims.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  icon={Receipt}
                  title="No expense claims found"
                  description="Submit an employee reimbursement or software receipt."
                />
              ) : (
                filteredClaims.map((c, idx) => (
                  <tr key={c.id} className="h-14 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100">{c.title}</p>
                      <p className="font-mono-brand truncate text-xs text-gray-400 dark:text-gray-500">
                        {c.receipt_ref ? `Ref: ${c.receipt_ref}` : c.notes || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
                            avatarTint(idx)
                          )}
                        >
                          {c.employee_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate text-gray-700 dark:text-gray-200">{c.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-white/10 dark:text-slate-300">
                        {CATEGORY_LABELS[c.category]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(c.expense_date)}</td>
                    <td className="font-mono-brand px-4 py-3 font-bold text-gray-900 dark:text-white">
                      {formatCurrency(c.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {canWrite ? (
                        <StatusMenu
                          value={c.status}
                          options={EXPENSE_STATUS_ORDER}
                          renderBadge={(s) => <ExpenseStatusBadge status={s} />}
                          onChange={(s) => handleExpenseStatus(c, s)}
                        />
                      ) : (
                        <ExpenseStatusBadge status={c.status} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canWrite && (
                        <button
                          type="button"
                          title="Delete claim"
                          onClick={() => handleDeleteClaim(c)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {/* VIEW 2: PAYROLL RUNS */}
      {tab === "payroll" && (
        <TableShell>
          <table className="w-full min-w-[880px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "Payroll Period", width: "w-[22%]" },
                { label: "Disbursement Date", width: "w-[14%]" },
                { label: "Headcount", width: "w-[12%]" },
                { label: "Gross Payroll", width: "w-[14%]" },
                { label: "Taxes & Social", width: "w-[14%]" },
                { label: "Net Disbursed", width: "w-[12%]" },
                { label: "Status", width: "w-[12%]" },
              ]}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {payroll.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  icon={Wallet}
                  title="No payroll runs recorded"
                  description="Create a monthly payroll batch to track company compensation."
                />
              ) : (
                payroll.map((run) => (
                  <tr key={run.id} className="h-14 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{run.period_label}</p>
                      {run.notes && <p className="truncate text-xs text-gray-400 dark:text-gray-500">{run.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(run.pay_date)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{run.employee_count} staff</td>
                    <td className="font-mono-brand px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {formatCurrency(run.gross_total)}
                    </td>
                    <td className="font-mono-brand px-4 py-3 text-rose-600 dark:text-rose-400">
                      -{formatCurrency(run.tax_deductions)}
                    </td>
                    <td className="font-mono-brand px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(run.net_total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-between gap-1">
                        {canWrite ? (
                          <StatusMenu
                            value={run.status}
                            options={PAYROLL_STATUS_ORDER}
                            renderBadge={(s) => <PayrollStatusBadge status={s} />}
                            onChange={(s) => handlePayrollStatus(run, s)}
                          />
                        ) : (
                          <PayrollStatusBadge status={run.status} />
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            title="Delete payroll run"
                            onClick={() => handleDeletePayroll(run)}
                            className="cursor-pointer rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      <AddExpenseDialog
        open={showAddClaim}
        onClose={() => setShowAddClaim(false)}
        isDemoFallback={isDemoFallback}
        onCreated={(c) => setClaims((cur) => [c, ...cur])}
      />

      <AddPayrollDialog
        open={showAddPayroll}
        onClose={() => setShowAddPayroll(false)}
        isDemoFallback={isDemoFallback}
        onCreated={(p) => setPayroll((cur) => [p, ...cur])}
      />
    </div>
  );
}

function AddExpenseDialog({
  open,
  onClose,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  onCreated: (claim: ExpenseClaim) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("software");

  async function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const employee_name = String(formData.get("employee_name") ?? "").trim();
    const amount = Number(formData.get("amount") ?? 0);
    const expense_date = String(formData.get("expense_date") ?? "").trim() || new Date().toISOString().slice(0, 10);
    const receipt_ref = String(formData.get("receipt_ref") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!title || !employee_name || amount <= 0) {
      toast.error("Please fill in description, employee, and valid amount.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createExpenseClaim({
          title,
          employee_name,
          category,
          amount,
          expense_date,
          receipt_ref,
          notes,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        title,
        employee_name,
        category,
        amount,
        currency: "EUR",
        expense_date,
        status: "pending",
        receipt_ref: receipt_ref || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Expense claim submitted");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Submit expense claim"
      description="Record a company purchase or employee reimbursement request."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-expense-form" variant="outline-brand" loading={saving}>
            Submit claim
          </Button>
        </div>
      }
    >
      <form id="add-expense-form" action={handleSubmit} className="space-y-4">
        <FormRow label="Expense description" required>
          <Input name="title" placeholder="e.g. AWS & Supabase Compute (Nov)" required />
        </FormRow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Submitted by" required>
            <Input name="employee_name" placeholder="e.g. Sara Malik" required />
          </FormRow>
          <FormRow label="Category">
            <Combobox
              options={(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => ({
                value: k,
                label: CATEGORY_LABELS[k],
              }))}
              value={category}
              onChange={(v) => setCategory((v as ExpenseCategory) || "software")}
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Amount (EUR)" required>
            <Input name="amount" type="number" step="0.01" min="1" placeholder="250.00" required />
          </FormRow>
          <FormRow label="Expense date" required>
            <Input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </FormRow>
        </div>
        <FormRow label="Receipt / Invoice reference">
          <Input name="receipt_ref" placeholder="e.g. INV-2026-8841" />
        </FormRow>
        <FormRow label="Notes">
          <Textarea name="notes" rows={3} placeholder="Business justification or cost center..." />
        </FormRow>
      </form>
    </Dialog>
  );
}

function AddPayrollDialog({
  open,
  onClose,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  onCreated: (run: PayrollRun) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    const period_label = String(formData.get("period_label") ?? "").trim();
    const pay_date = String(formData.get("pay_date") ?? "").trim();
    const employee_count = Number(formData.get("employee_count") ?? 9);
    const gross_total = Number(formData.get("gross_total") ?? 0);
    const tax_deductions = Number(formData.get("tax_deductions") ?? 0);
    const notes = String(formData.get("notes") ?? "").trim();

    if (!period_label || !pay_date || gross_total <= 0) {
      toast.error("Please fill in period, pay date, and gross total.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createPayrollRun({
          period_label,
          pay_date,
          employee_count,
          gross_total,
          tax_deductions,
          notes,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        period_label,
        pay_date,
        employee_count,
        gross_total,
        tax_deductions,
        net_total: Math.max(0, gross_total - tax_deductions),
        status: "draft",
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Payroll batch created");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create payroll batch");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create monthly payroll run"
      description="Prepare a SEPA salary disbursement batch for all active employees."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-payroll-form" variant="outline-brand" loading={saving}>
            Create batch
          </Button>
        </div>
      }
    >
      <form id="add-payroll-form" action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Payroll period" required>
            <Input name="period_label" placeholder="e.g. December 2026" required />
          </FormRow>
          <FormRow label="Disbursement date" required>
            <Input name="pay_date" type="date" required />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormRow label="Headcount" required>
            <Input name="employee_count" type="number" min={1} defaultValue={9} required />
          </FormRow>
          <FormRow label="Gross total (EUR)" required>
            <Input name="gross_total" type="number" step="100" min={100} defaultValue={46800} required />
          </FormRow>
          <FormRow label="Taxes & social (EUR)" required>
            <Input name="tax_deductions" type="number" step="100" min={0} defaultValue={14976} required />
          </FormRow>
        </div>
        <FormRow label="Payroll notes">
          <Textarea name="notes" rows={3} placeholder="Bonuses, commissions, or SEPA batch notes..." />
        </FormRow>
      </form>
    </Dialog>
  );
}
