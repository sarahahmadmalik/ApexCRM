"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  MapPinned,
  Users,
  FileSignature,
  FileText,
  Receipt,
  UserPlus,
  FolderKanban,
  CalendarClock,
  Wallet,
  LogOut,
  X,
  UsersRound,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "@/components/nav/logo";
import { hasAccess, type PageKey, type Permissions } from "@/lib/permissions";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; page: PageKey };

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "CRM & Outbound",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard, page: "dashboard" },
      { href: "/firms", label: "Firms / Proposals", icon: Building2, page: "firms" },
      { href: "/cities", label: "City Progress", icon: MapPinned, page: "cities" },
      { href: "/offers", label: "Offers", icon: FileText, page: "offers" },
      { href: "/invoices", label: "Invoices", icon: Receipt, page: "invoices" },
    ],
  },
  {
    title: "People & Talent",
    items: [
      { href: "/hiring", label: "Hiring & ATS", icon: UserPlus, page: "hiring" },
      { href: "/employees", label: "Employees", icon: Users, page: "employees" },
      { href: "/contracts", label: "Contracts", icon: FileSignature, page: "contracts" },
      { href: "/time-leave", label: "Time & Leave", icon: CalendarClock, page: "time_leave" },
    ],
  },
  {
    title: "Delivery & Finance",
    items: [
      { href: "/projects", label: "Projects & Tasks", icon: FolderKanban, page: "projects" },
      { href: "/expenses", label: "Expenses & Payroll", icon: Wallet, page: "expenses" },
    ],
  },
];

/** Admin-only; never part of the per-page permissions, so it can't be granted to a member. */
const ADMIN_NAV = [{ href: "/user-management", label: "User Management", icon: UsersRound }];


export function Sidebar({
  permissions,
  isAdmin,
  mobileOpen = false,
  onClose,
  isCompressed = false,
  onToggleCompress,
}: {
  permissions: Permissions;
  isAdmin: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
  isCompressed?: boolean;
  onToggleCompress?: () => void;
}) {
  const pathname = usePathname();
  const [logoHovered, setLogoHovered] = useState(false);
  // Only what this user may open — hiding is cosmetic, the server enforces it too.
  const visibleSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => hasAccess(permissions, item.page)),
  })).filter((sec) => sec.items.length > 0);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col bg-navy-950 transition-all duration-300 ease-in-out lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          isCompressed ? "w-20" : "w-60"
        )}
      >
        <div
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
          className={cn(
            "relative flex h-[72px] items-center border-b border-white/10 px-4",
            isCompressed ? "justify-center" : "justify-between"
          )}
        >
          <div className={cn("flex items-center", isCompressed ? "w-full justify-center" : "justify-start")}>
            <Logo
              dark
              compact={isCompressed}
              className={cn(
                isCompressed ? cn("h-8 w-auto transition-opacity duration-150", logoHovered && "opacity-0") : "h-8 w-auto"
              )}
            />
          </div>

          {/* Expanded: chevron sits beside the logo, always visible.
              Compressed: it overlays the logo and only appears on hover, so
              the icon-rail stays uncluttered until you reach for it. */}
          <button
            onClick={onToggleCompress}
            title={isCompressed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden shrink-0 cursor-pointer items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:flex",
              isCompressed
                ? cn("absolute inset-0 m-auto h-9 w-9 transition-opacity duration-150", logoHovered ? "opacity-100" : "pointer-events-none opacity-0")
                : "p-1.5"
            )}
          >
            {isCompressed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>

          <button
            onClick={onClose}
            className="absolute top-1/2 right-4 flex shrink-0 -translate-y-1/2 rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto pb-3">
          {visibleSections.map((section, sectionIdx) => (
            <div key={section.title}>
              <p
                className={cn(
                  "px-5 pb-2 text-[10px] font-semibold tracking-widest text-white/30 uppercase transition-opacity duration-300",
                  sectionIdx === 0 ? "pt-4" : "pt-5",
                  isCompressed ? "h-0 overflow-hidden p-0 opacity-0" : "opacity-100"
                )}
              >
                {section.title}
              </p>
              <nav className={cn("nav-item-stagger space-y-0.5", isCompressed ? "px-2 pt-2" : "px-3")}>
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={isCompressed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                        isCompressed ? "justify-center px-0" : "px-3",
                        active
                          ? cn("nav-active-bar bg-white/10 text-white", isCompressed && "nav-active-bar-compact")
                          : "text-white/55 hover:bg-white/5 hover:text-white/90"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors duration-150",
                          active ? "text-brand-400" : "text-white/40 group-hover:text-white/70"
                        )}
                      />
                      {!isCompressed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

              {/* Management Section (User Management for admins + Settings for everyone) */}
              <p
                className={cn(
                  "px-5 pt-5 pb-2 text-[10px] font-semibold tracking-widest text-white/30 uppercase transition-opacity duration-300",
                  isCompressed ? "h-0 overflow-hidden p-0 opacity-0" : "opacity-100"
                )}
              >
                Management
              </p>
              <nav className={cn("space-y-0.5", isCompressed ? "px-2 pt-2" : "px-3")}>
                {isAdmin &&
                  ADMIN_NAV.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={isCompressed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                          isCompressed ? "justify-center px-0" : "px-3",
                          active
                            ? cn("nav-active-bar bg-white/10 text-white", isCompressed && "nav-active-bar-compact")
                            : "text-white/55 hover:bg-white/5 hover:text-white/90"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-colors duration-150",
                            active ? "text-brand-400" : "text-white/40 group-hover:text-white/70"
                          )}
                        />
                        {!isCompressed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}

                <Link
                  href="/settings"
                  title={isCompressed ? "Settings" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                    isCompressed ? "justify-center px-0" : "px-3",
                    isActive("/settings")
                      ? cn("nav-active-bar bg-white/10 text-white", isCompressed && "nav-active-bar-compact")
                      : "text-white/55 hover:bg-white/5 hover:text-white/90"
                  )}
                >
                  <Settings
                    className={cn(
                      "h-5 w-5 shrink-0 transition-all duration-300 group-hover:rotate-45",
                      isActive("/settings") ? "text-brand-400" : "text-white/40 group-hover:text-white/70"
                    )}
                  />
                  {!isCompressed && <span className="truncate">Settings</span>}
                </Link>
              </nav>

              <div className="mt-auto border-t border-white/10 p-3">
                <form action={signOut}>
                  <button
                    type="submit"
                    title={isCompressed ? "Sign out" : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300",
                      isCompressed ? "justify-center px-0" : "px-3"
                    )}
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!isCompressed && <span>Sign out</span>}
                  </button>
                </form>
              </div>
        </div>
      </aside>
    </>
  );
}
