import { CalendarCheck, CalendarClock, Clock, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { TimeLeaveBoard, type EmployeeCompensationProfile } from "@/components/time-leave/time-leave-board";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/utils";

export const metadata = { title: "Time, Leave & Employee Portal" };

export default async function TimeLeavePage() {
  const appUser = await requirePageAccess("time_leave");
  const supabase = await createClient();

  const [leavesRes, timesheetsRes, employeeRes] = await Promise.all([
    supabase.from("leave_requests").select("*").order("start_date", { ascending: false }),
    supabase.from("timesheets").select("*").order("work_date", { ascending: false }),
    appUser.email
      ? supabase.from("employees").select("*").eq("email", appUser.email).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const queryError = leavesRes.error ?? timesheetsRes.error;
  const leaves = leavesRes.data ?? [];
  const timesheets = timesheetsRes.data ?? [];

  const emp = employeeRes.data;
  const monthlyGross =
    emp?.salary_amount != null
      ? emp.salary_period === "year"
        ? Math.round(emp.salary_amount / 12)
        : emp.salary_amount
      : 7200;
  const taxAndSocial = Math.round(monthlyGross * 0.32);

  const employeeProfile: EmployeeCompensationProfile = {
    fullName: emp?.full_name ?? appUser.full_name,
    email: appUser.email ?? "employee@apexcrm.io",
    position: emp?.position ?? appUser.role ?? "Senior Full-Stack Engineer",
    department: "Engineering & Delivery",
    location: emp?.country ? `${emp.country} (Hybrid)` : "Berlin, Germany (Hybrid)",
    employmentType: emp?.employment_type ? EMPLOYMENT_TYPE_LABELS[emp.employment_type] : "Full-time",
    contractStart: emp?.contract_start_date ?? "2025-03-01",
    contractRef: emp?.id ? `CTR-${emp.id.slice(0, 6).toUpperCase()}` : "CTR-84A920",
    monthlyGross,
    taxAndSocial,
    monthlyNet: monthlyGross - taxAndSocial,
    ibanMasked: "DE89 3704 •••• •••• 4102",
    annualLeaveQuota: 28,
    remoteWorkQuota: 20,
  };

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
        title="Time, Leave & Employee Self-Service"
        description="Live work timer, PTO quota & leave submissions, personal salary & payslip statements, and manager approval workflows."
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
          trend={{ direction: "up", label: "+12.4% vs last week" }}
          sparkline={[18, 21, 19.5, 24, 26, Math.max(27.5, billableHours)]}
          icon={<Clock className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="Billable utilization"
          value={`${utilizationPct}%`}
          sublabel="Client vs. internal time"
          sparkline={[76, 81, 79, 85, 88, Math.max(90, utilizationPct)]}
          icon={<Percent className="h-5 w-5" />}
          tone="slate"
        />
      </div>

      {queryError ? (
        <ErrorNotice message={queryError.message} />
      ) : (
        <TimeLeaveBoard
          initialLeaves={leaves}
          initialTimesheets={timesheets}
          isBoss={appUser.isAdmin}
          employeeProfile={employeeProfile}
        />
      )}
    </div>
  );
}
