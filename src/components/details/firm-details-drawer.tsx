"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Globe, Mail, MapPin, Phone } from "lucide-react";
import { DetailsDrawer, DetailGrid, DetailHighlights, DetailItem, DetailSection, formatDateTime } from "@/components/ui/details-drawer";
import { StatusBadge } from "@/components/firms/status-badge";
import { getFirmStatusHistory } from "@/app/(app)/firms/actions";
import type { Database } from "@/lib/types/database";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
type HistoryRow = Database["public"]["Views"]["firm_status_history_feed"]["Row"];

const link = "text-brand-600 hover:underline dark:text-brand-400";

export function FirmDetailsDrawer({ firm, onClose }: { firm: Firm | null; onClose: () => void }) {
  const [history, setHistory] = useState<{ firmId: string; rows: HistoryRow[] | "error" } | null>(null);
  const firmId = firm?.id;

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    getFirmStatusHistory(firmId)
      .then((rows) => {
        if (!cancelled) setHistory({ firmId, rows });
      })
      .catch(() => {
        if (!cancelled) setHistory({ firmId, rows: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [firmId]);

  // Only trust history that belongs to the firm currently shown.
  const rows = history && history.firmId === firmId ? history.rows : null;
  const website = firm?.website ? (firm.website.startsWith("http") ? firm.website : `https://${firm.website}`) : null;

  return (
    <DetailsDrawer
      open={!!firm}
      onClose={onClose}
      title={firm?.name ?? "Firm"}
      description={firm ? `${firm.city}, ${firm.state}, ${firm.country}` : undefined}
      badge={firm && <StatusBadge status={firm.status} />}
    >
      {firm && (
        <>
          <DetailHighlights
            items={[
              { label: "City", value: firm.city },
              { label: "Contact", value: firm.contact_name ?? "" },
              { label: "Last updated", value: formatDateTime(firm.updated_at).split(",")[0] },
            ]}
          />

          <DetailSection title="Location">
            <DetailGrid>
              <DetailItem label="Country">{firm.country}</DetailItem>
              <DetailItem label="State">{firm.state}</DetailItem>
              <DetailItem label="City">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  {firm.city}
                </span>
              </DetailItem>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Contact">
            <DetailGrid>
              <DetailItem label="Contact person">{firm.contact_name}</DetailItem>
              <DetailItem label="Email">
                {firm.contact_email && (
                  <a href={`mailto:${firm.contact_email}`} className={`inline-flex items-center gap-1.5 ${link}`}>
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {firm.contact_email}
                  </a>
                )}
              </DetailItem>
              <DetailItem label="Phone">
                {firm.contact_phone && (
                  <a href={`tel:${firm.contact_phone}`} className={`inline-flex items-center gap-1.5 ${link}`}>
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {firm.contact_phone}
                  </a>
                )}
              </DetailItem>
              <DetailItem label="Website">
                {website && (
                  <a href={website} target="_blank" rel="noreferrer noopener" className={`inline-flex items-center gap-1.5 ${link}`}>
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    {firm.website}
                  </a>
                )}
              </DetailItem>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Notes">
            <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
              {firm.notes || <span className="text-gray-400 dark:text-gray-500">No notes</span>}
            </p>
          </DetailSection>

          <DetailSection title="Status history">
            {rows === null && <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>}
            {rows === "error" && <p className="text-sm text-gray-400 dark:text-gray-500">History isn&apos;t available.</p>}
            {Array.isArray(rows) && rows.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">No status changes recorded yet.</p>
            )}
            {Array.isArray(rows) && rows.length > 0 && (
              <ol className="space-y-3">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {r.old_status ? <StatusBadge status={r.old_status} /> : <span className="text-xs text-gray-400">Created</span>}
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    <StatusBadge status={r.new_status} />
                    <span className="w-full text-xs text-gray-400 dark:text-gray-500">
                      {formatDateTime(r.changed_at)}
                      {r.changed_by_name ? ` · ${r.changed_by_name}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </DetailSection>

          <DetailSection title="Record">
            <DetailGrid>
              <DetailItem label="Added">{formatDateTime(firm.created_at)}</DetailItem>
              <DetailItem label="Last updated">{formatDateTime(firm.updated_at)}</DetailItem>
            </DetailGrid>
          </DetailSection>
        </>
      )}
    </DetailsDrawer>
  );
}
