"use client";

import { CircleCheck, Eye, TriangleAlert, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Briefing, BriefingInsight } from "@/app/(app)/ai/actions";

const SEVERITY: Record<BriefingInsight["severity"], { icon: typeof Eye; className: string; label: string }> = {
  good: { icon: CircleCheck, className: "text-emerald-600 bg-emerald-50 dark:bg-emerald-400/10 dark:text-emerald-400", label: "Going well" },
  watch: { icon: Eye, className: "text-amber-600 bg-amber-50 dark:bg-amber-400/10 dark:text-amber-400", label: "Keep an eye" },
  risk: { icon: TriangleAlert, className: "text-red-600 bg-red-50 dark:bg-red-400/10 dark:text-red-400", label: "Needs action" },
};

/** The AI business briefing (headline, summary, insights, next steps), shown inside the assistant drawer. */
export function BriefingView({ briefing, compact = false }: { briefing: Briefing; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-300">Business briefing</p>
        <p className="font-display mt-1 text-base leading-snug font-semibold text-gray-900 dark:text-gray-100">{briefing.headline}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{briefing.summary}</p>
      </div>

      <div className={cn("grid gap-2.5", !compact && "md:grid-cols-2")}>
        {briefing.insights.map((insight, i) => {
          const s = SEVERITY[insight.severity];
          const Icon = s.icon;
          return (
            <div key={i} style={{ animationDelay: `${0.1 + i * 0.08}s` }} className="ai-rise flex gap-3 rounded-lg border border-gray-200 p-3 dark:border-white/10">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", s.className, insight.severity === "risk" && "animate-pulse")} title={s.label}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{insight.title}</p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{insight.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {briefing.next_steps.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">Suggested next steps</p>
          <ul className="mt-2 space-y-1.5">
            {briefing.next_steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        AI-generated from live data at {new Date(briefing.generatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}. Check important figures before acting on them.
      </p>
    </div>
  );
}
