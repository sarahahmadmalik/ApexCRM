import { createClient } from "@/lib/supabase/server";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { AddInvoiceButton } from "@/components/invoices/add-invoice-button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import { StatCard } from "@/components/ui/card";
import { Receipt, CheckCircle2, AlertTriangle, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { requirePageAccess } from "@/lib/auth/guards";

// PDF export converts via an external service, which can take a few seconds.
export const maxDuration = 60;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ firm?: string }>;
}) {
  await requirePageAccess("invoices");
  const { firm } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("*, firms(id, name, city, country)")
    .order("created_at", { ascending: false });
  if (firm) query = query.eq("firm_id", firm);

  const [{ data: invoices, error }, { data: firms }, { data: angebots }] = await Promise.all([
    query,
    supabase.from("firms").select("*").order("name"),
    supabase.from("angebots").select("*").order("created_at", { ascending: false }),
  ]);

  const allInvoices = invoices ?? [];
  const paidCount = allInvoices.filter((i) => i.status === "paid").length;
  const overdueCount = allInvoices.filter((i) => i.status === "overdue").length;
  const outstanding = allInvoices
    .filter((i) => i.status === "draft" || i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total_amount, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Payment invoices raised against client work"
        actions={<AddInvoiceButton firms={firms ?? []} angebots={angebots ?? []} />}
      />

      {!error && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total invoices" value={allInvoices.length} icon={<Receipt className="h-5 w-5" />} tone="slate" />
          <StatCard label="Paid" value={paidCount} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
          <StatCard label="Overdue" value={overdueCount} icon={<AlertTriangle className="h-5 w-5" />} tone="rose" />
          <StatCard
            label="Outstanding"
            value={formatCurrency(outstanding)}
            icon={<Banknote className="h-5 w-5" />}
            sublabel="Not yet paid"
            tone="amber"
          />
        </div>
      )}

      {error ? <ErrorNotice message={error.message} /> : <InvoicesTable invoices={allInvoices} offerNumbers={Object.fromEntries((angebots ?? []).map((a) => [a.id, a.angebot_number]))} />}
    </div>
  );
}
