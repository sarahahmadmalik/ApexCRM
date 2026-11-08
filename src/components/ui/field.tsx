import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Shared "filled" look: soft gray fill, no visible border, brightens + gets a cyan ring on focus. */
const fieldBase =
  "w-full rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200 ease-in-out hover:border-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none dark:border-white/10 dark:bg-navy-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-white/20 dark:focus:border-brand-400 dark:focus:ring-brand-400/10";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400", className)}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, "h-10 px-3 text-sm", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "px-3 py-2 text-sm", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, "h-10 cursor-pointer px-3 text-sm", className)} {...props}>
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";

export function FormRow({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  /** Validation message — replaces the hint and reddens the label while set. */
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label className={error ? "text-red-600 dark:text-red-400" : undefined}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

/** iOS-style toggle switch — for on/off settings like "generate a contract" or "mark complete". */
export function Toggle({
  checked,
  onChange,
  label,
  name,
  disabled,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("inline-flex items-center gap-3", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <span className="relative inline-block h-6 w-11 shrink-0">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-gray-200 transition-colors duration-200 peer-checked:bg-brand-500 dark:bg-white/15 dark:peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400/40" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
      {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>}
    </label>
  );
}
