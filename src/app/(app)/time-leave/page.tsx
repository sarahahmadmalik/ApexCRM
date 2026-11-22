import { CalendarCheck, CalendarClock, Clock, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/card";
import { TimeLeaveBoard } from "@/components/time-leave/time-leave-board";
import { DEMO_LEAVE_REQUESTS, DEMO_TIMESHEETS } from "@/lib/data/showcase-seed";

export const metadata = { title: "Time & Leave · ApexCRM" };

export default async function TimeLeavePage() {
  await requirePageAccess("time_leave");
  const supabase = await createClient();

  const [leavesRes, timesheetsRes] = await Promise.all([
    supabase.from("leave_requests").select("*").order("start_date", { ascending: false }),
    supabase.from("timesheets").select("*").order("work_date", { ascending: false }),
  ]);

  const isDemoFallback = Boolean(leavesRes.error || timesheetsRes.error);
  const leaves = isDemoFallback ? DEMO_LEAVE_REQUESTS : (leavesRes.data ?? []);
  const timesheets = isDemoFallback ? DEMO_TIMESHEETS : (timesheetsRes.data ?? []);

  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
  const approvedDays = leaves
    .filter((l) => l.status === "approved")
    .reduce((sum, l) => sum + Number(l.days_count ?? 0), 0);
  const totalHours = timesheets.reduce((sum, t) => sum + Number(t.hours_logged ?? 0), 0);
  const billableHours = timesheets
    .filter((t) => t.billable)
    .reduce((sum, t) => sum + Number(t.hours_logged ?? 0), 0);
  const utilizationPct = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time, Attendance & Leave Management"
        description="Manage employee PTO approvals, remote work schedules, and billable project timesheets."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending leave requests"
          value={pendingLeaves}
          sublabel="Awaiting manager sign-off"
          icon={<CalendarClock className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Approved PTO days"
          value={approvedDays}
          sublabel="Scheduled team absence"
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Billable hours logged"
          value={`${billableHours}h`}
          sublabel={`${totalHours}h total recorded`}
          icon={<Clock className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="Billable utilization"
          value={`${utilizationPct}%`}
          sublabel="Client vs. internal time"
          icon={<Percent className="h-5 w-5" />}
          tone="slate"
        />
      </div>

      <TimeLeaveBoard initialLeaves={leaves} initialTimesheets={timesheets} isDemoFallback={isDemoFallback} />
    </div>
  );
}
