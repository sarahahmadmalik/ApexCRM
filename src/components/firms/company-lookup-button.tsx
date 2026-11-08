"use client";

import { useState } from "react";
import { Building2, Loader2, RotateCcw, Search, TriangleAlert } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { lookupCompany, type CompanyLookupResult } from "@/app/(app)/firms/actions";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; query: string; results: CompanyLookupResult[] };

const LOOKUP_TIMEOUT_MS = 6000;

/**
 * "Look up online" — searches the typed firm name against Clearbit's free,
 * keyless company autocomplete API and lets the user pick a match to fill in
 * the name (corrected spelling/casing) and website. That free API only
 * knows a company's name, domain and logo — no street address, phone number
 * or contact person, since no free service provides those without a paid
 * key — so this can't fill in the rest of the form.
 *
 * The request is always bounded on the client too (not just the server
 * action's own timeout), and every outcome — including "too short a query"
 * and "the service didn't respond" — is shown right in the panel, so the
 * button can never look like it's silently stuck loading.
 */
export function CompanyLookupButton({
  getQuery,
  onSelect,
}: {
  getQuery: () => string;
  onSelect: (result: CompanyLookupResult) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function runLookup() {
    const q = getQuery().trim();
    if (q.length < 2) {
      setState({ kind: "error", message: "Type at least two letters of the firm name first." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("The lookup service didn't respond in time.")), LOOKUP_TIMEOUT_MS)
      );
      const results = await Promise.race([lookupCompany(q), timeout]);
      setState({ kind: "done", query: q, results });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Company lookup failed. Fill in the details by hand.",
      });
    }
  }

  return (
    <DropdownMenu
      portal
      align="right"
      panelClassName="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={() => {
            const opening = !open;
            toggle();
            if (opening) runLookup();
          }}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold normal-case text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
        >
          {state.kind === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          Look up online
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto p-1">
          {state.kind === "loading" && (
            <div className="flex items-center gap-2 px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Searching online...
            </div>
          )}

          {state.kind === "error" && (
            <div className="px-2 py-2.5">
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{state.message}</span>
              </div>
              <button
                type="button"
                onClick={runLookup}
                className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                <RotateCcw className="h-3 w-3" />
                Try again
              </button>
            </div>
          )}

          {state.kind === "done" && (
            <>
              <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                {state.results.length > 0 ? `Matches for "${state.query}"` : `No matches for "${state.query}"`}
              </p>
              {state.results.length === 0 && (
                <p className="px-2 pt-1 pb-2.5 text-xs text-gray-500 dark:text-gray-400">
                  Nothing found online. Fill in the details by hand.
                </p>
              )}
              {state.results.map((r) => (
                <button
                  key={r.domain}
                  type="button"
                  onClick={() => {
                    onSelect(r);
                    close();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  {r.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external favicon from Clearbit's logo CDN, not a local/optimizable asset
                    <img
                      src={r.logo}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-md bg-white object-contain ring-1 ring-gray-100 dark:ring-white/10"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-500">
                      <Building2 className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{r.domain}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </DropdownMenu>
  );
}
