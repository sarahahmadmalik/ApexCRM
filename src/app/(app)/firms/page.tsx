import { createClient } from "@/lib/supabase/server";
import { FirmsFilterBar } from "@/components/firms/filter-bar";
import { FirmsTable } from "@/components/firms/firms-table";
import { AddFirmButton } from "@/components/firms/add-firm-button";
import { ExportFirmsButton } from "@/components/firms/export-firms-button";
import { ImportFirmsButton } from "@/components/firms/import-firms-button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { FirmStatus } from "@/lib/types/database";
import { requirePageAccess } from "@/lib/auth/guards";

const PAGE_SIZE = 10;

export default async function FirmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageAccess("firms");
  const params = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const SORTABLE_COLUMNS: Record<string, string> = {
    firm: "name",
    location: "city",
    status: "status",
  };
  const sortColumn = SORTABLE_COLUMNS[params.sort ?? ""] ?? "created_at";
  const ascending = params.dir === "asc";

  let query = supabase.from("firms").select("*").order(sortColumn, { ascending });
  let countQuery = supabase.from("firms").select("*", { count: "exact", head: true });

  if (params.q) {
    query = query.ilike("name", `%${params.q}%`);
    countQuery = countQuery.ilike("name", `%${params.q}%`);
  }
  if (params.country) {
    query = query.in("country", params.country.split(","));
    countQuery = countQuery.in("country", params.country.split(","));
  }
  if (params.state) {
    query = query.in("state", params.state.split(","));
    countQuery = countQuery.in("state", params.state.split(","));
  }
  if (params.city) {
    query = query.in("city", params.city.split(","));
    countQuery = countQuery.in("city", params.city.split(","));
  }
  if (params.status) {
    const statuses = params.status.split(",") as FirmStatus[];
    query = query.in("status", statuses);
    countQuery = countQuery.in("status", statuses);
  }

  const [{ data: firms, error }, { count, error: countError }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    countQuery,
  ]);
  const queryError = error ?? countError;

  return (
    <div>
      <PageHeader
        title="Firms"
        description="Every company we've reached out to across the European outreach campaign"
        actions={
          <>
            <ExportFirmsButton />
            <ImportFirmsButton />
            <AddFirmButton />
          </>
        }
      />

      {queryError ? (
        <ErrorNotice message={queryError.message} />
      ) : (
        <FirmsTable
          firms={firms ?? []}
          currentPage={page}
          totalItems={count ?? 0}
          pageSize={PAGE_SIZE}
          sortBy={params.sort ?? null}
          sortDir={params.dir === "asc" ? "asc" : "desc"}
          // Keyed because this element is created in a Server Component and
          // handed across the boundary as a prop.
          filters={<FirmsFilterBar key="firms-filters" />}
        />
      )}
    </div>
  );
}
