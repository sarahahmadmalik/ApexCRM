"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Go back" for the 404 page: history if there is any, otherwise the overview. */
export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/overview"))}
    >
      <ArrowLeft className="h-4 w-4" />
      Go back
    </Button>
  );
}
