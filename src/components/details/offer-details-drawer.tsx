"use client";

import { DetailsDrawer, DetailGrid, DetailHighlights, DetailItem, DetailSection, LineItemsView, formatDateTime } from "@/components/ui/details-drawer";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Database } from "@/lib/types/database";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
export type OfferDetails = Database["public"]["Tables"]["angebots"]["Row"] & {
  firms: Pick<Firm, "id" | "name" | "city" | "country"> | null;
};

export function OfferDetailsDrawer({
  offer,
  onClose,
  statusBadge,
}: {
  offer: OfferDetails | null;
  onClose: () => void;
  statusBadge: React.ReactNode;
}) {
  return (
    <DetailsDrawer
      open={!!offer}
      onClose={onClose}
      title={offer?.angebot_number ?? "Offer"}
      description={offer?.firms ? `Offer for ${offer.firms.name}` : undefined}
      badge={offer && statusBadge}
    >
      {offer && (
        <>
          <DetailHighlights
            items={[
              { label: "Total", value: formatCurrency(offer.total_amount) },
              { label: "Valid until", value: formatDate(offer.valid_until) },
              { label: "Line items", value: String(offer.line_items?.length ?? 0) },
            ]}
          />

          <DetailSection title="Overview">
            <DetailGrid>
              <DetailItem label="Firm">{offer.firms?.name}</DetailItem>
              <DetailItem label="Location">{offer.firms ? `${offer.firms.city}, ${offer.firms.country}` : null}</DetailItem>
              <DetailItem label="Issue date">{formatDate(offer.issue_date)}</DetailItem>
              <DetailItem label="Valid until">{formatDate(offer.valid_until)}</DetailItem>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Line items">
            <LineItemsView
              items={offer.line_items ?? []}
              vatRate={offer.vat_rate}
              net={offer.net_amount}
              vat={offer.vat_amount}
              total={offer.total_amount}
            />
          </DetailSection>

          <DetailSection title="Record">
            <DetailGrid>
              <DetailItem label="Created">{formatDateTime(offer.created_at)}</DetailItem>
              <DetailItem label="Last updated">{formatDateTime(offer.updated_at)}</DetailItem>
            </DetailGrid>
          </DetailSection>
        </>
      )}
    </DetailsDrawer>
  );
}
