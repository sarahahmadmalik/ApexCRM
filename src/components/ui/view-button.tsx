import { Eye } from "lucide-react";

/** The Actions-column "View details" icon button. */
export function ViewButton({ onClick, label = "View details" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-gray-500 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}
