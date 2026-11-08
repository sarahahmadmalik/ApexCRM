"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Download, FileText, FileType2, Loader2 } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DocumentFormat } from "@/lib/documents/storage";

const FORMATS: { format: DocumentFormat; label: string; hint: string; icon: typeof FileText; tint: string }[] = [
  {
    format: "pdf",
    label: "PDF document",
    hint: "Best for sending & printing",
    icon: FileText,
    tint: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  },
  {
    format: "docx",
    label: "Word document",
    hint: ".docx file, editable",
    icon: FileType2,
    tint: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
];

/**
 * The one "Download as PDF / Word" control, shared by the Offers, Invoices
 * and Contracts tables and the employee cards. `onDownload` renders the file
 * server-side and resolves to a signed URL, which is then followed so the
 * browser saves it (no popup, so nothing gets blocked).
 */
export function DownloadMenu({
  onDownload,
  variant = "icon",
  label = "Download",
  className,
}: {
  onDownload: (format: DocumentFormat) => Promise<string>;
  variant?: "icon" | "button";
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState<DocumentFormat | null>(null);

  async function run(format: DocumentFormat) {
    setBusy(format);
    try {
      const url = await onDownload(format);
      window.location.assign(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate the document");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu
      portal
      align="right"
      panelClassName="w-60 p-1"
      trigger={({ open, toggle }) =>
        variant === "icon" ? (
          <button
            type="button"
            onClick={toggle}
            disabled={!!busy}
            title={label}
            aria-label={label}
            aria-expanded={open}
            className={cn(
              "cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-60 dark:text-gray-500 dark:hover:bg-brand-500/10 dark:hover:text-brand-300",
              open && "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
              className
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={toggle}
            disabled={!!busy}
            aria-expanded={open}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-60 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15",
              className
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {label}
            <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")} />
          </button>
        )
      }
    >
      {(close) => (
        <>
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            Download as
          </p>
          {FORMATS.map(({ format, label: itemLabel, hint, icon: Icon, tint }) => (
            <button
              key={format}
              type="button"
              onClick={() => {
                close();
                run(format);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tint)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{itemLabel}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
              </span>
            </button>
          ))}
        </>
      )}
    </DropdownMenu>
  );
}
