"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { STORAGE_KEY, type Theme } from "@/components/theme/theme-script";

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
} | null>(null);

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Follow the OS when the user is on "system", and pick up changes made in
  // another tab.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && onChange();
  mq.addEventListener("change", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    mq.removeEventListener("change", onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
  } catch {
    return "system";
  }
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Snapshot is a single string ("system:dark") so it stays referentially stable. */
function getSnapshot() {
  const theme = readTheme();
  return `${theme}:${resolve(theme)}`;
}

function getServerSnapshot() {
  return "system:light";
}

/**
 * Exposes light/dark/system to the app. The class is applied before paint by
 * the inline script in the root layout; this provider mirrors that state into
 * React (via an external store, so there's no setState-on-mount cascade) and
 * writes changes back to localStorage, plus (best-effort, fire-and-forget) to
 * the signed-in user's account via `onPersist`, so the choice follows them to
 * a new browser or device.
 */
export function ThemeProvider({
  children,
  initialTheme,
  onPersist,
}: {
  children: React.ReactNode;
  /** The account's saved preference, from the server — seeds localStorage on
   * a device that has never stored a choice locally. */
  initialTheme?: Theme | null;
  onPersist?: (theme: Theme) => void;
}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [theme, resolvedTheme] = snapshot.split(":") as [Theme, "light" | "dark"];

  // Seed an empty localStorage from the account's saved preference once, on
  // mount — covers "signed in on a new device" without waiting for a click.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !initialTheme) return;
    seeded.current = true;
    let hasStored = true;
    try {
      hasStored = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      hasStored = false;
    }
    if (!hasStored) {
      try {
        localStorage.setItem(STORAGE_KEY, initialTheme);
      } catch {
        // Private mode / storage disabled — falls back to "system" each load.
      }
      document.documentElement.classList.toggle("dark", resolve(initialTheme) === "dark");
      notify();
    }
  }, [initialTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode / storage disabled — the toggle still works for this page.
      }
      document.documentElement.classList.toggle("dark", resolve(next) === "dark");
      notify();
      onPersist?.(next);
    },
    [onPersist]
  );

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
