import { Eye } from "lucide-react";

/**
 * Shown at the top of a page the signed-in user can read but not change, so
 * the missing "Add" / "Edit" / "Delete" controls read as a deliberate access
 * level rather than a broken page.
 */
export function ViewOnlyNotice({ pageLabel }: { pageLabel: string }) {
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-400/20 dark:bg-blue-400/10"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300">
        <Eye className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">View only</p>
        <p className="mt-0.5 text-sm text-blue-800/80 dark:text-blue-300/80">
          You can browse everything on {pageLabel}, open details and download documents. Adding, editing and deleting
          are turned off for your account. Ask your workspace admin if you need edit access.
        </p>
      </div>
    </div>
  );
}
