"use client";

import { Sun, Moon, Monitor, Check } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const CurrentIcon = isDark ? Moon : Sun;

  return (
    <DropdownMenu
      align="right"
      panelClassName="w-40 p-1"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="Change theme"
          className={cn(
            "cursor-pointer rounded-lg p-2 transition-colors",
            isDark
              ? "text-slate-300 hover:bg-white/10 hover:text-slate-100"
              : "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
          )}
        >
          <CurrentIcon className="h-4.5 w-4.5" />
        </button>
      )}
    >
      {(close) =>
        OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              close();
              setTheme(value);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              theme === value
                ? "font-semibold text-brand-700 dark:text-brand-400"
                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                value === "light" && "text-amber-500",
                value === "dark" && "text-slate-400"
              )}
            />
            <span className="flex-1 text-left">{label}</span>
            {theme === value && <Check className="h-3.5 w-3.5" />}
          </button>
        ))
      }
    </DropdownMenu>
  );
}
