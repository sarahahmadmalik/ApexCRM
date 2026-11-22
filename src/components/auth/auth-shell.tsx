import { CheckCircle2, Globe2, Sparkles, Timer } from "lucide-react";
import { Logo } from "@/components/nav/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Shared frame for the signed-out pages (login, reset password): a cinematic,
 * glassmorphic product visual on large screens beside the sign-in panel.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      {/* Cinematic Product Showcase Panel */}
      <aside className="relative hidden overflow-hidden bg-navy-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        {/* Ambient Aurora & Perspective Grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(55% 45% at 25% 20%, rgba(6,182,212,0.24), transparent 70%), radial-gradient(50% 45% at 80% 75%, rgba(99,102,241,0.18), transparent 70%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "auto, auto, 44px 44px, 44px 44px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl"
        />

        {/* Top Brand Mark */}
        <div className="relative z-10 flex items-center justify-between">
          <Logo dark className="h-9 w-auto" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-brand-300 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-brand-400" />
            Live Enterprise OS
          </span>
        </div>

        {/* Center: Layered Glassmorphic Product Canvas */}
        <div className="relative z-10 my-auto py-6">
          <div className="relative mx-auto max-w-lg">
            {/* Floating Top-Right ATS Offer Card */}
            <div className="absolute -top-6 -right-4 z-20 flex items-center gap-3 rounded-2xl border border-white/15 bg-navy-900/85 px-4 py-3 shadow-2xl backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/30">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Candidate Hired</span>
                  <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                    ATS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Elena Rostova · Staff Engineer</p>
              </div>
            </div>

            {/* Main Glass Dashboard Preview Frame */}
            <div className="overflow-hidden rounded-3xl border border-white/12 bg-white/[0.04] p-5 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
              {/* Window Chrome */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  <span className="font-mono-brand ml-2 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                    apex.io/command
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                  EU-27 Active
                </span>
              </div>

              {/* Revenue & Outreach Velocity Chart */}
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Pipeline &amp; Delivery Velocity
                    </p>
                    <p className="font-display mt-0.5 text-2xl font-bold text-white">428.500 €</p>
                  </div>
                  <span className="rounded-full bg-brand-500/20 px-2.5 py-0.5 text-xs font-bold text-brand-300 ring-1 ring-brand-400/30">
                    +34.8% QoQ
                  </span>
                </div>

                {/* Glowing SVG Curve */}
                <div className="mt-3 h-32 w-full">
                  <svg viewBox="0 0 360 110" className="h-full w-full overflow-visible" fill="none">
                    <defs>
                      <linearGradient id="auth-chart-fill" x1="0" y1="0" x2="0" y2="110" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.42" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="25" x2="360" y2="25" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <line x1="0" y1="55" x2="360" y2="55" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <line x1="0" y1="85" x2="360" y2="85" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <path
                      d="M0 88 C45 84, 65 64, 105 66 C145 68, 175 40, 215 44 C255 48, 285 20, 325 16 L360 10 L360 105 L0 105 Z"
                      fill="url(#auth-chart-fill)"
                    />
                    <path
                      d="M0 88 C45 84, 65 64, 105 66 C145 68, 175 40, 215 44 C255 48, 285 20, 325 16 L360 10"
                      stroke="#22d3ee"
                      strokeWidth="2.75"
                      strokeLinecap="round"
                    />
                    <circle cx="105" cy="66" r="3.5" fill="#0b132b" stroke="#22d3ee" strokeWidth="2.5" />
                    <circle cx="215" cy="44" r="3.5" fill="#0b132b" stroke="#22d3ee" strokeWidth="2.5" />
                    <circle cx="325" cy="16" r="4.5" fill="#22d3ee" />
                  </svg>
                </div>
              </div>

              {/* 3 Mini Glass Metric Tiles */}
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <span className="text-[10px] text-slate-400">Firms Tracked</span>
                  <p className="font-mono-brand mt-0.5 text-sm font-bold text-white">1.859</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <span className="text-[10px] text-slate-400">Active Cities</span>
                  <p className="font-mono-brand mt-0.5 text-sm font-bold text-brand-300">142 EU</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <span className="text-[10px] text-slate-400">Sprint Delivery</span>
                  <p className="font-mono-brand mt-0.5 text-sm font-bold text-emerald-400">98.4%</p>
                </div>
              </div>
            </div>

            {/* Floating Bottom-Left Live Work Timer & Geo Pill */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-navy-900/85 px-3.5 py-2.5 shadow-xl backdrop-blur-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
                  <Timer className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-mono-brand text-xs font-bold text-white">03:42:18 · Clocked In</p>
                  <p className="text-[10px] text-slate-400">Nordic ERP Modernization</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-navy-900/85 px-3.5 py-2.5 shadow-xl backdrop-blur-xl">
                <Globe2 className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-medium text-slate-300">DACH · Nordics · Benelux</span>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <span>Pipeline, talent &amp; delivery — in motion.</span>
          <span>&copy; {new Date().getFullYear()} Apex CRM</span>
        </div>
      </aside>

      {/* Form Panel */}
      <main className="relative flex min-h-dvh flex-col bg-white lg:min-h-0 dark:bg-navy-900">
        <div className="flex items-center justify-between px-6 pt-6 sm:px-10">
          <div className="lg:invisible">
            <Logo className="h-8 w-auto dark:hidden" />
            <Logo dark className="hidden h-8 w-auto dark:block" />
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
