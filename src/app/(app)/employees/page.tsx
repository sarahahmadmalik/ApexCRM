import { createClient } from "@/lib/supabase/server";
import { EmployeesCards } from "@/components/employees/employees-cards";
import { AddEmployeeButton } from "@/components/employees/add-employee-button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import { requirePageAccess } from "@/lib/auth/guards";

export default async function EmployeesPage() {
  await requirePageAccess("employees");
  const supabase = await createClient();
  const [{ data: employees, error }, { data: contracts, error: contractsError }] = await Promise.all([
    supabase.from("employees").select("*").order("full_name"),
    supabase
      .from("contracts")
      .select("id, employee_id, file_path, status, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const queryError = error ?? contractsError;

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Team roster, contact details and contract status across the organization"
        actions={<AddEmployeeButton />}
      />

      {queryError ? (
        <ErrorNotice message={queryError.message} />
      ) : (
        <EmployeesCards employees={employees ?? []} contracts={contracts ?? []} />
      )}
    </div>
  );
}
