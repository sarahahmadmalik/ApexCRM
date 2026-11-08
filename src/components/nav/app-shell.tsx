"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";
import { LiveRefresh } from "@/components/nav/live-refresh";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import { AssistantProvider, FloatingAssistantButton } from "@/components/ai/assistant-launchers";
import type { AssistantPlacement } from "@/app/(app)/ai/actions";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { ViewOnlyNotice } from "@/components/ui/view-only-notice";
import { PAGES, hasAccess, pageForPath, type AccountRole, type Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Sidebar/topbar chrome around every page. Deliberately NOT remounted on
 * navigation (an earlier version keyed this whole tree on `pathname`, which
 * tore down and rebuilt the sidebar and topbar — including their entrance
 * animations — on every single click, reading as the whole app "reloading").
 * Only the mobile drawer closes on navigation; everything else persists.
 */
export function AppShell({
  userName,
  companyRole,
  accountRole,
  workspaceName,
  permissions,
  userEmail,
  aiEnabled = false,
  assistantPlacement = "header",
  children,
}: {
  userName: string;
  /** Company position shown under the name in the header (e.g. "CTO"). */
  companyRole: string;
  /** Access role shown in the profile dropdown. */
  accountRole: AccountRole;
  workspaceName: string;
  permissions: Permissions;
  userEmail: string;
  /** True when OPENROUTER_KEY is configured: shows the floating AI assistant. */
  aiEnabled?: boolean;
  /** Where this user keeps the assistant button (saved on their account). */
  assistantPlacement?: AssistantPlacement;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // A page this user can open but not change (the dashboard has nothing to edit, so no notice there).
  const currentPage = pageForPath(pathname);
  const viewOnlyLabel =
    currentPage && currentPage !== "dashboard" && !hasAccess(permissions, currentPage, "write")
      ? PAGES.find((p) => p.key === currentPage)?.label
      : undefined;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCompressed, setIsCompressed] = useState(false);

  // Close the mobile drawer on navigation. Adjusted during render (React's
  // documented pattern for state that depends on a changed value, using
  // state rather than a ref so it stays compatible with the compiler) so it
  // lands on the same commit as the route change instead of one render later.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  return (
    <PermissionsProvider permissions={permissions}>
    <AssistantProvider enabled={aiEnabled} userName={userName} initialPlacement={assistantPlacement}>
    <LiveRefresh />
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar
        permissions={permissions}
        isAdmin={accountRole === "admin"}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isCompressed={isCompressed}
        onToggleCompress={() => setIsCompressed(!isCompressed)}
      />

      <div className={cn("flex min-h-screen flex-col transition-all duration-300 ease-in-out", isCompressed ? "lg:pl-20" : "lg:pl-60")}>
        <Suspense fallback={
          <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 dark:border-white/10 dark:bg-navy-900/90" />
        }>
          <Topbar
            userName={userName}
            companyRole={companyRole}
            accountRole={accountRole}
            workspaceName={workspaceName}
            userEmail={userEmail}
            onMenuClick={() => setMobileOpen(true)}
          />
        </Suspense>
        <main className="flex-1 overflow-y-auto">
          {/* No max-width/centering: pages run the full width of the shell.
              Note: no `transform`-based animation on this wrapper — an
              animated transform here would make it the containing block for
              `position: fixed`, trapping modals/drawers inside the content
              area instead of covering the viewport. */}
          <div className="px-4 py-6 sm:px-6 sm:py-8">
            {viewOnlyLabel && <ViewOnlyNotice pageLabel={viewOnlyLabel} />}
            {children}
          </div>
        </main>
      </div>
    </div>
    {aiEnabled && <AssistantPanel />}
    <FloatingAssistantButton />
    </AssistantProvider>
    </PermissionsProvider>
  );
}
