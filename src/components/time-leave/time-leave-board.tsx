"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  FileText,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Square,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { FormRow, Input, Textarea, Toggle } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { TableEmptyState, TableHead, TableShell } from "@/components/ui/table-shell";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { avatarTint, cn, formatCurrency, formatDate } from "@/lib/utils";
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

export type EmployeeCompensationProfile = {
  fullName: string;
  email: string;
  position: string;
  department: string;
  location: string;
  employmentType: string;
  contractStart: string;
  contractRef: string;
  monthlyGross: number;
  taxAndSocial: number;
  monthlyNet: number;
  ibanMasked: string;
  annualLeaveQuota: number;
  remoteWorkQuota: number;
};

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

const PROJECT_OPTIONS = [
  { value: "Nordic Logistics ERP Modernization", label: "Nordic Logistics ERP Modernization" },
  { value: "Innokem Chemical Compliance Portal", label: "Innokem Chemical Compliance Portal" },
  { value: "Alpine Legal Client Intake & DMS", label: "Alpine Legal Client Intake & DMS" },
  { value: "Internal Platform Architecture", label: "Internal Platform Architecture" },
];

function formatStopwatch(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
}

export function TimeLeaveBoard({
  initialLeaves,
  initialTimesheets,
  isDemoFallback = false,
  isBoss = true,
  employeeProfile,
}: {
  initialLeaves: LeaveRequest[];
  initialTimesheets: Timesheet[];
  isDemoFallback?: boolean;
  isBoss?: boolean;
  employeeProfile: EmployeeCompensationProfile;
}) {
  const canWrite = useCanWrite("time_leave");

  // Employees default directly to their personal portal; bosses default to manager view but can switch anytime
  const [viewMode, setViewMode] = useState<"employee" | "manager">(isBoss ? "manager" : "employee");
  const [leaves, setLeaves] = useState<LeaveRequest[]>(initialLeaves);
  const [timesheets, setTimesheets] = useState<Timesheet[]>(initialTimesheets);
  const [tab, setTab] = useState<"leave" | "timesheets">("leave");
  const [empTab, setEmpTab] = useState<"timer_leave" | "salary">("timer_leave");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddTimesheet, setShowAddTimesheet] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<string | null>(null);

  // Live Work Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(12420); // starts at 03:27:00 for realistic live demo feel
  const [timerProject, setTimerProject] = useState(PROJECT_OPTIONS[0].value);
  const [timerNote, setTimerNote] = useState("Implementing customs manifest webhook & unit tests");
  const [timerBillable, setTimerBillable] = useState(true);
  const [clockingOut, setClockingOut] = useState(false);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  async function handleClockOutAndSave() {
    setTimerRunning(false);
    const hours = Math.max(0.5, Math.round((elapsedSeconds / 3600) * 10) / 10);
    const work_date = new Date().toISOString().slice(0, 10);
    setClockingOut(true);
    try {
      if (!isDemoFallback) {
        await createTimesheet({
          employee_name: employeeProfile.fullName,
          project_name: timerProject,
          work_date,
          hours_logged: hours,
          billable: timerBillable,
          notes: timerNote.trim() || "Logged via live work timer",
        });
      }
      const newEntry: Timesheet = {
        id: crypto.randomUUID(),
        employee_name: employeeProfile.fullName,
        project_name: timerProject,
        work_date,
        hours_logged: hours,
        billable: timerBillable,
        status: "submitted",
        notes: timerNote.trim() || "Logged via live work timer",
        created_at: new Date().toISOString(),
      };
      setTimesheets((cur) => [newEntry, ...cur]);
      setElapsedSeconds(0);
      toast.success(`Clocked out & logged ${hours}h to ${timerProject}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save timer session");
    } finally {
      setClockingOut(false);
    }
  }

  // Personal records for Employee Self-Service view
  const myLeaves = useMemo(() => {
    const mine = leaves.filter(
      (l) => l.employee_name.toLowerCase() === employeeProfile.fullName.toLowerCase()
    );
    return mine.length > 0 ? mine : leaves.slice(0, 3);
  }, [leaves, employeeProfile.fullName]);

  const myTimesheets = useMemo(() => {
    const mine = timesheets.filter(
      (t) => t.employee_name.toLowerCase() === employeeProfile.fullName.toLowerCase()
    );
    return mine.length > 0 ? mine : timesheets.slice(0, 4);
  }, [timesheets, employeeProfile.fullName]);

  const annualUsed = myLeaves
    .filter((l) => l.leave_type === "annual" && l.status !== "rejected")
    .reduce((s, l) => s + l.days_count, 0);
  const remoteUsed = myLeaves
    .filter((l) => l.leave_type === "remote_work" && l.status !== "rejected")
    .reduce((s, l) => s + l.days_count, 0);
  const sickUsed = myLeaves
    .filter((l) => l.leave_type === "sick" && l.status !== "rejected")
    .reduce((s, l) => s + l.days_count, 0);

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
    const reviewerNote = status === "approved" ? "Approved by Leadership" : "Declined due to sprint release schedule";
    setLeaves((cur) => cur.map((l) => (l.id === item.id ? { ...l, status, reviewer_note: reviewerNote } : l)));
    try {
      if (!isDemoFallback) await updateLeaveStatus(item.id, status, reviewerNote);
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
      {/* Role / Experience Mode Switcher Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-navy-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
            {viewMode === "employee" ? <UserCheck className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {viewMode === "employee"
                  ? `Employee Self-Service Portal · ${employeeProfile.fullName}`
                  : "Leadership & HR Command View (All Staff)"}
              </p>
              <Badge className="bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/15 dark:text-brand-300">
                {viewMode === "employee" ? employeeProfile.position : "Manager Approvals"}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {viewMode === "employee"
                ? "Your personal live work timer, leave quota & request status, salary breakdown, and digital payslips."
                : "Approve team PTO requests, review company-wide billable timesheets, or preview the employee portal."}
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-navy-950">
          {isBoss && (
            <button
              type="button"
              onClick={() => setViewMode("manager")}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewMode === "manager"
                  ? "bg-navy-900 text-white shadow-xs dark:bg-brand-500 dark:text-navy-950"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              )}
            >
              Boss / Manager Approvals
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMode("employee")}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              viewMode === "employee"
                ? "bg-navy-900 text-white shadow-xs dark:bg-brand-500 dark:text-navy-950"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            )}
          >
            Employee Self-Service View
          </button>
        </div>
      </div>

      {/* =====================================================================
          MODE A: EMPLOYEE SELF-SERVICE PORTAL (Work Timer, My Leave, My Salary)
          ===================================================================== */}
      {viewMode === "employee" && (
        <div className="space-y-6">
          {/* Sub-navigation for Employee Portal */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-navy-900">
              <button
                type="button"
                onClick={() => setEmpTab("timer_leave")}
                className={cn(
                  "cursor-pointer rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                  empTab === "timer_leave"
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                )}
              >
                Work Timer, My Leave &amp; Timesheets
              </button>
              <button
                type="button"
                onClick={() => setEmpTab("salary")}
                className={cn(
                  "cursor-pointer rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                  empTab === "salary"
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                )}
              >
                My Salary, Contract &amp; Payslips
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="outline" onClick={() => setShowAddTimesheet(true)}>
                <Clock className="h-4 w-4" />
                Manual Time Entry
              </Button>
              <Button variant="outline-fill" onClick={() => setShowAddLeave(true)}>
                <Plus className="h-4 w-4" />
                Submit Leave Request
              </Button>
            </div>
          </div>

          {empTab === "timer_leave" ? (
            <>
              {/* Top Row: Live Work Timer + Leave Balances */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                {/* 1. LIVE WORK TIMER WIDGET */}
                <Card className="relative overflow-hidden border-brand-200/80 p-5 xl:col-span-5 dark:border-brand-500/25">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-brand-600 uppercase dark:text-brand-400">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          timerRunning ? "animate-ping bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      {timerRunning ? "Clocked In · Recording Work Session" : "Work Timer Paused / Ready"}
                    </span>
                    <span className="font-mono-brand text-xs text-gray-400">Target: 8.0h / day</span>
                  </div>

                  {/* Big Digital Stopwatch */}
                  <div className="my-5 flex items-baseline justify-between rounded-2xl bg-navy-950 px-5 py-4 text-white">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest text-brand-400 uppercase">
                        Active Session Duration
                      </p>
                      <p className="font-mono-brand mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        {formatStopwatch(elapsedSeconds)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Today&apos;s Progress</p>
                      <p className="font-mono-brand text-sm font-bold text-emerald-400">
                        {Math.min(100, Math.round((elapsedSeconds / (8 * 3600)) * 100))}% of daily shift
                      </p>
                    </div>
                  </div>

                  {/* Project & Task Context for Timer */}
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Active Project / Workstream
                      </label>
                      <Combobox
                        options={PROJECT_OPTIONS}
                        value={timerProject}
                        onChange={(v) => setTimerProject(v || PROJECT_OPTIONS[0].value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Current Task / Deliverable Note
                      </label>
                      <Input
                        value={timerNote}
                        onChange={(e) => setTimerNote(e.target.value)}
                        placeholder="What are you working on right now?"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Toggle checked={timerBillable} onChange={setTimerBillable} label="Billable client work" />
                    </div>
                  </div>

                  {/* Timer Controls */}
                  <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-gray-100 pt-4 dark:border-white/10">
                    {!timerRunning ? (
                      <Button
                        type="button"
                        variant="primary"
                        className="flex-1"
                        onClick={() => {
                          setTimerRunning(true);
                          toast.success("Work timer started");
                        }}
                      >
                        <Play className="h-4 w-4 fill-current" />
                        {elapsedSeconds > 0 ? "Resume Work Timer" : "Clock In & Start Timer"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setTimerRunning(false);
                          toast("Work timer paused");
                        }}
                      >
                        <Pause className="h-4 w-4" />
                        Pause / Take Break
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline-brand"
                      disabled={elapsedSeconds === 0 || clockingOut}
                      loading={clockingOut}
                      onClick={handleClockOutAndSave}
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Clock Out &amp; Log Hours
                    </Button>
                  </div>
                </Card>

                {/* 2. MY LEAVE QUOTA & PTO BALANCES */}
                <Card className="flex flex-col justify-between p-5 xl:col-span-7">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-base font-bold text-gray-900 dark:text-white">
                          My Annual Leave &amp; Time-Off Balances
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Real-time entitlement and remaining days for {new Date().getFullYear()}
                        </p>
                      </div>
                      <Button size="sm" variant="outline-brand" onClick={() => setShowAddLeave(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        New Leave Request
                      </Button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                        <span className="text-[11px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
                          Annual Vacation (PTO)
                        </span>
                        <p className="font-display mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                          {Math.max(0, employeeProfile.annualLeaveQuota - annualUsed)}{" "}
                          <span className="text-xs font-normal text-gray-500">
                            / {employeeProfile.annualLeaveQuota} days left
                          </span>
                        </p>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{
                              width: `${Math.min(100, Math.round((annualUsed / employeeProfile.annualLeaveQuota) * 100))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-500">{annualUsed} days used or scheduled</p>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                        <span className="text-[11px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                          Remote / Workation
                        </span>
                        <p className="font-display mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                          {Math.max(0, employeeProfile.remoteWorkQuota - remoteUsed)}{" "}
                          <span className="text-xs font-normal text-gray-500">
                            / {employeeProfile.remoteWorkQuota} days left
                          </span>
                        </p>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.min(100, Math.round((remoteUsed / employeeProfile.remoteWorkQuota) * 100))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-500">{remoteUsed} days remote EU work</p>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                        <span className="text-[11px] font-semibold tracking-wider text-rose-600 uppercase dark:text-rose-400">
                          Medical &amp; Sick Leave
                        </span>
                        <p className="font-display mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                          {sickUsed} <span className="text-xs font-normal text-gray-500">days logged YTD</span>
                        </p>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                          <div className="h-full w-1/6 rounded-full bg-rose-500" />
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-500">100% statutory pay coverage</p>
                      </div>
                    </div>
                  </div>

                  {/* Employee's Own Leave Submissions & Approval Status */}
                  <div className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
                    <h4 className="mb-2.5 text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      My Submitted Leave Requests &amp; Approval Status
                    </h4>
                    <div className="space-y-2">
                      {myLeaves.map((req) => (
                        <div
                          key={req.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-navy-950/60"
                        >
                          <div className="flex items-center gap-2.5">
                            <Badge className={LEAVE_TYPE_STYLES[req.leave_type]}>
                              {LEAVE_TYPE_LABELS[req.leave_type]}
                            </Badge>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatDate(req.start_date)} → {formatDate(req.end_date)} ({req.days_count}d)
                            </span>
                            {req.reason && (
                              <span className="hidden text-gray-400 sm:inline">· &ldquo;{req.reason}&rdquo;</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {req.reviewer_note && (
                              <span className="text-[11px] text-gray-400 italic">{req.reviewer_note}</span>
                            )}
                            <Badge className={cn("capitalize", LEAVE_STATUS_STYLES[req.status])}>{req.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Employee's Personal Timesheet Log */}
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-gray-900 dark:text-white">
                      My Recent Work Sessions &amp; Timesheets
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Hours recorded from your live work timer and manual logs
                    </p>
                  </div>
                </div>
                <TableShell>
                  <table className="w-full min-w-[760px] table-fixed text-sm">
                    <TableHead
                      columns={[
                        { label: "Date", width: "w-[14%]" },
                        { label: "Project / Workstream", width: "w-[28%]" },
                        { label: "Hours", width: "w-[14%]" },
                        { label: "Deliverable Notes", width: "w-[32%]" },
                        { label: "Approval", align: "right", width: "w-[12%]" },
                      ]}
                    />
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                      {myTimesheets.map((entry) => (
                        <tr key={entry.id} className="h-12">
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                            {formatDate(entry.work_date)}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                            {entry.project_name}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono-brand font-bold text-gray-900 dark:text-white">
                              {entry.hours_logged}h
                            </span>{" "}
                            <span className="text-xs text-gray-400">
                              ({entry.billable ? "Billable" : "Internal"})
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                            <p className="truncate">{entry.notes || "—"}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Badge
                              className={
                                entry.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                                  : "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300"
                              }
                            >
                              {entry.status === "approved" ? "Approved" : "Submitted"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </Card>
            </>
          ) : (
            /* 3. MY SALARY, CONTRACT & PAYSLIPS VAULT */
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <Card className="space-y-5 p-5 lg:col-span-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold tracking-wider text-brand-600 uppercase dark:text-brand-400">
                      Compensation &amp; Contract Profile
                    </span>
                    <h3 className="font-display mt-1 text-xl font-bold text-gray-900 dark:text-white">
                      {employeeProfile.fullName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {employeeProfile.position} · {employeeProfile.department}
                    </p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    Active Contract
                  </Badge>
                </div>

                <div className="rounded-2xl bg-navy-950 p-4 text-white">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Monthly Net Salary (After Tax)</span>
                    <span className="font-mono-brand text-emerald-400">SEPA Direct Deposit</span>
                  </div>
                  <p className="font-mono-brand mt-1 text-3xl font-extrabold text-white">
                    {formatCurrency(employeeProfile.monthlyNet)}
                    <span className="text-xs font-normal text-slate-400"> / month</span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs">
                    <div>
                      <span className="text-slate-400">Monthly Gross:</span>
                      <p className="font-mono-brand font-semibold text-white">
                        {formatCurrency(employeeProfile.monthlyGross)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Annual Base:</span>
                      <p className="font-mono-brand font-semibold text-white">
                        {formatCurrency(employeeProfile.monthlyGross * 12)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    { icon: Briefcase, label: "Employment Type", value: employeeProfile.employmentType },
                    { icon: Building2, label: "Primary Location", value: employeeProfile.location },
                    { icon: Calendar, label: "Contract Start Date", value: formatDate(employeeProfile.contractStart) },
                    { icon: FileText, label: "Contract Reference", value: employeeProfile.contractRef },
                    { icon: Wallet, label: "Disbursement IBAN", value: employeeProfile.ibanMasked },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5"
                    >
                      <span className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </span>
                      <span className="font-mono-brand font-semibold text-gray-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5 lg:col-span-7">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-gray-900 dark:text-white">
                      Monthly Payslips &amp; Tax Statements
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click any statement to view itemized gross-to-net tax and social security deductions
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { period: "November 2026", payDate: "2026-11-28", status: "Scheduled SEPA", bonus: 450 },
                    { period: "October 2026", payDate: "2026-10-30", status: "Paid", bonus: 0 },
                    { period: "September 2026", payDate: "2026-09-30", status: "Paid", bonus: 0 },
                    { period: "August 2026", payDate: "2026-08-31", status: "Paid", bonus: 0 },
                  ].map((slip) => (
                    <div
                      key={slip.period}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:hover:border-brand-500/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            Payslip · {slip.period}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Value date: {formatDate(slip.payDate)} · {employeeProfile.ibanMasked}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-mono-brand text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(employeeProfile.monthlyNet + slip.bonus)} net
                          </p>
                          <p className="font-mono-brand text-[11px] text-gray-400">
                            {formatCurrency(employeeProfile.monthlyGross + slip.bonus)} gross
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setSelectedPayslip(slip.period)}>
                          View Statement
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE B: BOSS / LEADERSHIP VIEW (All Staff Leave Approvals & Timesheets)
          ===================================================================== */}
      {viewMode === "manager" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-navy-900">
              {(
                [
                  { id: "leave", label: `Team Leave & PTO Requests (${leaves.length})` },
                  { id: "timesheets", label: `All Staff Timesheets (${timesheets.length})` },
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
                  Log Team Hours
                </Button>
                <Button variant="outline-fill" onClick={() => setShowAddLeave(true)}>
                  <Plus className="h-4 w-4" />
                  Record Leave Request
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

          {tab === "leave" ? (
            <TableShell>
              <table className="w-full min-w-[880px] table-fixed text-sm">
                <TableHead
                  columns={[
                    { label: "Employee", width: "w-[22%]" },
                    { label: "Leave Category", width: "w-[16%]" },
                    { label: "Duration", width: "w-[22%]" },
                    { label: "Reason & Reviewer Note", width: "w-[20%]" },
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
                          {item.reviewer_note && (
                            <p className="truncate text-[11px] text-brand-600 dark:text-brand-400">
                              Note: {item.reviewer_note}
                            </p>
                          )}
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
          ) : (
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
        </>
      )}

      {/* Payslip Itemized Statement Modal */}
      <Dialog
        open={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        title={`Salary Statement · ${selectedPayslip ?? ""}`}
        description={`${employeeProfile.fullName} · ${employeeProfile.position} · Tax Class I (Germany)`}
        size="md"
        footer={
          <div className="flex justify-between items-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-4 w-4" />
              Verified Payroll Document
            </span>
            <Button onClick={() => setSelectedPayslip(null)}>Done</Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
            <p className="mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">Earnings</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Base Monthly Salary</span>
                <span className="font-mono-brand font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(employeeProfile.monthlyGross)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300"> Home-Office &amp; Internet Allowance</span>
                <span className="font-mono-brand font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(150)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
            <p className="mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
              Statutory Taxes &amp; Social Security
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Income Tax (Lohnsteuer)</span>
                <span className="font-mono-brand text-rose-600 dark:text-rose-400">
                  -{formatCurrency(Math.round(employeeProfile.taxAndSocial * 0.52))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Health &amp; Long-Term Care Insurance</span>
                <span className="font-mono-brand text-rose-600 dark:text-rose-400">
                  -{formatCurrency(Math.round(employeeProfile.taxAndSocial * 0.24))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pension &amp; Unemployment Contribution</span>
                <span className="font-mono-brand text-rose-600 dark:text-rose-400">
                  -{formatCurrency(Math.round(employeeProfile.taxAndSocial * 0.24))}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
            <div>
              <p className="text-xs font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-300">
                Net SEPA Transfer
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Account {employeeProfile.ibanMasked}</p>
            </div>
            <p className="font-mono-brand text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(employeeProfile.monthlyNet + 150)}
            </p>
          </div>
        </div>
      </Dialog>

      <AddLeaveDialog
        open={showAddLeave}
        onClose={() => setShowAddLeave(false)}
        isDemoFallback={isDemoFallback}
        defaultEmployeeName={viewMode === "employee" ? employeeProfile.fullName : ""}
        onCreated={(l) => setLeaves((cur) => [l, ...cur])}
      />

      <AddTimesheetDialog
        open={showAddTimesheet}
        onClose={() => setShowAddTimesheet(false)}
        isDemoFallback={isDemoFallback}
        defaultEmployeeName={viewMode === "employee" ? employeeProfile.fullName : ""}
        onCreated={(t) => setTimesheets((cur) => [t, ...cur])}
      />
    </div>
  );
}

function AddLeaveDialog({
  open,
  onClose,
  isDemoFallback,
  defaultEmployeeName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  defaultEmployeeName?: string;
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
    if (end_date < start_date) {
      toast.error("End date cannot be earlier than start date.");
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
      toast.success("Leave request submitted for approval");
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
      description="Choose your leave category, dates, and handover notes. Status updates in real time once reviewed."
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
          <Input
            name="employee_name"
            defaultValue={defaultEmployeeName}
            placeholder="e.g. Lukas Weber"
            required
          />
        </FormRow>
        <FormRow label="Type of leave" required>
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
        <FormRow label="Reason & Team Handover Notes">
          <Textarea name="reason" rows={3} placeholder="Who is covering urgent tasks during your absence..." />
        </FormRow>
      </form>
    </Dialog>
  );
}

function AddTimesheetDialog({
  open,
  onClose,
  isDemoFallback,
  defaultEmployeeName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  defaultEmployeeName?: string;
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
          <Input name="employee_name" defaultValue={defaultEmployeeName} placeholder="e.g. Alex Vance" required />
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
