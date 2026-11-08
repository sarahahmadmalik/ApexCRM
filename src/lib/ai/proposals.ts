import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { COUNTRY_NAMES, findStateForCity } from "@/lib/data/geo";
import { FIRM_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, CITY_STATUS_LABELS, formatCurrency } from "@/lib/utils";

/**
 * Everything the assistant is allowed to WRITE. The model never writes anything
 * itself: it only proposes one of these, the user sees a confirmation card, and
 * only an explicit click runs it (through the same permission-checked server
 * actions the normal forms use). The schema below is also re-validated on the
 * server when the click arrives, so a tampered request can't do more than the form could.
 */

const firmStatus = z.enum(["not_started", "in_progress", "sent", "responded", "negotiation", "client"]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optional = z.string().trim().max(500).optional();

export const actionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create_firm"),
    name: z.string().trim().min(1).max(200),
    country: z.string().trim().min(1),
    state: z.string().trim().min(1),
    city: z.string().trim().min(1),
    status: firmStatus.default("not_started"),
    contact_name: optional,
    contact_email: optional,
    contact_phone: optional,
    website: optional,
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({ kind: z.literal("update_firm_status"), firm_id: z.string().uuid(), status: firmStatus }),
  z.object({
    kind: z.literal("create_employee"),
    full_name: z.string().trim().min(1).max(200),
    country: optional,
    position: optional,
    email: optional,
    phone: optional,
    employment_type: z.enum(["full_time", "part_time", "contract"]).default("full_time"),
    contract_start_date: dateStr.optional(),
    contract_end_date: dateStr.optional(),
    salary_amount: z.number().positive().max(10_000_000).optional(),
    salary_period: z.enum(["month", "year"]).optional(),
  }),
  z.object({
    kind: z.literal("set_city_status"),
    country: z.string().trim().min(1),
    state: z.string().trim().min(1),
    city: z.string().trim().min(1),
    status: z.enum(["not_started", "in_progress", "completed"]),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    kind: z.literal("update_offer_status"),
    offer_id: z.string().uuid(),
    status: z.enum(["draft", "sent", "accepted", "rejected"]),
  }),
  z.object({
    kind: z.literal("update_invoice_status"),
    invoice_id: z.string().uuid(),
    status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  }),
  z.object({
    kind: z.literal("create_offer"),
    firm_id: z.string().uuid(),
    vat_rate: z.number().min(0).max(30).default(19),
    valid_days: z.number().int().min(1).max(365).default(30),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(300),
          quantity: z.number().positive().max(1_000_000),
          unit: z.string().trim().max(20).optional(),
          unit_price: z.number().min(0).max(10_000_000),
        })
      )
      .min(1)
      .max(20),
  }),
]);

export type AssistantAction = z.infer<typeof actionSchema>;

export type Proposal = {
  id: string;
  action: AssistantAction;
  /** Short heading for the confirmation card. */
  title: string;
  /** Human-readable "what will happen", built by the SERVER from verified data, not by the model. */
  lines: string[];
  warnings: string[];
};

const label = (map: Record<string, string>, key: string) => map[key] ?? key;

/**
 * Validates a model-proposed action against the real data and turns it into a
 * confirmation card. Returns `{ error }` (fed back to the model so it can fix
 * or ask the user) when something doesn't check out.
 */
