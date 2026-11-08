import { AlertTriangle } from "lucide-react";

/** Shared inline error surface for failed page/data loads. */
export function ErrorNotice({ message, title = "Couldn't load this data" }: { message: string; title?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">{title}</p>
        <p className="mt-0.5 text-sm break-words text-red-600 dark:text-red-400">{message}</p>
      </div>
    </div>
  );
}
