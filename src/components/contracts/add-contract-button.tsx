"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractFormDialog } from "@/components/contracts/contract-form-dialog";
import type { Database } from "@/lib/types/database";
import { useCanWrite } from "@/components/auth/permissions-provider";

type Employee = Database["public"]["Tables"]["employees"]["Row"];

export function AddContractButton({ employees }: { employees: Employee[] }) {
  const canWrite = useCanWrite("contracts");
  const [open, setOpen] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <Button variant="outline-fill" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New contract
      </Button>
      <ContractFormDialog open={open} onClose={() => setOpen(false)} employees={employees} />
    </>
  );
}
