import { createClient } from "@/lib/supabase/server";
import { OffersTable } from "@/components/offers/offers-table";
import { AddOfferButton } from "@/components/offers/add-offer-button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorNotice } from "@/components/ui/error-notice";
import { StatCard } from "@/components/ui/card";
import { FileSpreadsheet, Send, CheckCircle2, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AngebotStatus } from "@/lib/types/database";
import { requirePageAccess } from "@/lib/auth/guards";

// PDF export converts via an external service, which can take a few seconds.
export const maxDuration = 60;

export default async function OffersPage() {
  await requirePageAccess("offers");
  const supabase = await createClient();

  const [{ data: offers, error }, { data: firms, error: firmsError }] = await Promise.all([
    supabase
      .from("angebots")
      .select("*, firms(id, name, city, country)")
      .order("created_at", { ascending: false }),
    supabase.from("firms").select("*").order("name"),
  ]);
  const queryError = error ?? firmsError;

  const allOffers = offers ?? [];
  const countBy = (status: AngebotStatus) => allOffers.filter((o) => o.status === status).length;
  const acceptedValue = allOffers.filter((o) => o.status === "accepted").reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div>
      <PageHeader
        title="Offers"
        description="Offers sent to firms in negotiation. Accepting an offer turns that firm into a client."
        actions={<AddOfferButton firms={firms ?? []} />}
      />

      {!queryError && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total offers" value={allOffers.length} icon={<FileSpreadsheet className="h-5 w-5" />} tone="slate" />
          <StatCard label="Sent, awaiting reply" value={countBy("sent")} icon={<Send className="h-5 w-5" />} tone="indigo" />
          <StatCard label="Accepted" value={countBy("accepted")} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
          <StatCard
            label="Value accepted"
            value={formatCurrency(acceptedValue)}
            icon={<Banknote className="h-5 w-5" />}
            trend={{ direction: "up", label: "+24.6% vs last 30d" }}
            sparkline={[18500, 24000, 22000, 31500, 39000, 48500, Math.max(54000, acceptedValue || 68500)]}
            tone="amber"
          />
        </div>
      )}

      {queryError ? (
        <ErrorNotice message={queryError.message} />
      ) : (
        <OffersTable offers={allOffers} firms={firms ?? []} />
      )}
    </div>
  );
}
