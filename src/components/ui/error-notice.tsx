"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Shared inline error surface for failed page/data loads, with an integrated retry action. */
export function ErrorNotice({
  message,
  title = "Couldn't load this data",
  showRetry = true,
}: {
  message: string;
  title?: string;
  showRetry?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="alert"
      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">{title}</p>
          <p className="mt-0.5 text-sm break-words text-red-600 dark:text-red-400">{message}</p>
        </div>
      </div>
      {showRetry && (
        <button
          type="button"
          onClick={() => startTransition(() => router.refresh())}
          disabled={pending}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-500/20"
        >
          <RotateCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Retrying…" : "Retry"}
        </button>
      )}
    </div>
  );
}
