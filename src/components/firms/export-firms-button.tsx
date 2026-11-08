"use client";

import { useSearchParams } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Exports the firms list — respecting whatever filters are currently applied. */
export function ExportFirmsButton() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.delete("page"); // export the whole filtered set, not just this page

  const href = `/api/export/firms${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <a href={href} download>
      <Button variant="outline-excel" size="md">
        <FileSpreadsheet className="h-4 w-4" />
        Export to Excel
      </Button>
    </a>
  );
}
