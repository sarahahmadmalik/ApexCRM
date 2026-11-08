"use client";

import { useState } from "react";
import { Bot, Briefcase, Lock, Palette, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { account: UserRound, employment: Briefcase, appearance: Palette, assistant: Bot, security: Lock } as const;

export type SettingsTab = {
  id: keyof typeof ICONS;
  label: string;
  /** Server-rendered content of the tab. Only the selected tab is shown. */
  content: React.ReactNode;
};

/** Settings, one tab at a time. The chosen tab is kept in the URL (?tab=) so a refresh or shared link opens the same one. */
export function SettingsTabs({ tabs, initialTab }: { tabs: SettingsTab[]; initialTab?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initialTab) ? (initialTab as string) : tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  function select(id: string) {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div role="tablist" aria-label="Settings" className="no-scrollbar -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 sm:mx-0 sm:px-0 dark:border-white/10">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.id];
          const selected = tab.id === current.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.id}`}
              onClick={() => select(tab.id)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                selected ? "text-brand-600 dark:text-brand-300" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span
                className={cn(
                  "absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-500 transition-all duration-300",
                  selected ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                )}
              />
            </button>
          );
        })}
      </div>

      <div key={current.id} id={`settings-panel-${current.id}`} role="tabpanel" aria-labelledby={`settings-tab-${current.id}`} className="ai-rise space-y-6">
        {current.content}
      </div>
    </div>
  );
}
