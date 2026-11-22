import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipLayer } from "@/components/ui/tooltip-layer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { themeNoFlashScript } from "@/components/theme/theme-script";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { updateThemePreference } from "@/app/(app)/settings/actions";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import "./dino.css";

export const metadata: Metadata = {
  title: {
    default: "Apex · CRM & Operations Platform",
    template: "%s · Apex",
  },
  description: "Apex unified customer relationship, talent acquisition, project delivery, and financial operations platform.",
  applicationName: "Apex",
  icons: {
    icon: [{ url: "/icon", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Best-effort: null on the login page (no session) or if the query fails —
  // the theme still works from localStorage/system in either case.
  const appUser = await getCurrentAppUser().catch(() => null);
  const accountTheme = appUser?.theme_preference ?? null;

  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional" rel="stylesheet" />
        {/* Sets the `dark` class before first paint so there's no flash of
            the wrong theme while React hydrates — see theme-provider.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript(accountTheme) }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]" suppressHydrationWarning>
        <ThemeProvider initialTheme={accountTheme} onPersist={appUser ? updateThemePreference : undefined}>
          {children}
          <TooltipLayer />
          <Toaster
            position="top-right"
            toastOptions={{
              className: "rounded-xl border border-gray-100 shadow-xl text-sm font-medium dark:border-white/10 dark:bg-navy-800 dark:text-gray-100",
              style: { fontFamily: 'Inter, sans-serif', padding: '16px' }
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
