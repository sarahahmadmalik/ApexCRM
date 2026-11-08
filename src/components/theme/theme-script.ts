// Plain module (no "use client") so `themeNoFlashScript` can be called from
// a Server Component (the root layout) to build the inline script's markup.
// theme-provider.tsx imports STORAGE_KEY from here so both stay in sync.

export type Theme = "light" | "dark" | "system";

export const STORAGE_KEY = "dua-dev-theme";

/**
 * Inline, blocking script (goes in <head>) that sets the `dark` class before
 * first paint, so there's no flash of the wrong theme while React hydrates.
 * `accountTheme` (the DB value for a signed-in user, or null) is the
 * fallback when this device has no locally stored choice yet.
 */
export function themeNoFlashScript(accountTheme: Theme | null = null) {
  return `
(function() {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored || ${JSON.stringify(accountTheme)} || "system";
    var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;
}
