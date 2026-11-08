"use client";

import { AiPageButton } from "@/components/ai/assistant-launchers";

/** The one page title/subtitle block, used at the top of every page. The "Ask AI" button sits at the far end of the title line. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display min-w-0 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
          {title}
        </h1>
        <AiPageButton />
      </div>
      {(description || actions) && (
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          {description && <p className="max-w-2xl text-sm text-gray-500 sm:text-base dark:text-gray-400">{description}</p>}
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3 lg:ml-auto">{actions}</div>}
        </div>
      )}
    </div>
  );
}
