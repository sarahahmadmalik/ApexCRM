import type { FirmStatus } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/server";
import { hasAccess, type PageKey, type Permissions } from "@/lib/permissions";
import { COUNTRY_NAMES } from "@/lib/data/geo";
import type { ToolSpec } from "@/lib/ai/openrouter";
import { prepareProposal, type Proposal } from "@/lib/ai/proposals";

type Level = "read" | "write";
type ToolDef = {
  page: PageKey;
  level: Level;
  spec: ToolSpec["function"];
  /** Read tools return data for the model. Write tools return a proposal that waits for the user's click. */
  run: (args: Record<string, unknown>) => Promise<unknown>;
  proposes?: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown, fallback: number, max: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.min(Math.max(n, 1), max);
};
/** Strips characters that have special meaning inside a PostgREST ilike / or() filter. */
const safeLike = (v: string) => v.replace(/[%_,()*\\]/g, " ").trim();

const FIRM_STATUS_ENUM = ["not_started", "in_progress", "sent", "responded", "negotiation", "client"];

const TOOLS: Record<string, ToolDef> = {
  find_firms: {
    page: "firms",
    level: "read",
    spec: {
      name: "find_firms",
      description:
        "Search firms (law firms / prospects). Returns id, name, status, city, country, contact. Use this to look up a firm's id before proposing changes to it.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Part of the firm name, contact name or city" },
          status: { type: "string", enum: FIRM_STATUS_ENUM },
          country: { type: "string" },
          city: { type: "string" },
          limit: { type: "integer", description: "Max rows, default 10, max 25" },
        },
      },
    },
    run: async (a) => {
      const supabase = await createClient();
      let q = supabase
        .from("firms")
        .select("id, name, status, city, state, country, contact_name, contact_email, website, notes, updated_at")
        .order("updated_at", { ascending: false })
        .limit(num(a.limit, 10, 25));
      const query = str(a.query);
      if (query) {
        const s = safeLike(query);
        q = q.or(`name.ilike.%${s}%,contact_name.ilike.%${s}%,city.ilike.%${s}%`);
      }
      if (str(a.status)) q = q.eq("status", a.status as FirmStatus);
      if (str(a.country)) q = q.ilike("country", safeLike(a.country as string));
      if (str(a.city)) q = q.ilike("city", safeLike(a.city as string));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data.length, firms: data };
    },
  },

  firm_pipeline: {
    page: "firms",
    level: "read",
    spec: {
      name: "firm_pipeline",
      description: "Counts of firms per pipeline status, optionally for one country. Use for 'how many firms…' questions.",
      parameters: { type: "object", properties: { country: { type: "string" } } },
    },
    run: async (a) => {
      const supabase = await createClient();
      const out: Record<string, number> = {};
      for (const status of FIRM_STATUS_ENUM) {
        let q = supabase.from("firms").select("*", { count: "exact", head: true }).eq("status", status as FirmStatus);
        if (str(a.country)) q = q.ilike("country", safeLike(a.country as string));
        out[status] = (await q).count ?? 0;
      }
      return { by_status: out, total: Object.values(out).reduce((n, c) => n + c, 0) };
    },
  },

  list_offers: {
    page: "offers",
    level: "read",
    spec: {
      name: "list_offers",
      description: "List offers (Angebote) with id, number, firm, amount, status and dates. Newest first.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "sent", "accepted", "rejected"] },
          firm_query: { type: "string", description: "Part of the firm name" },
          limit: { type: "integer" },
        },
      },
    },
    run: async (a) => {
      const supabase = await createClient();
      let q = supabase
        .from("angebots")
        .select("id, angebot_number, status, total_amount, issue_date, valid_until, firms!inner(name)")
        .order("created_at", { ascending: false })
        .limit(num(a.limit, 10, 25));
      if (str(a.status)) q = q.eq("status", a.status as "draft");
      if (str(a.firm_query)) q = q.ilike("firms.name", `%${safeLike(a.firm_query as string)}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { offers: data };
    },
  },

  list_invoices: {
    page: "invoices",
    level: "read",
    spec: {
      name: "list_invoices",
      description: "List invoices (Rechnungen) with id, number, firm, amount, status and due date. Newest first.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "cancelled"] },
          firm_query: { type: "string" },
          limit: { type: "integer" },
        },
      },
    },
    run: async (a) => {
      const supabase = await createClient();
      let q = supabase
        .from("invoices")
        .select("id, invoice_number, status, total_amount, issue_date, due_date, firms!inner(name)")
        .order("created_at", { ascending: false })
        .limit(num(a.limit, 10, 25));
      if (str(a.status)) q = q.eq("status", a.status as "draft");
      if (str(a.firm_query)) q = q.ilike("firms.name", `%${safeLike(a.firm_query as string)}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { invoices: data };
    },
  },

  list_employees: {
    page: "employees",
    level: "read",
    spec: {
      name: "list_employees",
      description: "List employees with position, employment type and contract dates. Salary figures are not included.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } } },
    },
    run: async (a) => {
      const supabase = await createClient();
      let q = supabase
        .from("employees")
        .select("id, full_name, position, country, employment_type, contract_start_date, contract_end_date, has_contract")
        .order("full_name")
        .limit(num(a.limit, 15, 40));
      if (str(a.query)) q = q.ilike("full_name", `%${safeLike(a.query as string)}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { employees: data };
    },
  },

  city_progress: {
    page: "cities",
    level: "read",
    spec: {
      name: "city_progress",
      description: "City progress for one country: counts per status plus the cities that are in progress or completed.",
      parameters: {
        type: "object",
        properties: { country: { type: "string" } },
        required: ["country"],
      },
    },
    run: async (a) => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("city_status")
        .select("state, city, status, firm_count, note")
        .ilike("country", safeLike(str(a.country) ?? ""))
        .limit(2000);
      if (error) return { error: error.message };
      const counts = { completed: 0, in_progress: 0, not_started: 0 };
      for (const r of data) counts[r.status] += 1;
      return {
        counts,
        cities_with_activity: data.filter((r) => r.status !== "not_started").slice(0, 40),
      };
    },
  },

  // ---- Write tools: these only PROPOSE. The user confirms in the UI. -----------------------------

  propose_create_firm: {
    page: "firms",
    level: "write",
    proposes: "create_firm",
    spec: {
      name: "propose_create_firm",
      description: "Propose adding a new firm. Needs name, country and city; the federal state is looked up from the city. Nothing is saved until the user confirms.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          country: { type: "string", description: `One of: ${COUNTRY_NAMES.join(", ")}` },
          city: { type: "string" },
          state: { type: "string", description: "Only if known; otherwise leave empty" },
          status: { type: "string", enum: FIRM_STATUS_ENUM },
          contact_name: { type: "string" },
          contact_email: { type: "string" },
          contact_phone: { type: "string" },
          website: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name", "country", "city"],
      },
    },
    run: async () => undefined,
  },

  propose_update_firm_status: {
    page: "firms",
    level: "write",
    proposes: "update_firm_status",
    spec: {
      name: "propose_update_firm_status",
      description: "Propose changing a firm's pipeline status. Look the firm up with find_firms first to get its id.",
      parameters: {
        type: "object",
        properties: { firm_id: { type: "string" }, status: { type: "string", enum: FIRM_STATUS_ENUM } },
        required: ["firm_id", "status"],
      },
    },
    run: async () => undefined,
  },

  propose_create_employee: {
    page: "employees",
    level: "write",
    proposes: "create_employee",
    spec: {
      name: "propose_create_employee",
      description: "Propose adding an employee. Only the name is required. Dates are YYYY-MM-DD. Contract employees need start and end dates.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          position: { type: "string" },
          country: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          employment_type: { type: "string", enum: ["full_time", "part_time", "contract"] },
          contract_start_date: { type: "string" },
          contract_end_date: { type: "string" },
          salary_amount: { type: "number" },
          salary_period: { type: "string", enum: ["month", "year"] },
        },
        required: ["full_name"],
      },
    },
    run: async () => undefined,
  },

  propose_set_city_status: {
    page: "cities",
    level: "write",
    proposes: "set_city_status",
    spec: {
      name: "propose_set_city_status",
      description: "Propose setting the manual progress status (not started / in progress / completed) of a city.",
      parameters: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          status: { type: "string", enum: ["not_started", "in_progress", "completed"] },
          note: { type: "string" },
        },
        required: ["country", "city", "status"],
      },
    },
    run: async () => undefined,
  },

  propose_update_offer_status: {
    page: "offers",
    level: "write",
    proposes: "update_offer_status",
    spec: {
      name: "propose_update_offer_status",
      description: "Propose changing an offer's status. Get the id from list_offers first.",
      parameters: {
        type: "object",
        properties: { offer_id: { type: "string" }, status: { type: "string", enum: ["draft", "sent", "accepted", "rejected"] } },
        required: ["offer_id", "status"],
      },
    },
    run: async () => undefined,
  },

  propose_update_invoice_status: {
    page: "invoices",
    level: "write",
    proposes: "update_invoice_status",
    spec: {
      name: "propose_update_invoice_status",
      description: "Propose changing an invoice's status (e.g. mark as paid). Get the id from list_invoices first.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "cancelled"] },
        },
        required: ["invoice_id", "status"],
      },
    },
    run: async () => undefined,
  },

  propose_create_offer: {
    page: "offers",
    level: "write",
    proposes: "create_offer",
    spec: {
      name: "propose_create_offer",
      description:
        "Propose a new DRAFT offer for a firm. Look the firm up with find_firms first. Prices are net EUR; VAT defaults to 19%, validity to 30 days. Only create it when the user gave concrete items and prices.",
      parameters: {
        type: "object",
        properties: {
          firm_id: { type: "string" },
          vat_rate: { type: "number" },
          valid_days: { type: "integer" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string", description: 'e.g. "Std." or "Tage"' },
                unit_price: { type: "number", description: "Net price per unit in EUR" },
              },
              required: ["description", "quantity", "unit_price"],
            },
          },
        },
        required: ["firm_id", "items"],
      },
    },
    run: async () => undefined,
  },
};

/** The tools this user may use: reading needs read access to the tool's page, proposing needs write access. */
export function toolsFor(permissions: Permissions): ToolSpec[] {
  return Object.values(TOOLS)
    .filter((t) => hasAccess(permissions, t.page, t.level))
    .map((t) => ({ type: "function" as const, function: t.spec }));
}

export type ToolOutcome = { content: string; proposal?: Proposal };

/** Runs one tool call from the model. Never throws: problems go back to the model as text. */
export async function runTool(permissions: Permissions, name: string, rawArgs: string): Promise<ToolOutcome> {
  const tool = TOOLS[name];
  if (!tool || !hasAccess(permissions, tool.page, tool.level)) {
    return { content: JSON.stringify({ error: "That tool isn't available to this user." }) };
  }
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { content: JSON.stringify({ error: "Tool arguments weren't valid JSON." }) };
  }

  try {
    if (tool.proposes) {
      const result = await prepareProposal(tool.proposes, args);
      if ("error" in result) return { content: JSON.stringify({ error: result.error }) };
      return {
        proposal: result.proposal,
        content: JSON.stringify({
          status: "awaiting_user_confirmation",
          note: "A confirmation card was shown to the user. Nothing has been saved yet. Tell the user to confirm it; do not say it is done.",
        }),
      };
    }
    return { content: JSON.stringify(await tool.run(args)).slice(0, 12_000) };
  } catch (err) {
    return { content: JSON.stringify({ error: err instanceof Error ? err.message : "Tool failed." }) };
  }
}
