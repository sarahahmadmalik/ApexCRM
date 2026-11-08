"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FirmFormDialog } from "@/components/firms/firm-form-dialog";
import { useCanWrite } from "@/components/auth/permissions-provider";

export function AddFirmButton() {
  const canWrite = useCanWrite("firms");
  const [open, setOpen] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <Button variant="outline-fill" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add firm
      </Button>
      <FirmFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
