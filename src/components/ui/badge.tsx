import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  /** Native tooltip, e.g. what a status means. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  );
}
