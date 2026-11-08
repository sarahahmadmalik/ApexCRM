"use client";

import { DetailsDrawer, DetailGrid, DetailHighlights, DetailItem, DetailSection, LineItemsView, formatDateTime } from "@/components/ui/details-drawer";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Database } from "@/lib/types/database";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
export type InvoiceDetails = Database["public"]["Tables"]["invoices"]["Row"] & {
  firms: Pick<Firm, "id" | "name" | "city" | "country"> | null;
};

export function InvoiceDetailsDrawer({
  invoice,
  offerNumber,
  onClose,
  statusBadge,
}: {
  invoice: InvoiceDetails | null;
  /** Number of the offer this invoice was created from, when there is one. */
  offerNumber?: string | null;
  onClose: () => void;
  statusBadge: React.ReactNode;
}) {
  const hasPeriod = !!invoice && (invoice.service_period_start || invoice.service_period_end);

  return (
    <DetailsDrawer
      open={!!invoice}
      onClose={onClose}
      title={invoice?.invoice_number ?? "Invoice"}
      description={invoice?.firms ? `Invoice for ${invoice.firms.name}` : undefined}
      badge={invoice && statusBadge}
    >
      {invoice && (
        <>
          <DetailHighlights
            items={[
              { label: "Total", value: formatCurrency(invoice.total_amount) },
              { label: "Issued", value: formatDate(invoice.issue_date) },
              { label: "Due", value: formatDate(invoice.due_date) },
            ]}
          />

          <DetailSection title="Overview">
            <DetailGrid>
              <DetailItem label="Firm">{invoice.firms?.name}</DetailItem>
              <DetailItem label="Location">
                {invoice.firms ? `${invoice.firms.city}, ${invoice.firms.country}` : null}
              </DetailItem>
              <DetailItem label="Issue date">{formatDate(invoice.issue_date)}</DetailItem>
              <DetailItem label="Due date">{formatDate(invoice.due_date)}</DetailItem>
              <DetailItem label="Service period">
                {hasPeriod ? `${formatDate(invoice.service_period_start)} – ${formatDate(invoice.service_period_end)}` : null}
              </DetailItem>
              <DetailItem label="Created from offer" mono>
                {offerNumber}
              </DetailItem>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Line items">
            <LineItemsView
              items={invoice.line_items ?? []}
              vatRate={invoice.vat_rate}
              net={invoice.net_amount}
              vat={invoice.vat_amount}
              total={invoice.total_amount}
            />
          </DetailSection>

          <DetailSection title="Record">
            <DetailGrid>
              <DetailItem label="Created">{formatDateTime(invoice.created_at)}</DetailItem>
              <DetailItem label="Last updated">{formatDateTime(invoice.updated_at)}</DetailItem>
            </DetailGrid>
          </DetailSection>
        </>
      )}
    </DetailsDrawer>
  );
}
