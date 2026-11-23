import { Banknote, CheckCircle2, Clock, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { ExpensesBoard } from "@/components/expenses/expenses-board";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Expenses & Payroll · ApexCRM" };

export default async function ExpensesPage() {
  await requirePageAccess("expenses");
  const supabase = await createClient();

  const [claimsRes, payrollRes] = await Promise.all([
    supabase.from("expense_claims").select("*").order("expense_date", { ascending: false }),
    supabase.from("payroll_runs").select("*").order("pay_date", { ascending: false }),
  ]);

  const queryError = claimsRes.error ?? payrollRes.error;
  const claims = claimsRes.data ?? [];
  const payroll = payrollRes.data ?? [];

  const latestPayroll = payroll[0]?.gross_total ?? 0;
  const pendingClaimsTotal = claims
    .filter((c) => c.status === "pending" || c.status === "approved")
    .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
  const reimbursedTotal = claims
    .filter((c) => c.status === "reimbursed")
    .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses & Payroll Operations"
        description="Approve employee expense claims, manage SaaS & travel spend, and execute monthly SEPA payroll runs."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Latest monthly payroll"
          value={formatCurrency(latestPayroll)}
          sublabel={payroll[0] ? `${payroll[0].period_label} · ${payroll[0].employee_count} staff` : "No runs yet"}
          sparkline={[38200, 39600, 42400, 42400, Math.max(46800, latestPayroll)]}
          icon={<Wallet className="h-5 w-5" />}
          tone="slate"
        />
        <StatCard
          label="Pending reimbursements"
          value={formatCurrency(pendingClaimsTotal)}
          sublabel="Awaiting payout or approval"
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Reimbursed expenses"
          value={formatCurrency(reimbursedTotal)}
          trend={{ direction: "down", label: "-8.4% ops spend MoM" }}
          sparkline={[1420, 1180, 960, 890, Math.max(730, reimbursedTotal)]}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Payroll batches"
          value={payroll.length}
          sublabel={`${payroll.filter((p) => p.status === "paid").length} completed disbursements`}
          icon={<Banknote className="h-5 w-5" />}
          tone="indigo"
        />
      </div>

      {queryError ? (
        <ErrorNotice message={queryError.message} />
      ) : (
        <ExpensesBoard initialClaims={claims} initialPayroll={payroll} />
      )}
    </div>
  );
}
