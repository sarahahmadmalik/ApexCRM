import type { StatTrend } from "@/components/ui/card";

/** How far back a snapshot has to be to count as "the 30-day baseline" — a
 * few days of slack so a slightly-delayed cron run still qualifies. */
const BASELINE_MIN_AGE_DAYS = 25;

/** Below this many at the start, or above this % change, show the absolute change instead of a percentage. */
const MIN_BASELINE_FOR_PERCENT = 20;
const MAX_PERCENT_SHOWN = 500;

/**
 * Trend vs. a snapshot ~30 days back, from `dashboard_daily_snapshot`.
 * Returns null when there isn't a snapshot old enough yet — a fresh
 * install has no 30-day history, so no trend is shown rather than a
 * misleading one computed against yesterday.
 */
export function buildTrend(current: number, baseline: number | null, days = 30): StatTrend {
  if (baseline == null) return null;
  const ago = days === 1 ? "yesterday" : `${days} days ago`;
  const delta = current - baseline;
  if (delta === 0) return { direction: "flat", label: `No change vs ${ago}` };
  const direction = delta > 0 ? "up" : "down";
  const sign = delta > 0 ? "+" : "−";
  const pct = baseline > 0 ? (Math.abs(delta) / baseline) * 100 : Infinity;
  // A percentage only says something when it's measured against a meaningful base. From a tiny baseline
  // (a project's first few days) or with a huge jump it reads like "+5325%", so show the plain change instead.
  if (baseline >= MIN_BASELINE_FOR_PERCENT && pct < MAX_PERCENT_SHOWN) {
    return { direction, label: `${sign}${Math.round(pct * 10) / 10}% vs ${ago}` };
  }
  return { direction, label: `${sign}${Math.abs(delta).toLocaleString("en-US")} vs ${ago}` };
}

/** Picks the snapshot row that best represents "~30 days ago" for a trend baseline. */
export function pickBaselineSnapshot<T extends { snapshot_date: string }>(
  rows: T[],
  today = new Date()
): T | null {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - BASELINE_MIN_AGE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  // Rows are assumed ascending by date — the last one still <= cutoff is the
  // closest-to-30-days-ago row we have.
  const eligible = rows.filter((r) => r.snapshot_date <= cutoffStr);
  return eligible.length > 0 ? eligible[eligible.length - 1] : null;
}

/**
 * The row to compare against, and how many days back it is. Prefers a snapshot ~30 days old;
 * until the history is that long it falls back to the oldest snapshot that is at least a day
 * old, so the trend appears after the first day instead of after a month.
 */
export function pickTrendBaseline<T extends { snapshot_date: string }>(
  rows: T[],
  today = new Date()
): { row: T; days: number } | null {
  const monthAgo = pickBaselineSnapshot(rows, today);
  const todayStr = today.toISOString().slice(0, 10);
  const row = monthAgo ?? rows.find((r) => r.snapshot_date < todayStr) ?? null;
  if (!row) return null;
  const days = Math.max(1, Math.round((Date.parse(todayStr) - Date.parse(row.snapshot_date)) / 86_400_000));
  return { row, days };
}

/** SVG path data for a small trend sparkline (fill + line), oldest value first. */
export function sparklinePath(values: number[], width = 80, height = 24) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const area = `${line} V ${height} H 0 Z`;
  return { line, area };
}
