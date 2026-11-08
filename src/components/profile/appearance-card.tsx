"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light" as const, label: "Light", hint: "Always light", icon: Sun },
  { value: "dark" as const, label: "Dark", hint: "Always dark", icon: Moon },
  { value: "system" as const, label: "System", hint: "Match this device", icon: Monitor },
];

/** Theme choice, saved to the account (see theme-provider.tsx) so it follows the user to a new device. */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader title="Appearance" description="Your theme is saved to your account and follows you to any device you sign in on." />
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
        {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={selected}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                selected
                  ? "border-brand-500 bg-brand-50 ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-navy-800 dark:hover:border-white/20"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  selected ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    selected ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-gray-200"
                  )}
                >
                  {label}
                </span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
