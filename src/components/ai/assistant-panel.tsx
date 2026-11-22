"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Check, X, TriangleAlert, RotateCcw, Settings2, Sparkles, ArrowUpRight, Zap } from "lucide-react";
import { AiGenerating, AiOrb, AuroraBackdrop, DrawnCheck } from "@/components/ai/ai-visuals";
import { BriefingView } from "@/components/ai/briefing-card";
import { PlacementPicker, useAssistant } from "@/components/ai/assistant-launchers";
import { contextForPath, type AssistantPrompt } from "@/components/ai/page-context";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { executeAssistantAction, generateBriefing, type Briefing } from "@/app/(app)/ai/actions";
import type { Proposal } from "@/lib/ai/proposals";

type ProposalState = "pending" | "running" | "done" | "dismissed" | "failed";
type Entry =
  | { id: string; role: "user" | "assistant"; text: string }
  | { id: string; role: "briefing"; briefing: Briefing }
  | { id: string; role: "proposal"; proposal: Proposal; state: ProposalState; result?: string };

const uid = () => Math.random().toString(36).slice(2);

/** The assistant drawer: live numbers and suggestions for the page you are on, answers from live data, and changes you confirm. */
export function AssistantPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const ctx = contextForPath(pathname);
  const { open, setOpen, userName } = useAssistant();
  const firstName = userName.trim().split(/\s+/)[0] ?? "";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, busy, open]);

  /** Only text turns go to the model; confirmations are fed back as short notes so it knows what happened. */
  function historyFor(list: Entry[]) {
    const out: { role: "user" | "assistant"; content: string }[] = [];
    for (const e of list) {
      if (e.role === "proposal") {
        if (e.state === "done") out.push({ role: "assistant", content: `(Confirmed by the user and saved: ${e.result})` });
        else if (e.state === "dismissed") out.push({ role: "assistant", content: `(The user dismissed the proposal "${e.proposal.title}".)` });
      } else if (e.role === "briefing") {
        out.push({ role: "assistant", content: `(Showed the business briefing. Headline: ${e.briefing.headline})` });
      } else {
        out.push({ role: e.role, content: e.text });
      }
    }
    return out;
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Entry[] = [...entries, { id: uid(), role: "user", text: question }];
    setEntries(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyFor(next), page: ctx.key }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; proposals?: Proposal[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "The assistant couldn't answer.");
      setEntries((cur) => [
        ...cur,
        ...(data.reply ? [{ id: uid(), role: "assistant" as const, text: data.reply }] : []),
        ...(data.proposals ?? []).map((p) => ({ id: p.id, role: "proposal" as const, proposal: p, state: "pending" as const })),
      ]);
    } catch (err) {
      setEntries((cur) => [...cur, { id: uid(), role: "assistant", text: err instanceof Error ? err.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  }

  async function runBriefing() {
    if (busy) return;
    setEntries((cur) => [...cur, { id: uid(), role: "user", text: "Give me a business briefing" }]);
    setBusy(true);
    try {
      const briefing = await generateBriefing();
      setEntries((cur) => [...cur, { id: uid(), role: "briefing", briefing }]);
    } catch (err) {
      setEntries((cur) => [...cur, { id: uid(), role: "assistant", text: err instanceof Error ? err.message : "Couldn't generate the briefing." }]);
    } finally {
      setBusy(false);
    }
  }

  function choose(p: AssistantPrompt) {
    if (p.action === "briefing") return void runBriefing();
    if (p.fill) {
      setInput(p.prompt);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    void send(p.prompt);
  }

  function patch(id: string, change: Partial<Extract<Entry, { role: "proposal" }>>) {
    setEntries((cur) => cur.map((e) => (e.id === id && e.role === "proposal" ? { ...e, ...change } : e)));
  }

  async function confirm(entry: Extract<Entry, { role: "proposal" }>) {
    patch(entry.id, { state: "running" });
    try {
      const result = await executeAssistantAction(entry.proposal.action);
      patch(entry.id, { state: "done", result });
      toast.success(result);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save that.";
      patch(entry.id, { state: "failed", result: message });
      toast.error(message);
    }
  }

  const header = (
    <div className="relative shrink-0 overflow-hidden bg-navy-900 px-5 py-4 text-white">
      <AuroraBackdrop />
      <div className="relative flex items-center gap-3">
        <AiOrb size={42} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold sm:text-lg">ApexCRM Assistant</h2>
          <p className="flex items-center gap-1.5 text-xs text-white/70">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/80" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live · {ctx.label}
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="shrink-0 cursor-pointer rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        position="right"
        size="md"
        title="ApexCRM Assistant"
        header={header}
        footer={
          <div className="space-y-3">
            {showSettings && (
              <div className="ai-rise space-y-1.5">
                <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">Where the AI button lives</p>
                <PlacementPicker compact />
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder={`Ask about ${ctx.key === "general" ? "anything" : ctx.label.toLowerCase()}…`}
                className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/20 dark:bg-navy-900 dark:text-gray-100"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowSettings((v) => !v)} aria-label="Button position" aria-pressed={showSettings} title="Button position">
                <Settings2 className="h-4 w-4" />
              </Button>
              {entries.length > 0 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setEntries([])} disabled={busy} aria-label="New conversation" title="New conversation">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        }
      >
        <div className="flex min-h-full flex-col gap-3">
          {entries.length === 0 && (
            <div className="space-y-5">
              <section>
                <p className="text-xs font-medium text-brand-600 dark:text-brand-300">{firstName ? `Hi ${firstName}` : "Hi"}</p>
                <h3 className="font-display mt-0.5 text-xl leading-snug font-semibold text-gray-900 dark:text-gray-100">{ctx.headline}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{ctx.subline}</p>
              </section>

              <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ctx.prompts.map((p, i) => (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => choose(p)}
                    style={{ animationDelay: `${0.1 + i * 0.07}s` }}
                    className="group ai-rise cursor-pointer rounded-xl border border-gray-200 bg-white p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md dark:border-white/10 dark:bg-navy-900 dark:hover:border-brand-400"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.title}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{p.description}</span>
                  </button>
                ))}
              </section>

              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">Nothing is saved until you confirm it.</p>
            </div>
          )}

          {entries.map((e) => {
            if (e.role === "proposal") {
              return <ProposalCard key={e.id} entry={e} onConfirm={() => void confirm(e)} onDismiss={() => patch(e.id, { state: "dismissed" })} />;
            }
            if (e.role === "briefing") {
              return (
                <div key={e.id} className="ai-rise rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
                  <BriefingView briefing={e.briefing} compact />
                </div>
              );
            }
            if (e.role === "user") {
              return (
                <div key={e.id} className="ai-rise max-w-[88%] self-end rounded-2xl rounded-br-md bg-brand-500 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white shadow-sm">
                  {e.text}
                </div>
              );
            }
            return (
              <div key={e.id} className="ai-rise flex max-w-[95%] gap-2.5 self-start">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-cyan-300 ring-1 ring-white/10">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="rounded-2xl rounded-tl-md border border-gray-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-gray-900 shadow-sm dark:border-white/10 dark:bg-navy-900 dark:text-gray-100">
                  {e.text}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="ai-rise flex justify-center py-4">
              <AiGenerating label="Generating" size={150} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </Dialog>
    </>
  );
}

function ProposalCard({
  entry,
  onConfirm,
  onDismiss,
}: {
  entry: Extract<Entry, { role: "proposal" }>;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { proposal, state, result } = entry;
  const finished = state === "done";
  return (
    <div
      className={cn(
        "ai-pop overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors dark:bg-navy-900",
        finished ? "border-emerald-500/60" : "border-brand-500/40"
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-4 py-3", finished ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-brand-50 dark:bg-brand-500/10")}>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-white", finished ? "bg-emerald-500" : "bg-brand-500")}>
          {finished ? <Check className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">{finished ? "Done" : "Needs your confirmation"}</p>
          <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{proposal.title}</h3>
        </div>
      </div>

      <div className="px-4 py-3">
        <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {proposal.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {proposal.warnings.map((w, i) => (
          <p key={i} className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
          </p>
        ))}

        <div className="mt-3">
          {state === "pending" || state === "running" ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={onConfirm} loading={state === "running"}>
                <Check className="h-3.5 w-3.5" /> Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={onDismiss} disabled={state === "running"}>
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            </div>
          ) : state === "done" ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <DrawnCheck /> {result}
            </p>
          ) : state === "failed" ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{result}</p>
          ) : (
            <p className="text-sm text-gray-400">Dismissed</p>
          )}
        </div>
      </div>
    </div>
  );
}
