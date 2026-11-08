import { createClient } from "@/lib/supabase/server";
import { hasAccess, type Permissions } from "@/lib/permissions";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => iso(new Date(Date.now() + n * DAY));
const daysSince = (value: string) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY));
const round = (n: number) => Math.round(n * 100) / 100;

function tally<T extends string>(rows: { key: T; amount?: number }[]) {
  const out: Record<string, { count: number; amount: number }> = {};
  for (const r of rows) {
    const o = (out[r.key] ??= { count: 0, amount: 0 });
    o.count += 1;
    o.amount = round(o.amount + (r.amount ?? 0));
  }
  return out;
}

/**
 * A compact, numbers-only picture of the business for the AI briefing.
 * Built with the signed-in user's own Supabase client, so RLS applies, and
 * only for the pages that user may read, so the AI never sees more than they do.
 */
export async function buildBusinessSnapshot(permissions: Permissions) {
  const supabase: Supabase = await createClient();
  const today = iso(new Date());
  const snapshot: Record<string, unknown> = { today, currency: "EUR" };
  // Sections are independent: fetch them all at once instead of one after another.
  const tasks: Promise<void>[] = [];

  tasks.push(
    (async () => {
      if (!hasAccess(permissions, "firms")) return;
      const FIRM_STATUSES = ["not_started", "in_progress", "sent", "responded", "negotiation", "client"] as const;
      const stale = new Date(Date.now() - 14 * DAY).toISOString();
      const week = new Date(Date.now() - 7 * DAY).toISOString();
      const [counts, staleCount, staleRows, newThisWeek, countryRows] = await Promise.all([
        Promise.all(
          FIRM_STATUSES.map(async (s) => {
            const { count } = await supabase.from("firms").select("*", { count: "exact", head: true }).eq("status", s);
            return [s, count ?? 0] as const;
          })
        ),
        supabase
          .from("firms")
          .select("*", { count: "exact", head: true })
          .in("status", ["in_progress", "sent", "responded", "negotiation"])
          .lt("updated_at", stale),
        supabase
          .from("firms")
          .select("name, status, city, country, updated_at")
          .in("status", ["sent", "responded", "negotiation"])
          .lt("updated_at", stale)
          .order("updated_at", { ascending: true })
          .limit(8),
        supabase.from("firms").select("*", { count: "exact", head: true }).gte("created_at", week),
        supabase.from("city_status").select("country, firm_count").limit(1000),
      ]);

      const byCountry: Record<string, { total: number }> = {};
      for (const r of countryRows.data ?? []) {
        (byCountry[r.country] ??= { total: 0 }).total += r.firm_count;
      }
      snapshot.firms = {
        by_status: Object.fromEntries(counts),
        total: counts.reduce((n, [, c]) => n + c, 0),
        added_last_7_days: newThisWeek.count ?? 0,
        untouched_for_14_plus_days_in_active_stages: staleCount.count ?? 0,
        oldest_stalled_contacted_firms: (staleRows.data ?? []).map((f) => ({
          name: f.name,
          status: f.status,
          city: f.city,
          country: f.country,
          days_without_update: daysSince(f.updated_at),
        })),
        top_countries: Object.entries(byCountry)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 6)
          .map(([country, v]) => ({ country, ...v })),
      };
    })()
  );

  tasks.push(
    (async () => {
      if (!hasAccess(permissions, "offers")) return;
      const { data } = await supabase
        .from("angebots")
        .select("angebot_number, status, total_amount, issue_date, valid_until, updated_at, firms(name)")
        .limit(1000);
      const offers = (data ?? []) as unknown as {
        angebot_number: string;
        status: string;
        total_amount: number;
        issue_date: string;
        valid_until: string | null;
        updated_at: string;
        firms: { name: string } | null;
      }[];
      const open = offers.filter((o) => o.status === "sent");
      snapshot.offers = {
        by_status: tally(offers.map((o) => ({ key: o.status, amount: Number(o.total_amount) }))),
        awaiting_answer_value: round(open.reduce((n, o) => n + Number(o.total_amount), 0)),
        sent_over_7_days_ago_without_answer: open
          .filter((o) => daysSince(o.updated_at) >= 7)
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
          .slice(0, 8)
          .map((o) => ({ number: o.angebot_number, firm: o.firms?.name, amount: Number(o.total_amount), days_waiting: daysSince(o.updated_at) })),
        expiring_within_7_days: open
          .filter((o) => o.valid_until && o.valid_until >= today && o.valid_until <= daysFromNow(7))
          .slice(0, 8)
          .map((o) => ({ number: o.angebot_number, firm: o.firms?.name, amount: Number(o.total_amount), valid_until: o.valid_until })),
      };
    })()
  );

  tasks.push(
    (async () => {
      if (!hasAccess(permissions, "invoices")) return;
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number, status, total_amount, issue_date, due_date, firms(name)")
        .limit(1000);
      const invoices = (data ?? []) as unknown as {
        invoice_number: string;
        status: string;
        total_amount: number;
        issue_date: string;
        due_date: string | null;
        firms: { name: string } | null;
      }[];
      const unpaid = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
      const overdue = unpaid.filter((i) => i.due_date && i.due_date < today);
      snapshot.invoices = {
        by_status: tally(invoices.map((i) => ({ key: i.status, amount: Number(i.total_amount) }))),
        outstanding_value: round(unpaid.reduce((n, i) => n + Number(i.total_amount), 0)),
        overdue_value: round(overdue.reduce((n, i) => n + Number(i.total_amount), 0)),
        overdue: overdue
          .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
          .slice(0, 8)
          .map((i) => ({ number: i.invoice_number, firm: i.firms?.name, amount: Number(i.total_amount), due_date: i.due_date, days_overdue: daysSince(i.due_date!) })),
        due_within_7_days: unpaid
          .filter((i) => i.due_date && i.due_date >= today && i.due_date <= daysFromNow(7))
          .slice(0, 8)
          .map((i) => ({ number: i.invoice_number, firm: i.firms?.name, amount: Number(i.total_amount), due_date: i.due_date })),
      };
    })()
  );

  tasks.push(
    (async () => {
      if (!hasAccess(permissions, "employees")) return;
      const { data } = await supabase
        .from("employees")
        .select("full_name, position, employment_type, contract_end_date, has_contract")
        .limit(1000);
      const employees = data ?? [];
      snapshot.employees = {
        total: employees.length,
        by_type: tally(employees.map((e) => ({ key: e.employment_type }))),
        without_contract: employees.filter((e) => !e.has_contract).length,
        contracts_ending_within_60_days: employees
          .filter((e) => e.contract_end_date && e.contract_end_date >= today && e.contract_end_date <= daysFromNow(60))
          .slice(0, 10)
          .map((e) => ({ name: e.full_name, position: e.position, ends: e.contract_end_date })),
      };
    })()
  );

  tasks.push(
    (async () => {
      if (!hasAccess(permissions, "cities")) return;
      const { data } = await supabase.from("city_status").select("country, status, firm_count").limit(5000);
      const byCountry: Record<string, { completed: number; in_progress: number; not_started: number }> = {};
      for (const r of data ?? []) {
        (byCountry[r.country] ??= { completed: 0, in_progress: 0, not_started: 0 })[r.status] += 1;
      }
      snapshot.city_progress = Object.entries(byCountry)
        .filter(([, v]) => v.completed + v.in_progress > 0)
        .map(([country, v]) => ({ country, ...v }));
    })()
  );

  await Promise.all(tasks);
  return snapshot;
}
