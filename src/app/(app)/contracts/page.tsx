import { createClient } from "@/lib/supabase/server";
import { differenceInCalendarDays, parseISO, isValid, startOfDay } from "date-fns";
import { ContractsTable } from "@/components/contracts/contracts-table";
import { AddContractButton } from "@/components/contracts/add-contract-button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import { StatCard } from "@/components/ui/card";
import { FileSignature, CheckCircle2, Clock, Hourglass } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/guards";

type StoredContractData = { end_date?: string | null };

export default async function ContractsPage() {
  await requirePageAccess("contracts");
  const supabase = await createClient();
  const [{ data: contracts, error }, { data: employees }] = await Promise.all([
    supabase.from("contracts").select("*, employees(id, full_name, email, country, employment_type)").order("created_at", { ascending: false }),
    supabase.from("employees").select("*").order("full_name"),
  ]);

  const allContracts = contracts ?? [];
  const finalCount = allContracts.filter((c) => c.status === "final").length;
  const draftCount = allContracts.filter((c) => c.status === "draft").length;

  const today = startOfDay(new Date());
  const endingSoon = allContracts.filter((c) => {
    const endDate = (c.data as StoredContractData)?.end_date;
    if (!endDate) return false;
    const parsed = parseISO(endDate);
    if (!isValid(parsed)) return false;
    const daysLeft = differenceInCalendarDays(parsed, today);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Employee contract history and generated documents"
        actions={<AddContractButton employees={employees ?? []} />}
      />

      {!error && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total contracts" value={allContracts.length} icon={<FileSignature className="h-5 w-5" />} tone="slate" />
          <StatCard label="Document ready" value={finalCount} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
          <StatCard label="Template pending" value={draftCount} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="Ending within 30 days" value={endingSoon} icon={<Hourglass className="h-5 w-5" />} tone="rose" />
        </div>
      )}

      {error ? <ErrorNotice message={error.message} /> : <ContractsTable contracts={allContracts} />}
    </div>
  );
}
