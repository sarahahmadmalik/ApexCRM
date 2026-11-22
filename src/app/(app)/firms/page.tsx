import { createClient } from "@/lib/supabase/server";
import { FirmsFilterBar } from "@/components/firms/filter-bar";
import { FirmsTable } from "@/components/firms/firms-table";
import { AddFirmButton } from "@/components/firms/add-firm-button";
import { ExportFirmsButton } from "@/components/firms/export-firms-button";
import { ImportFirmsButton } from "@/components/firms/import-firms-button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import { DEMO_FIRMS } from "@/lib/data/showcase-seed";
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

  // Augment with showcase enterprise firms (clients, negotiation, responded) on page 1 so the showcase pipeline has rich statuses
  const filteredDemo = DEMO_FIRMS.filter((df) => {
    if (params.q && !df.name.toLowerCase().includes(params.q.toLowerCase())) return false;
    if (params.country && !params.country.split(",").includes(df.country)) return false;
    if (params.state && !params.state.split(",").includes(df.state)) return false;
    if (params.city && !params.city.split(",").includes(df.city)) return false;
    if (params.status && !(params.status.split(",") as FirmStatus[]).includes(df.status)) return false;
    return true;
  });

  const dbFirms = firms ?? [];
  const dbNames = new Set(dbFirms.map((f) => f.name.toLowerCase()));
  const extraDemo = page === 1 ? filteredDemo.filter((df) => !dbNames.has(df.name.toLowerCase())) : [];
  const combinedFirms = [...extraDemo.slice(0, 5), ...dbFirms].slice(0, PAGE_SIZE);
  const totalCount = Math.max(count ?? 0, (count ?? 0) + filteredDemo.length);

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
          firms={combinedFirms}
          currentPage={page}
          totalItems={totalCount}
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
