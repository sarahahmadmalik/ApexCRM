import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant =
  | "primary"
  | "navy"
  | "secondary"
  | "outline"
  | "outline-brand"
  | "outline-fill"
  | "outline-excel"
  | "ghost"
  | "danger";
type Size = "sm" | "md" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-sm hover:bg-brand-600 hover:shadow-[0_0_0_3px_rgba(6,182,212,0.2)] focus-visible:outline-brand-500",
  navy: "bg-navy-900 text-white hover:bg-navy-800 focus-visible:outline-navy-900",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:outline-brand-500 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20",
  // Neutral outline — used for Cancel, deliberately not the brand cyan so it
  // never competes with the primary action beside it.
  outline:
    "border border-gray-300 bg-transparent text-gray-700 hover:border-gray-400 hover:bg-gray-100 focus-visible:outline-gray-400 dark:border-white/25 dark:text-gray-200 dark:hover:border-white/40 dark:hover:bg-white/10",
  "outline-brand": "border border-brand-500 text-brand-600 bg-transparent hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10",
  // The standard "Add …" action: outlined at rest, fills in on hover.
  "outline-fill":
    "border border-brand-500 bg-transparent text-brand-600 hover:bg-brand-500 hover:text-white hover:shadow-[0_0_0_3px_rgba(6,182,212,0.18)] focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-white",
  // Spreadsheet export — Excel green, same outline→fill behaviour.
  "outline-excel":
    "border border-emerald-600 bg-transparent text-emerald-700 hover:bg-emerald-600 hover:text-white hover:shadow-[0_0_0_3px_rgba(16,185,129,0.18)] focus-visible:outline-emerald-600 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white",
  ghost: "text-gray-600 hover:bg-gray-100 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/10",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-red-600",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  icon: "h-9 w-9",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }
>(({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97] cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
Button.displayName = "Button";
