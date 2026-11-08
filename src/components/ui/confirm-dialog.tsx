"use client";

import { useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  /** Body copy — say what will happen and to what. */
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

/**
 * Replaces window.confirm() for destructive actions: a real themed modal
 * instead of the browser's unstyled, unthemeable alert.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   confirm({ title, message, onConfirm })
 *   ...
 *   return <>{dialog}...</>
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((next: ConfirmOptions) => setOptions(next), []);
  const close = useCallback(() => setOptions(null), []);

  async function handleConfirm() {
    if (!options) return;
    setBusy(true);
    try {
      await options.onConfirm();
      setOptions(null);
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <Dialog
      open={options !== null}
      onClose={close}
      size="sm"
      title={options?.title ?? ""}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirm} loading={busy} disabled={busy}>
            {options?.confirmLabel ?? "Delete"}
          </Button>
        </div>
      }
    >
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 text-sm text-gray-600 dark:text-gray-300">{options?.message}</div>
      </div>
    </Dialog>
  );

  return { confirm, dialog };
}
