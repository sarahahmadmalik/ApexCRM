import { cn } from "@/lib/utils";

/**
 * The assistant's visuals. Pure CSS (see the "AI visuals" block in globals.css): no animation files.
 *
 * `AiOrb` is a glowing sphere whose light rolls around inside it. Without a label it is the assistant's
 * button icon; with one (`AiGenerating`) the letters ripple across it while the AI is working.
 */
export function AiOrb({
  size = 40,
  label,
  className,
}: {
  size?: number;
  /** Letters that ripple over the sphere, e.g. "Generating". */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("ai-orb ai-anim", className)}
      style={{ width: size, height: size, ["--u" as string]: size / 180, fontSize: size * 0.105 }}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label &&
        Array.from(label).map((ch, i) => (
          <span key={i} className="ai-orb-letter" style={{ animationDelay: `${i * 0.1}s` }} aria-hidden>
            {ch}
          </span>
        ))}
      <span className="ai-orb-core" />
    </span>
  );
}

/** The "working on it" state: clean chat-style typing indicator. */
export function AiGenerating({ label = "Thinking", className }: { label?: string; size?: number; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 text-sm text-gray-500 dark:text-gray-400", className)} role="status" aria-label={label}>
      <TypingDots />
      <span className="text-xs font-medium">{label}…</span>
    </div>
  );
}

/** Slow, drifting colour fields behind the assistant's welcome card. */
export function AuroraBackdrop({ className }: { className?: string }) {
  return (
    <span className={cn("ai-anim pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <span className="ai-aurora ai-aurora-a" />
      <span className="ai-aurora ai-aurora-b" />
      <span className="ai-aurora ai-aurora-c" />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,.09)_1px,transparent_0)] [background-size:18px_18px]" />
    </span>
  );
}

/** Three bouncing dots. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("ai-anim inline-flex items-end gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-brand-500" style={{ animation: `ai-dot 1.1s ease-in-out ${i * 0.16}s infinite` }} />
      ))}
    </span>
  );
}

/** Animated tick that draws itself. */
export function DrawnCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("ai-anim h-5 w-5", className)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" opacity=".25" />
      <path d="M7 12.5l3.2 3.2L17 8.8" strokeDasharray="30" style={{ animation: "ai-draw .5s ease-out .1s both" }} />
    </svg>
  );
}

/** A line that cycles through a few phrases, fading between them. */
export function WordCycler({ words, className }: { words: string[]; className?: string }) {
  const total = words.length * 2.4;
  return (
    <span className={cn("relative inline-block h-[1.25em] min-w-[7ch] align-bottom", className)}>
      {words.map((w, i) => (
        <span
          key={w}
          className="ai-word absolute inset-0 whitespace-nowrap"
          style={{ animationDuration: `${total}s`, animationDelay: `${i * 2.4}s` }}
        >
          {w}
        </span>
      ))}
    </span>
  );
}
