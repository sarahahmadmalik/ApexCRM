"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportFirmsDialog } from "@/components/firms/import-firms-dialog";
import { useCanWrite } from "@/components/auth/permissions-provider";

export function ImportFirmsButton() {
  const canWrite = useCanWrite("firms");
  const [open, setOpen] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Import CSV
      </Button>
      <ImportFirmsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
