"use client";

import Link from "next/link";
import { Menu, ChevronDown, User, LogOut, UserCircle, ShieldCheck, Building, UsersRound } from "lucide-react";
import type { AccountRole } from "@/lib/permissions";
import { GlobalSearch } from "@/components/nav/global-search";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOut } from "@/app/(app)/actions";

export function Topbar({
  userName,
  companyRole,
  accountRole,
  workspaceName,
  userEmail,
  onMenuClick,
}: {
  userName: string;
  /** Company position — what the header shows under the name. */
  companyRole: string;
  /** Access role — shown inside the dropdown. */
  accountRole: AccountRole;
  workspaceName: string;
  userEmail: string;
  onMenuClick?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 dark:border-white/10 dark:bg-navy-900/90">
      {/* Mobile menu trigger */}
      <button
        onClick={onMenuClick}
        className="cursor-pointer rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 lg:hidden dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Global search */}
      <GlobalSearch />

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ThemeToggle />

        <DropdownMenu
          align="right"
          panelClassName="w-56"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="ml-1 flex cursor-pointer items-center gap-2 rounded-full border border-gray-100 bg-white p-1 pr-3 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="relative shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white">
                  <User className="h-4 w-4" />
                </div>
                <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-navy-900" />
              </div>
              <div className="hidden flex-col items-start text-left sm:flex">
                <span className="text-sm leading-tight font-semibold text-gray-900 dark:text-gray-100">{userName}</span>
                <span className="max-w-[140px] truncate text-[11px] leading-tight font-medium text-gray-500 uppercase dark:text-gray-400">{companyRole}</span>
              </div>
              <ChevronDown
                className={`ml-1 hidden h-4 w-4 text-gray-400 transition-transform duration-200 sm:block ${open ? "rotate-180" : ""}`}
              />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="border-b border-gray-100 p-3 dark:border-white/10">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{userName}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>
                <dl className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Account role</dt>
                    <dd>
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase dark:bg-brand-500/10 dark:text-brand-300">
                        {accountRole === "admin" && <ShieldCheck className="h-3 w-3" />}
                        {accountRole === "admin" ? "Admin" : "User"}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Workspace</dt>
                    <dd className="flex min-w-0 items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                      <Building className="h-3 w-3 shrink-0" />
                      <span className="truncate">{workspaceName}</span>
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="p-1">
                <Link
                  href="/profile"
                  onClick={close}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <UserCircle className="h-4 w-4" />
                  Profile
                </Link>
                {accountRole === "admin" && (
                  <Link
                    href="/user-management"
                    onClick={close}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    <UsersRound className="h-4 w-4" />
                    User Management
                  </Link>
                )}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </DropdownMenu>
      </div>
    </header>
  );
}
