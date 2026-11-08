"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { useCanWrite } from "@/components/auth/permissions-provider";

export function AddEmployeeButton() {
  const canWrite = useCanWrite("employees");
  const [open, setOpen] = useState(false);
  // Remount the form on each open so a previous draft doesn't linger.
  const [formKey, setFormKey] = useState(0);
  if (!canWrite) return null;
  return (
    <>
      <Button
        variant="outline-fill"
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        Add employee
      </Button>
      <EmployeeFormDialog key={formKey} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
