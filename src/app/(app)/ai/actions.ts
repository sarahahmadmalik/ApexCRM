"use server";

import { getCurrentAppUser, createClient } from "@/lib/supabase/server";
import { AiError, aiConfigured, chatCompletion, parseJsonObject } from "@/lib/ai/openrouter";
import { buildBusinessSnapshot } from "@/lib/ai/snapshot";
import { actionSchema, type AssistantAction } from "@/lib/ai/proposals";
import { createFirm, updateFirmStatus } from "@/app/(app)/firms/actions";
import { createEmployee } from "@/app/(app)/employees/actions";
import { setCityOverride } from "@/app/(app)/cities/actions";
import { createAngebot, updateAngebotStatus } from "@/app/(app)/offers/actions";
import { updateInvoiceStatus } from "@/app/(app)/invoices/actions";
import { hasAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export type BriefingInsight = {
  title: string;
  detail: string;
  severity: "good" | "watch" | "risk";
};

export type Briefing = {
  headline: string;
  summary: string;
  insights: BriefingInsight[];
  next_steps: string[];
  generatedAt: string;
};

const BRIEFING_SYSTEM = `You are the business analyst for ApexCRM, a unified CRM and operations platform. You receive a JSON snapshot of the company's live data (firm pipeline, offers, invoices, employees, city coverage) and write a short management briefing for the leadership team.

Rules:
- Use ONLY the numbers in the snapshot. Never invent figures, names or trends. If a section is missing from the snapshot, the user has no access to it: don't mention it.
- Be specific: name firms, invoice/offer numbers, amounts (EUR, German formatting like 1.605,00 €) and days.
- Prioritise what needs action: overdue invoices, offers waiting for an answer, stalled firms, contracts ending, then wins.
- Plain, confident business English. No filler, no markdown.

Return ONE JSON object and nothing else:
{
  "headline": "one sentence, the single most important takeaway",
  "summary": "3-4 sentences giving the overall picture",
  "insights": [ { "title": "max 6 words", "detail": "1-2 sentences with concrete numbers", "severity": "good" | "watch" | "risk" } ],
  "next_steps": [ "imperative sentence naming who or what to act on" ]
}
Give 3 to 6 insights (most urgent first) and 2 to 4 next_steps.`;

export type AssistantPlacement = "header" | "floating" | "hidden";

/** Saves where this user wants the assistant button (header, floating or hidden) on their account. */
export async function updateAssistantPlacement(placement: AssistantPlacement) {
  if (!["header", "floating", "hidden"].includes(placement)) throw new Error("Invalid choice.");
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update({ assistant_placement: placement }).eq("id", appUser.id);
  if (error) {
    throw new Error(
      error.message.includes("assistant_placement")
        ? "Couldn't save yet: run supabase/migrations/0012_assistant_placement.sql in the Supabase SQL Editor."
        : error.message
    );
  }
  revalidatePath("/", "layout");
}

/** Generates the AI briefing from the live data the current user is allowed to see. */
export async function generateBriefing(): Promise<Briefing> {
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("Unauthorized");
  if (!aiConfigured()) throw new Error("The AI features aren't configured. Add OPENROUTER_KEY to the environment.");

  const snapshot = await buildBusinessSnapshot(appUser.permissions);
  try {
    const { content } = await chatCompletion({
      json: true,
      maxTokens: 1400,
      messages: [
        { role: "system", content: BRIEFING_SYSTEM },
        { role: "user", content: `Snapshot:\n${JSON.stringify(snapshot)}` },
      ],
    });
    const parsed = parseJsonObject<Partial<Briefing>>(content);
    const severities = ["good", "watch", "risk"];
    return {
      headline: String(parsed.headline ?? "").slice(0, 300),
      summary: String(parsed.summary ?? "").slice(0, 1200),
      insights: (Array.isArray(parsed.insights) ? parsed.insights : []).slice(0, 8).map((i) => ({
        title: String(i?.title ?? "").slice(0, 80),
        detail: String(i?.detail ?? "").slice(0, 500),
        severity: severities.includes(String(i?.severity)) ? (i.severity as BriefingInsight["severity"]) : "watch",
      })),
      next_steps: (Array.isArray(parsed.next_steps) ? parsed.next_steps : []).slice(0, 5).map((s) => String(s).slice(0, 300)),
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof AiError) throw new Error(err.message);
    throw err;
  }
}

/**
 * Runs an action the user confirmed in the assistant. Everything is re-validated here and
 * goes through the same permission-checked server actions as the normal forms, so the
 * assistant can never do something the user couldn't do by hand.
 */
export async function executeAssistantAction(raw: AssistantAction): Promise<string> {
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) throw new Error("That action isn't valid anymore. Ask the assistant again.");
  const action = parsed.data;

  switch (action.kind) {
    case "create_firm": {
      await createFirm({
        name: action.name,
        country: action.country,
        state: action.state,
        city: action.city,
        status: action.status,
        contact_name: action.contact_name,
        contact_email: action.contact_email,
        contact_phone: action.contact_phone,
        website: action.website,
        notes: action.notes,
      });
      return `Created firm "${action.name}".`;
    }
    case "update_firm_status":
      await updateFirmStatus(action.firm_id, action.status);
      return `Firm status set to "${action.status}".`;

    case "create_employee":
      await createEmployee({
        full_name: action.full_name,
        country: action.country,
        position: action.position,
        email: action.email,
        phone: action.phone,
        employment_type: action.employment_type,
        contract_start_date: action.contract_start_date ?? null,
        contract_end_date: action.contract_end_date ?? null,
        salary_amount: action.salary_amount ?? null,
        salary_period: action.salary_amount ? (action.salary_period ?? "month") : null,
      });
      return `Added ${action.full_name} to Employees.`;

    case "set_city_status":
      await setCityOverride(action.country, action.state, action.city, action.status, action.note ?? "");
      return `${action.city} marked as ${action.status.replace("_", " ")}.`;

    case "update_offer_status":
      await updateAngebotStatus(action.offer_id, action.status);
      return `Offer status set to "${action.status}".`;

    case "update_invoice_status":
      await updateInvoiceStatus(action.invoice_id, action.status);
      return `Invoice status set to "${action.status}".`;

    case "create_offer": {
      const appUser = await getCurrentAppUser();
      if (!appUser || !hasAccess(appUser.permissions, "offers", "write")) throw new Error("You have read-only access to this page.");
      const day = 86_400_000;
      const items = action.items.map((i) => {
        const total = Math.round(i.quantity * i.unit_price * 100) / 100;
        return {
          description: i.description,
          quantity: i.unit ? `${i.quantity} ${i.unit}` : String(i.quantity),
          unit_price: i.unit_price,
          total,
        };
      });
      const supabase = await createClient();
      const { data: firm } = await supabase.from("firms").select("name").eq("id", action.firm_id).maybeSingle();
      await createAngebot({
        firm_id: action.firm_id,
        issue_date: new Date().toISOString().slice(0, 10),
        valid_until: new Date(Date.now() + action.valid_days * day).toISOString().slice(0, 10),
        vat_rate: action.vat_rate,
        line_items: items,
      });
      return `Created a draft offer for ${firm?.name ?? "the firm"}. Find it under Offers.`;
    }
  }
}
