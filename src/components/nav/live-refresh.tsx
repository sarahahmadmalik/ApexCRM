"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Tables whose changes should refresh whatever page is open. */
const TABLES = [
  "firms",
  "city_completion",
  "angebots",
  "invoices",
  "employees",
  "contracts",
  "firm_status_history",
  "dashboard_daily_snapshot",
];

/**
 * Keeps every page live. Subscribes to Supabase Realtime for the data tables and re-renders the
 * current page's server data whenever a row changes (soft refresh: open drawers, filters and typed
 * text stay as they are). As a safety net for dropped connections it also refreshes once a minute
 * while the tab is visible, and immediately when you come back to the tab.
 *
 * Realtime only sends rows the signed-in user may read, and needs the tables in the
 * `supabase_realtime` publication (migration 0011 / schema.sql).
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Many rows can change at once (an import); wait for the burst to finish, then refresh once.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 800);
    };

    const channel = supabase.channel("live-data");
    for (const table of TABLES) channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    channel.subscribe();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
