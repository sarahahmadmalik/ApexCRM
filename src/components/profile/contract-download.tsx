"use client";

import { downloadContractDocument } from "@/app/(app)/employees/actions";
import { DownloadMenu } from "@/components/ui/download-menu";

export function ContractDownload({ contractId }: { contractId: string }) {
  return (
    <DownloadMenu
      variant="button"
      label="View contract"
      onDownload={(format) => downloadContractDocument(contractId, format)}
    />
  );
}
