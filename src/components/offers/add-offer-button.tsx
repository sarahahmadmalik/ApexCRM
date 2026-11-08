"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfferFormDialog } from "@/components/offers/offer-form-dialog";
import type { Database } from "@/lib/types/database";
import { useCanWrite } from "@/components/auth/permissions-provider";

type Firm = Database["public"]["Tables"]["firms"]["Row"];

export function AddOfferButton({ firms }: { firms: Firm[] }) {
  const canWrite = useCanWrite("offers");
  const [open, setOpen] = useState(false);
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
        New offer
      </Button>
      <OfferFormDialog key={formKey} open={open} onClose={() => setOpen(false)} firms={firms} />
    </>
  );
}
