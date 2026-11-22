"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Check,
  Clock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { FormRow, Input, Textarea, Toggle } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { TableEmptyState, TableHead, TableShell } from "@/components/ui/table-shell";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { avatarTint, cn, formatDate } from "@/lib/utils";
import type { Database, LeaveStatus, LeaveType, TimesheetStatus } from "@/lib/types/database";
import {
  createLeaveRequest,
  createTimesheet,
  deleteLeaveRequest,
  deleteTimesheet,
  updateLeaveStatus,
  updateTimesheetStatus,
} from "@/app/(app)/time-leave/actions";

type LeaveRequest = Database["public"]["Tables"]["leave_requests"]["Row"];
type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"];

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual PTO",
  sick: "Medical / Sick",
  parental: "Parental Leave",
  unpaid: "Unpaid Leave",
  remote_work: "Remote / Workation",
};
const LEAVE_TYPE_STYLES: Record<LeaveType, string> = {
  annual: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300",
  sick: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
  parental: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300",
  unpaid: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300",
  remote_work: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
};

const LEAVE_STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
};

export function TimeLeaveBoard({
  initialLeaves,
  initialTimesheets,
  isDemoFallback = false,
}: {
  initialLeaves: LeaveRequest[];
  initialTimesheets: Timesheet[];
  isDemoFallback?: boolean;
}) {
  const canWrite = useCanWrite("time_leave");

  const [leaves, setLeaves] = useState<LeaveRequest[]>(initialLeaves);
  const [timesheets, setTimesheets] = useState<Timesheet[]>(initialTimesheets);
  const [tab, setTab] = useState<"leave" | "timesheets">("leave");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddTimesheet, setShowAddTimesheet] = useState(false);

  const filteredLeaves = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaves.filter((l) => {
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      if (
        q &&
        !l.employee_name.toLowerCase().includes(q) &&
        !(l.reason?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [leaves, search, statusFilter]);

  const filteredTimesheets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return timesheets.filter((t) => {
      if (
        q &&
        !t.employee_name.toLowerCase().includes(q) &&
        !t.project_name.toLowerCase().includes(q) &&
        !(t.notes?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [timesheets, search]);

  async function handleLeaveDecision(item: LeaveRequest, status: LeaveStatus) {
    const prev = leaves;
    setLeaves((cur) => cur.map((l) => (l.id === item.id ? { ...l, status } : l)));
    try {
      if (!isDemoFallback) await updateLeaveStatus(item.id, status);
      toast.success(`Leave request ${status}`);
    } catch (err) {
      setLeaves(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update request");
    }
  }

  async function handleDeleteLeave(item: LeaveRequest) {
    const prev = leaves;
    setLeaves((cur) => cur.filter((l) => l.id !== item.id));
    try {
      if (!isDemoFallback) await deleteLeaveRequest(item.id);
      toast.success("Leave request deleted");
    } catch (err) {
      setLeaves(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't delete request");
    }
  }

  async function handleApproveTimesheet(item: Timesheet, status: TimesheetStatus) {
    const prev = timesheets;
    setTimesheets((cur) => cur.map((t) => (t.id === item.id ? { ...t, status } : t)));
    try {
      if (!isDemoFallback) await updateTimesheetStatus(item.id, status);
      toast.success("Timesheet approved");
    } catch (err) {
      setTimesheets(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update timesheet");
    }
  }

  async function handleDeleteTimesheet(item: Timesheet) {
    const prev = timesheets;
    setTimesheets((cur) => cur.filter((t) => t.id !== item.id));
    try {
      if (!isDemoFallback) await deleteTimesheet(item.id);
      toast.success("Timesheet entry removed");
    } catch (err) {
      setTimesheets(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't delete entry");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-navy-900">
          {(
            [
              { id: "leave", label: `Leave & PTO Requests (${leaves.length})` },
              { id: "timesheets", label: `Timesheets & Attendance (${timesheets.length})` },
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
            <Button variant="outline" onClick={() => setShowAddTimesheet(true)}>
              <Clock className="h-4 w-4" />
              Log Hours
            </Button>
            <Button variant="outline-fill" onClick={() => setShowAddLeave(true)}>
              <Plus className="h-4 w-4" />
              Request Leave
            </Button>
          </div>
        )}
      </div>

      <FilterBar
        activeCount={tab === "leave" && statusFilter !== "ALL" ? 1 : 0}
        onClearAll={() => {
          setSearch("");
          setStatusFilter("ALL");
        }}
        search={{
          value: search,
          onChange: setSearch,
          placeholder:
            tab === "leave"
              ? "Search leave requests by employee or reason..."
              : "Search timesheets by employee or project...",
        }}
      >
        {tab === "leave" && (
          <Combobox
            options={[
              { value: "ALL", label: "All approval statuses" },
              { value: "pending", label: "Pending approval" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || "ALL")}
            placeholder="All approval statuses"
          />
        )}
      </FilterBar>

      {/* VIEW 1: LEAVE & PTO REQUESTS */}
      {tab === "leave" && (
        <TableShell>
          <table className="w-full min-w-[880px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "Employee", width: "w-[22%]" },
                { label: "Category", width: "w-[16%]" },
                { label: "Duration", width: "w-[22%]" },
                { label: "Reason / Notes", width: "w-[20%]" },
                { label: "Status", width: "w-[10%]" },
                { label: "Decision", align: "right", width: "w-[10%]" },
              ]}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {filteredLeaves.length === 0 ? (
                <TableEmptyState
                  colSpan={6}
                  icon={CalendarClock}
                  title="No leave requests found"
                  description="Submit a new PTO or remote work request to track team availability."
                />
              ) : (
                filteredLeaves.map((item, idx) => (
                  <tr key={item.id} className="h-14 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
                            avatarTint(idx)
                          )}
                        >
                          {item.employee_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                          {item.employee_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={LEAVE_TYPE_STYLES[item.leave_type]}>
                        {LEAVE_TYPE_LABELS[item.leave_type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <p className="truncate">
                        {formatDate(item.start_date)} → {formatDate(item.end_date)}
                      </p>
                      <p className="font-mono-brand text-xs text-gray-400 dark:text-gray-500">
                        {item.days_count} {item.days_count === 1 ? "business day" : "business days"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      <p className="truncate">{item.reason || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("capitalize", LEAVE_STATUS_STYLES[item.status])}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && item.status === "pending" && (
                          <>
                            <button
                              type="button"
                              title="Approve leave"
                              onClick={() => handleLeaveDecision(item, "approved")}
                              className="cursor-pointer rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Reject leave"
                              onClick={() => handleLeaveDecision(item, "rejected")}
                              className="cursor-pointer rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            title="Delete request"
                            onClick={() => handleDeleteLeave(item)}
                            className="cursor-pointer rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* VIEW 2: TIMESHEETS */}
      {tab === "timesheets" && (
        <TableShell>
          <table className="w-full min-w-[860px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "Employee", width: "w-[20%]" },
                { label: "Project / Workstream", width: "w-[26%]" },
                { label: "Date", width: "w-[13%]" },
                { label: "Hours", width: "w-[13%]" },
                { label: "Activity summary", width: "w-[18%]" },
                { label: "Status", align: "right", width: "w-[10%]" },
              ]}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {filteredTimesheets.length === 0 ? (
                <TableEmptyState
                  colSpan={6}
                  icon={Clock}
                  title="No timesheet entries"
                  description="Log daily billable or internal project hours."
                />
              ) : (
                filteredTimesheets.map((entry, idx) => (
                  <tr key={entry.id} className="h-14 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
                            avatarTint(idx)
                          )}
                        >
                          {entry.employee_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                          {entry.employee_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{entry.project_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(entry.work_date)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono-brand font-bold text-gray-900 dark:text-white">
                        {entry.hours_logged}h
                      </span>{" "}
                      <span
                        className={cn(
                          "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          entry.billable
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                        )}
                      >
                        {entry.billable ? "Billable" : "Internal"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      <p className="truncate">{entry.notes || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canWrite && entry.status === "submitted" ? (
                          <button
                            type="button"
                            onClick={() => handleApproveTimesheet(entry, "approved")}
                            className="cursor-pointer rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                          >
                            Approve
                          </button>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            Approved
                          </Badge>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            title="Delete entry"
                            onClick={() => handleDeleteTimesheet(entry)}
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

      <AddLeaveDialog
        open={showAddLeave}
        onClose={() => setShowAddLeave(false)}
        isDemoFallback={isDemoFallback}
        onCreated={(l) => setLeaves((cur) => [l, ...cur])}
      />

      <AddTimesheetDialog
        open={showAddTimesheet}
        onClose={() => setShowAddTimesheet(false)}
        isDemoFallback={isDemoFallback}
        onCreated={(t) => setTimesheets((cur) => [t, ...cur])}
      />
    </div>
  );
}

function AddLeaveDialog({
  open,
  onClose,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  onCreated: (leave: LeaveRequest) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");

  async function handleSubmit(formData: FormData) {
    const employee_name = String(formData.get("employee_name") ?? "").trim();
    const start_date = String(formData.get("start_date") ?? "").trim();
    const end_date = String(formData.get("end_date") ?? "").trim();
    const days_count = Number(formData.get("days_count") ?? 1);
    const reason = String(formData.get("reason") ?? "").trim();

    if (!employee_name || !start_date || !end_date) {
      toast.error("Please fill in employee name and dates.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createLeaveRequest({
          employee_name,
          leave_type: leaveType,
          start_date,
          end_date,
          days_count,
          reason,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        employee_name,
        leave_type: leaveType,
        start_date,
        end_date,
        days_count,
        status: "pending",
        reason: reason || null,
        reviewer_note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Leave request submitted");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit leave request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Submit leave or PTO request"
      description="Record planned vacation, medical leave, or remote work periods."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-leave-form" variant="outline-brand" loading={saving}>
            Submit request
          </Button>
        </div>
      }
    >
      <form id="add-leave-form" action={handleSubmit} className="space-y-4">
        <FormRow label="Employee name" required>
          <Input name="employee_name" placeholder="e.g. Lukas Weber" required />
        </FormRow>
        <FormRow label="Leave type">
          <Combobox
            options={(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((k) => ({
              value: k,
              label: LEAVE_TYPE_LABELS[k],
            }))}
            value={leaveType}
            onChange={(v) => setLeaveType((v as LeaveType) || "annual")}
          />
        </FormRow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormRow label="Start date" required>
            <Input name="start_date" type="date" required />
          </FormRow>
          <FormRow label="End date" required>
            <Input name="end_date" type="date" required />
          </FormRow>
          <FormRow label="Business days">
            <Input name="days_count" type="number" min={1} max={90} defaultValue={5} />
          </FormRow>
        </div>
        <FormRow label="Notes / Handover plan">
          <Textarea name="reason" rows={3} placeholder="Coverage details during absence..." />
        </FormRow>
      </form>
    </Dialog>
  );
}

function AddTimesheetDialog({
  open,
  onClose,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  onCreated: (entry: Timesheet) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [billable, setBillable] = useState(true);

  async function handleSubmit(formData: FormData) {
    const employee_name = String(formData.get("employee_name") ?? "").trim();
    const project_name = String(formData.get("project_name") ?? "").trim();
    const work_date = String(formData.get("work_date") ?? "").trim() || new Date().toISOString().slice(0, 10);
    const hours_logged = Number(formData.get("hours_logged") ?? 8);
    const notes = String(formData.get("notes") ?? "").trim();

    if (!employee_name || !project_name) {
      toast.error("Employee and project are required.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createTimesheet({
          employee_name,
          project_name,
          work_date,
          hours_logged,
          billable,
          notes,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        employee_name,
        project_name,
        work_date,
        hours_logged,
        billable,
        status: "submitted",
        notes: notes || null,
        created_at: new Date().toISOString(),
      });
      toast.success("Hours logged");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log hours");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log timesheet hours"
      description="Record billable client delivery or internal engineering hours."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-timesheet-form" variant="outline-brand" loading={saving}>
            Save entry
          </Button>
        </div>
      }
    >
      <form id="add-timesheet-form" action={handleSubmit} className="space-y-4">
        <FormRow label="Employee name" required>
          <Input name="employee_name" placeholder="e.g. Sara Malik" required />
        </FormRow>
        <FormRow label="Project / Workstream" required>
          <Input name="project_name" placeholder="e.g. Nordic Logistics ERP Modernization" required />
        </FormRow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Work date" required>
            <Input name="work_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </FormRow>
          <FormRow label="Hours logged" required>
            <Input name="hours_logged" type="number" step="0.5" min="0.5" max="24" defaultValue={7.5} required />
          </FormRow>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <Toggle checked={billable} onChange={setBillable} label="Billable client hours" />
        </div>
        <FormRow label="Work summary">
          <Textarea name="notes" rows={3} placeholder="What was accomplished during this session..." />
        </FormRow>
      </form>
    </Dialog>
  );
}
