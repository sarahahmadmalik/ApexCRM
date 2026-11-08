"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceFormDialog } from "@/components/invoices/invoice-form-dialog";
import type { Database } from "@/lib/types/database";
import { useCanWrite } from "@/components/auth/permissions-provider";

type Firm = Database["public"]["Tables"]["firms"]["Row"];
type Angebot = Database["public"]["Tables"]["angebots"]["Row"];

export function AddInvoiceButton({ firms, angebots }: { firms: Firm[]; angebots: Angebot[] }) {
  const canWrite = useCanWrite("invoices");
  const [open, setOpen] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <Button variant="outline-fill" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New invoice
      </Button>
      <InvoiceFormDialog open={open} onClose={() => setOpen(false)} firms={firms} angebots={angebots} />
    </>
  );
}
