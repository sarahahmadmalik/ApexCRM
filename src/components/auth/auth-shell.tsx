import { Building2, FileText, MapPin } from "lucide-react";
import { Logo } from "@/components/nav/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const HIGHLIGHTS = [
  { icon: Building2, title: "CRM, proposals & projects", text: "Manage client pipelines, quotes, invoices, and active project delivery." },
  { icon: MapPin, title: "Hiring, HR & time tracking", text: "Full applicant tracking (ATS), contracts, PTO approvals, and timesheets." },
  { icon: FileText, title: "Expenses, payroll & analytics", text: "Unified company finance, expense claims, payroll runs, and regional maps." },
];

/**
 * Shared frame for the signed-out pages (login, reset password): a navy brand
 * panel on large screens beside a form panel that follows the light/dark theme.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Brand panel — always navy, like the app sidebar */}
      <aside className="relative hidden overflow-hidden bg-navy-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 15% 0%, rgba(6,182,212,0.18), transparent 70%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "auto, 48px 48px, 48px 48px",
            maskImage: "linear-gradient(to bottom, black 55%, transparent)",
          }}
        />

        <div className="relative flex flex-col items-start gap-1.5">
          <Logo dark className="h-16 w-auto xl:h-20" />
          <span className="font-mono-brand text-[10px] font-semibold tracking-widest text-brand-400/70 uppercase">
            Enterprise CRM &amp; Operations Suite
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl leading-tight font-bold text-white xl:text-[2.75rem]">
            CRM, Talent &amp; Operations, <span className="text-brand-400">in one place.</span>
          </h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-brand-400/20">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="mt-0.5 block text-sm text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">&copy; {new Date().getFullYear()} ApexCRM · Enterprise Operations Showcase.</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex min-h-dvh flex-col bg-white lg:min-h-0 dark:bg-navy-900">
        <div className="flex items-center justify-between px-6 pt-6 sm:px-10">
          {/* Logo shows here only when the brand panel is hidden */}
          <div className="lg:invisible">
            <Logo className="h-12 w-auto dark:hidden" />
            <Logo dark className="hidden h-12 w-auto dark:block" />
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="animate-fade-in w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
