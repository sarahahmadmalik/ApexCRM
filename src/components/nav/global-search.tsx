"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Users, MapPinned, FileSpreadsheet, Receipt, FileSignature, Loader2 } from "lucide-react";
import { globalSearch, type GlobalSearchResult } from "@/app/(app)/actions";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  firm: Building2,
  employee: Users,
  city: MapPinned,
  offer: FileSpreadsheet,
  invoice: Receipt,
  contract: FileSignature,
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSearchable = query.trim().length >= 2;

  useEffect(() => {
    if (!isSearchable) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      globalSearch(query).then((r) => {
        if (cancelled) return;
        setResults(r);
        setLoading(false);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, isSearchable]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-sm md:block">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search firms, offers, invoices, employees..."
        className="h-9 pl-9"
      />

      {open && isSearchable && (
        <div className="dropdown-menu-pop absolute top-full left-0 z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-navy-800">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400 dark:text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">No matches for &ldquo;{query}&rdquo;</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => {
                const Icon = TYPE_ICON[r.type];
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      onClick={() => go(r.href)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-900 dark:text-gray-100">{r.title}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{r.subtitle}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
