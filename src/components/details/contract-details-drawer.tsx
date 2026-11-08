"use client";

import { DetailsDrawer, DetailGrid, DetailHighlights, DetailItem, DetailSection, formatDateTime } from "@/components/ui/details-drawer";
import { EMPLOYMENT_TYPE_LABELS, formatDate } from "@/lib/utils";

export type ContractDetails = {
  id: string;
  status: "draft" | "final";
  created_at: string;
  updated_at: string;
  file_path: string | null;
  data: Record<string, unknown>;
  employees: {
    id: string;
    full_name: string;
    email: string | null;
    country: string | null;
    employment_type: string;
  } | null;
};

type Stored = { position?: string; start_date?: string; end_date?: string | null; salary?: string; notes?: string };

export function ContractDetailsDrawer({
  contract,
  onClose,
  statusBadge,
}: {
  contract: ContractDetails | null;
  onClose: () => void;
  statusBadge: React.ReactNode;
}) {
  const data = (contract?.data ?? {}) as Stored;
  const employee = contract?.employees;

  return (
    <DetailsDrawer
      open={!!contract}
      onClose={onClose}
      title={employee?.full_name ? `${employee.full_name}'s contract` : "Contract"}
      description={contract ? `CTR-${contract.id.slice(0, 6).toUpperCase()}` : undefined}
      badge={contract && statusBadge}
    >
      {contract && (
        <>
          <DetailHighlights
            items={[
              { label: "Salary", value: data.salary ?? "", mono: true },
              { label: "Starts", value: formatDate(data.start_date) },
              { label: "Ends", value: data.end_date ? formatDate(data.end_date) : "Open-ended" },
            ]}
          />

          <DetailSection title="Employee">
            <DetailGrid>
              <DetailItem label="Name">{employee?.full_name}</DetailItem>
              <DetailItem label="Position">{data.position}</DetailItem>
              <DetailItem label="Employment type">
                {employee ? (EMPLOYMENT_TYPE_LABELS[employee.employment_type] ?? employee.employment_type) : null}
              </DetailItem>
              <DetailItem label="Country">{employee?.country}</DetailItem>
              <DetailItem label="Email" full>
                {employee?.email && (
                  <a href={`mailto:${employee.email}`} className="text-brand-600 hover:underline dark:text-brand-400">
                    {employee.email}
                  </a>
                )}
              </DetailItem>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Term & pay">
            <DetailGrid>
              <DetailItem label="Start date">{formatDate(data.start_date)}</DetailItem>
              <DetailItem label="End date">{data.end_date ? formatDate(data.end_date) : "Open-ended"}</DetailItem>
              <DetailItem label="Salary" mono full>
                {data.salary}
              </DetailItem>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Additional terms">
            <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
              {data.notes?.trim() || <span className="text-gray-400 dark:text-gray-500">None</span>}
            </p>
          </DetailSection>

          <DetailSection title="Document">
            <DetailGrid>
              <DetailItem label="Word document">{contract.file_path ? "Generated" : "Not generated yet"}</DetailItem>
              <DetailItem label="Created">{formatDateTime(contract.created_at)}</DetailItem>
              <DetailItem label="Last updated">{formatDateTime(contract.updated_at)}</DetailItem>
            </DetailGrid>
          </DetailSection>
        </>
      )}
    </DetailsDrawer>
  );
}
