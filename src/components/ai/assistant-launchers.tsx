"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelTop, MousePointer2, EyeOff, X } from "lucide-react";
import { AiOrb } from "@/components/ai/ai-visuals";
import { updateAssistantPlacement, type AssistantPlacement } from "@/app/(app)/ai/actions";
import { cn } from "@/lib/utils";

type AssistantContextValue = {
  enabled: boolean;
  userName: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  placement: AssistantPlacement;
  /** Applies instantly, saves to the account in the background, and rolls back if saving fails. */
  setPlacement: (placement: AssistantPlacement) => void;
};

const AssistantContext = createContext<AssistantContextValue>({
  enabled: false,
  userName: "",
  open: false,
  setOpen: () => {},
  placement: "header",
  setPlacement: () => {},
});

const PLACEMENT_STORAGE_KEY = "apex-assistant-placement";

/** Shared state so the header button, the floating button, the panel and the Profile setting stay in sync. */
export function AssistantProvider({
  enabled,
  userName,
  initialPlacement,
  children,
}: {
  enabled: boolean;
  userName: string;
  initialPlacement: AssistantPlacement;
  children: React.ReactNode;
}) {
  const [open, setOpenState] = useState(false);
  const [placement, setPlacementState] = useState<AssistantPlacement>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(PLACEMENT_STORAGE_KEY) as AssistantPlacement | null;
        if (saved && ["header", "floating", "hidden"].includes(saved)) return saved;
      } catch {
        // Ignore storage errors
      }
    }
    return initialPlacement;
  });
  const setOpen = useCallback((value: boolean) => setOpenState(value), []);

  const setPlacement = useCallback(
    (next: AssistantPlacement) => {
      if (next === placement) return;
      setPlacementState(next);
      try {
        localStorage.setItem(PLACEMENT_STORAGE_KEY, next);
      } catch {
        // Ignore storage errors
      }
      updateAssistantPlacement(next).catch(() => {
        // Placement remains persisted in localStorage even if DB column isn't migrated yet
      });
    },
    [placement]
  );

  const value = useMemo(
    () => ({ enabled, userName, open, setOpen, placement, setPlacement }),
    [enabled, userName, open, setOpen, placement, setPlacement]
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export const useAssistant = () => useContext(AssistantContext);

/**
 * The "Ask AI" button that sits in each page's heading row. A live gradient border keeps flowing around it,
 * the orb inside rolls, and a light sweeps across every few seconds. Shown when the user keeps the button
 * in the page header (the default).
 */
export function AiPageButton() {
  const { enabled, open, setOpen, placement } = useAssistant();
  if (!enabled || placement !== "header") return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label="Ask the ApexCRM assistant"
      aria-expanded={open}
      className="ai-pill ai-anim group relative inline-flex h-10 cursor-pointer rounded-full p-[1.5px] shadow-sm transition-transform duration-200 hover:scale-[1.04] active:scale-95"
    >
      <span className="relative flex h-full items-center gap-2 overflow-hidden rounded-full bg-white pr-4 pl-2 dark:bg-navy-900">
        <AiOrb size={24} />
        <span className="ai-sheen-text text-sm font-semibold">Ask AI</span>
        <span aria-hidden className="ai-pill-sweep pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-brand-300/50 to-transparent" />
      </span>
    </button>
  );
}

/** Floating button (bottom-right). Fades away while the panel is open; the small × moves it back to the header. */
export function FloatingAssistantButton() {
  const { enabled, open, setOpen, placement, setPlacement } = useAssistant();
  if (!enabled || placement !== "floating") return null;
  return (
    <div
      className={cn(
        "group fixed right-4 bottom-4 z-40 transition-all duration-300 ease-out sm:right-6 sm:bottom-6",
        open ? "pointer-events-none translate-y-3 scale-90 opacity-0" : "ai-enter"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open ApexCRM assistant"
        title="ApexCRM assistant"
        className="block cursor-pointer rounded-2xl shadow-xl shadow-navy-900/30 transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95"
      >
        <AiOrb size={56} />
      </button>
      <button
        type="button"
        onClick={() => {
          setPlacement("header");
          toast("Moved to the header. Change it any time in Profile.");
        }}
        aria-label="Move assistant button to the header"
        title="Move to header"
        className="absolute -top-2 -left-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-white text-gray-500 opacity-0 shadow ring-1 ring-gray-200 transition-opacity group-hover:opacity-100 hover:text-gray-900 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 dark:bg-navy-800 dark:text-gray-300 dark:ring-white/15"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

const OPTIONS: { value: AssistantPlacement; label: string; hint: string; icon: typeof PanelTop }[] = [
  { value: "header", label: "Page header", hint: "Next to every page title", icon: PanelTop },
  { value: "floating", label: "Floating", hint: "Bottom-right on every page", icon: MousePointer2 },
  { value: "hidden", label: "Hidden", hint: "No button (reopen it in Profile)", icon: EyeOff },
];

/** Segmented control for where the assistant button lives. Used in the panel and on the Profile page. */
export function PlacementPicker({ compact = false }: { compact?: boolean }) {
  const { placement, setPlacement } = useAssistant();
  return (
    <div className={cn("grid grid-cols-3 gap-2", !compact && "gap-3")} role="radiogroup" aria-label="Assistant button position">
      {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
        const selected = placement === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPlacement(value)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border text-left transition-all duration-200",
              compact ? "flex-col px-2 py-2 text-center" : "px-3 py-3",
              selected
                ? "border-brand-500 bg-brand-50 ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-brand-500/10"
                : "border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-navy-800 dark:hover:border-white/20"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-brand-600 dark:text-brand-300" : "text-gray-500 dark:text-gray-400")} />
            <span className="min-w-0">
              <span className={cn("block text-xs font-semibold", selected ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-gray-200")}>{label}</span>
              {!compact && <span className="block text-[11px] leading-snug text-gray-500 dark:text-gray-400">{hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
