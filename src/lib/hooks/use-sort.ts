"use client";

import { useMemo, useState } from "react";
import type { SortDirection } from "@/components/ui/table-shell";

/**
 * Client-side column sorting for tables that already hold their full row set
 * in memory (everything paginated in JS, not via a server query). Clicking a
 * column cycles ascending -> descending -> unsorted (back to the original
 * row order); clicking a different column starts that one at ascending.
 */
export function useSort<T>(rows: T[], getValue: (row: T, key: string) => string | number | null | undefined) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  function onSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    // Third click on the same column: clear back to unsorted.
    setSortBy(null);
    setSortDir("asc");
  }

  const sorted = useMemo(() => {
    if (!sortBy) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getValue(a, sortBy);
      const bv = getValue(b, sortBy);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true }) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortBy, sortDir]);

  return { sorted, sortBy, sortDir, onSort };
}
