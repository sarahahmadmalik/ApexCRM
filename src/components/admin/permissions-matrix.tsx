"use client";

import { PAGES, ACCESS_LEVELS, ACCESS_LABELS, fullPermissions, noPermissions, readOnlyPermissions } from "@/lib/permissions";
import type { AccessLevel, PageKey, Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const PRESETS: { label: string; build: () => Permissions }[] = [
  { label: "No access", build: noPermissions },
  { label: "Read only", build: readOnlyPermissions },
  { label: "Full access", build: fullPermissions },
];

const LEVEL_TINT: Record<AccessLevel, string> = {
  none: "bg-white text-gray-700 shadow-sm dark:bg-white/15 dark:text-gray-100",
  read: "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-400/15 dark:text-blue-300",
  write: "bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-400/15 dark:text-emerald-300",
};

/**
 * One row per page with a No access / Read only / Read & write switch. The
 * User Management area is intentionally absent: it can't be granted to anyone.
 */
export function PermissionsMatrix({
  value,
  onChange,
  disabled,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
  disabled?: boolean;
}) {
  function set(page: PageKey, level: AccessLevel) {
    onChange({ ...value, [page]: level });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Quick set:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset.build())}
            className="cursor-pointer rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-gray-300 dark:hover:border-brand-400 dark:hover:text-brand-300"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-white/10 dark:border-white/10">
        {PAGES.map((page) => (
          <li key={page.key} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{page.label}</span>
            <div
              role="radiogroup"
              aria-label={`Access to ${page.label}`}
              className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5"
            >
              {ACCESS_LEVELS.map((level) => {
                const selected = value[page.key] === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => set(page.key, level)}
                    className={cn(
                      "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
                      selected ? LEVEL_TINT[level] : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    )}
                  >
                    {ACCESS_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        The User Management page is only ever available to the workspace admin and can&apos;t be assigned to members. Profile is
        always available to everyone.
      </p>
    </div>
  );
}