export async function prepareProposal(
  kind: string,
  rawArgs: unknown
): Promise<{ proposal: Proposal } | { error: string }> {
  const args = rawArgs && typeof rawArgs === "object" ? { ...(rawArgs as Record<string, unknown>) } : {};

  // Resolve the federal state from the city when the model only knew country + city.
  if (
    (kind === "create_firm" || kind === "set_city_status") &&
    !args.state &&
    typeof args.country === "string" &&
    typeof args.city === "string"
  ) {
    const state = findStateForCity(args.country, args.city);
    if (state) args.state = state;
  }

  const parsed = actionSchema.safeParse({ ...args, kind });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return { error: `Invalid proposal (${issues}). Ask the user for the missing or invalid details.` };
  }
  const action = parsed.data;
  const supabase = await createClient();
  const warnings: string[] = [];
  const id = crypto.randomUUID();

  switch (action.kind) {
    case "create_firm": {
      if (!COUNTRY_NAMES.includes(action.country)) {
        return { error: `"${action.country}" isn't a tracked country. Tracked: ${COUNTRY_NAMES.join(", ")}.` };
      }
      if (findStateForCity(action.country, action.city) !== action.state) {
        warnings.push(
          `"${action.city}" isn't in the city list for ${action.country} / ${action.state}, so it won't appear on the map until it is added.`
        );
      }
      const { data: dupes } = await supabase.from("firms").select("name, city").ilike("name", action.name).limit(3);
      if (dupes?.length) {
        warnings.push(`A firm with this name already exists (${dupes.map((d) => `${d.name}, ${d.city}`).join(" · ")}).`);
      }
      const lines = [
        `Name: ${action.name}`,
        `Location: ${action.city}, ${action.state}, ${action.country}`,
        `Status: ${label(FIRM_STATUS_LABELS, action.status)}`,
        ...(action.contact_name ? [`Contact: ${action.contact_name}`] : []),
        ...(action.contact_email ? [`Email: ${action.contact_email}`] : []),
        ...(action.contact_phone ? [`Phone: ${action.contact_phone}`] : []),
        ...(action.website ? [`Website: ${action.website}`] : []),
        ...(action.notes ? [`Notes: ${action.notes}`] : []),
      ];
      return { proposal: { id, action, title: "Create firm", lines, warnings } };
    }

    case "update_firm_status": {
      const { data: firm } = await supabase
        .from("firms")
        .select("name, city, status")
        .eq("id", action.firm_id)
        .maybeSingle();
      if (!firm) return { error: "No firm with that id. Use find_firms to look it up first." };
      if (firm.status === action.status) {
        return { error: `${firm.name} already has the status "${label(FIRM_STATUS_LABELS, firm.status)}".` };
      }
      return {
        proposal: {
          id,
          action,
          title: "Update firm status",
          lines: [
            `Firm: ${firm.name} (${firm.city})`,
            `Status: ${label(FIRM_STATUS_LABELS, firm.status)} → ${label(FIRM_STATUS_LABELS, action.status)}`,
          ],
          warnings,
        },
      };
    }

    case "create_employee": {
      if (action.salary_amount && !action.salary_period) {
        return { error: "Salary needs a period (month or year). Ask the user." };
      }
      if (action.employment_type === "contract" && (!action.contract_start_date || !action.contract_end_date)) {
        return { error: "Contract employees need both a contract start and end date. Ask the user." };
      }
      const lines = [
        `Name: ${action.full_name}`,
        ...(action.position ? [`Position: ${action.position}`] : []),
        `Employment: ${label(EMPLOYMENT_TYPE_LABELS, action.employment_type)}`,
        ...(action.country ? [`Country: ${action.country}`] : []),
        ...(action.email ? [`Email: ${action.email}`] : []),
        ...(action.phone ? [`Phone: ${action.phone}`] : []),
        ...(action.contract_start_date
          ? [`Start: ${action.contract_start_date}${action.contract_end_date ? ` → ${action.contract_end_date}` : ""}`]
          : []),
        ...(action.salary_amount ? [`Salary: ${formatCurrency(action.salary_amount)} / ${action.salary_period}`] : []),
      ];
      const { data: dupes } = await supabase.from("employees").select("full_name").ilike("full_name", action.full_name).limit(2);
      if (dupes?.length) warnings.push("An employee with this name already exists.");
      return { proposal: { id, action, title: "Add employee", lines, warnings } };
    }

    case "set_city_status": {
      const { data: rows } = await supabase
        .from("city_status")
        .select("state, city, status")
        .eq("country", action.country)
        .ilike("city", action.city)
        .limit(5);
      const match = rows?.find((r) => r.state === action.state) ?? (rows?.length === 1 ? rows[0] : undefined);
      if (!match) {
        return { error: `Couldn't find the city "${action.city}" in ${action.country}. Check the spelling with the user.` };
      }
      return {
        proposal: {
          id,
          action: { ...action, state: match.state, city: match.city },
          title: "Update city progress",
          lines: [
            `City: ${match.city}, ${match.state}, ${action.country}`,
            `Status: ${label(CITY_STATUS_LABELS, match.status)} → ${label(CITY_STATUS_LABELS, action.status)}`,
            ...(action.note ? [`Note: ${action.note}`] : []),
          ],
          warnings,
        },
      };
    }

    case "update_offer_status": {
      const { data } = await supabase
        .from("angebots")
        .select("angebot_number, status, total_amount, firms(name)")
        .eq("id", action.offer_id)
        .maybeSingle();
      const offer = data as unknown as {
        angebot_number: string;
        status: string;
        total_amount: number;
        firms: { name: string } | null;
      } | null;
      if (!offer) return { error: "No offer with that id. Use list_offers to look it up first." };
      if (offer.status === action.status) return { error: `Offer ${offer.angebot_number} is already "${offer.status}".` };
      return {
        proposal: {
          id,
          action,
          title: "Update offer status",
          lines: [
            `Offer: ${offer.angebot_number} · ${offer.firms?.name ?? "?"} · ${formatCurrency(offer.total_amount)}`,
            `Status: ${offer.status} → ${action.status}`,
          ],
          warnings,
        },
      };
    }

    case "update_invoice_status": {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number, status, total_amount, firms(name)")
        .eq("id", action.invoice_id)
        .maybeSingle();
      const inv = data as unknown as {
        invoice_number: string;
        status: string;
        total_amount: number;
        firms: { name: string } | null;
      } | null;
      if (!inv) return { error: "No invoice with that id. Use list_invoices to look it up first." };
      if (inv.status === action.status) return { error: `Invoice ${inv.invoice_number} is already "${inv.status}".` };
      return {
        proposal: {
          id,
          action,
          title: "Update invoice status",
          lines: [
            `Invoice: ${inv.invoice_number} · ${inv.firms?.name ?? "?"} · ${formatCurrency(inv.total_amount)}`,
            `Status: ${inv.status} → ${action.status}`,
          ],
          warnings,
        },
      };
    }

    case "create_offer": {
      const { data: firm } = await supabase.from("firms").select("name, city").eq("id", action.firm_id).maybeSingle();
      if (!firm) return { error: "No firm with that id. Use find_firms to look it up first." };
      const net = action.items.reduce((n, i) => n + Math.round(i.quantity * i.unit_price * 100) / 100, 0);
      const vat = Math.round(net * action.vat_rate) / 100;
      return {
        proposal: {
          id,
          action,
          title: "Create offer (draft)",
          lines: [
            `For: ${firm.name} (${firm.city})`,
            ...action.items.map(
              (i) => `${i.quantity}${i.unit ? ` ${i.unit}` : ""} × ${i.description} @ ${formatCurrency(i.unit_price)}`
            ),
            `Net ${formatCurrency(net)} + ${action.vat_rate}% VAT = ${formatCurrency(net + vat)}`,
            `Valid for ${action.valid_days} days`,
          ],
          warnings,
        },
      };
    }
  }
}
