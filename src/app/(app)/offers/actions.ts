"use server";

import { createClient } from "@/lib/supabase/server";
import { calcTotals, formatCurrency, formatDate } from "@/lib/utils";
import { renderDocxTemplate } from "@/lib/documents/generate";
import { renderPdf } from "@/lib/documents/pdf";
import { storeAndSign, slug, type DocumentFormat } from "@/lib/documents/storage";
import type { AngebotStatus, LineItem } from "@/lib/types/database";
import { assertAccess } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

const SIGNER_NAME = "Omer Farooq";

export type AngebotInput = {
  firm_id: string;
  issue_date: string;
  valid_until: string;
  vat_rate: number;
  line_items: LineItem[];
};

function assertDates(input: AngebotInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issue_date)) throw new Error("Issue date is required.");
  if (input.valid_until && input.valid_until < input.issue_date) {
    throw new Error("Valid-until date can't be before the issue date.");
  }
}

export async function createAngebot(input: AngebotInput) {
  const appUser = await assertAccess("offers", "write");
  if (!input.firm_id) throw new Error("Pick a firm.");
  if (input.line_items.length === 0) throw new Error("Add at least one line item.");
  assertDates(input);

  const { net, vat, total } = calcTotals(input.line_items, input.vat_rate);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("angebots")
    .insert({
      firm_id: input.firm_id,
      issue_date: input.issue_date,
      valid_until: input.valid_until || null,
      vat_rate: input.vat_rate,
      line_items: input.line_items,
      net_amount: net,
      vat_amount: vat,
      total_amount: total,
      created_by: appUser.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/offers");
  return data.id as string;
}

export async function updateAngebot(id: string, input: AngebotInput) {
  await assertAccess("offers", "write");
  if (!input.firm_id) throw new Error("Pick a firm.");
  if (input.line_items.length === 0) throw new Error("Add at least one line item.");
  assertDates(input);

  const { net, vat, total } = calcTotals(input.line_items, input.vat_rate);
  const supabase = await createClient();
  const { error } = await supabase
    .from("angebots")
    .update({
      firm_id: input.firm_id,
      issue_date: input.issue_date,
      valid_until: input.valid_until || null,
      vat_rate: input.vat_rate,
      line_items: input.line_items,
      net_amount: net,
      vat_amount: vat,
      total_amount: total,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/offers");
  }

export async function updateAngebotStatus(id: string, status: AngebotStatus) {
  await assertAccess("offers", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("angebots").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/offers");
  revalidatePath("/firms");
  revalidatePath("/overview");
}

export async function deleteAngebot(id: string) {
  await assertAccess("offers", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("angebots").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/offers");
}

/**
 * Renders the offer as a Word document (from the tagged template) or a PDF,
 * stores it, and returns a signed URL that downloads it.
 */
export async function downloadAngebotDocument(id: string, format: DocumentFormat) {
  await assertAccess("offers", "read");

  const supabase = await createClient();
  const { data: angebot, error } = await supabase
    .from("angebots")
    .select("*, firms(*)")
    .eq("id", id)
    .single();
  if (error || !angebot) throw new Error(error?.message ?? "Offer not found");

  const firm = (angebot as unknown as { firms: { name: string; contact_name: string | null; city: string; country: string } }).firms;
  const salutation = firm.contact_name ? `Sehr geehrte(r) ${firm.contact_name},` : "Sehr geehrte Damen und Herren,";
  const customerNumber = angebot.firm_id.slice(0, 8).toUpperCase();
  const items = (angebot.line_items as LineItem[]).map((li, i) => ({
    pos: i + 1,
    description: li.description,
    quantity: li.quantity,
    unit_price: formatCurrency(li.unit_price),
    total: formatCurrency(li.total),
  }));

  const buffer =
    format === "docx"
      ? renderDocxTemplate("angebot-template.docx", {
          salutation,
          signer_name: SIGNER_NAME,
          firm_name: firm.name,
          firm_department: "",
          contact_name: firm.contact_name ?? "",
          firm_address_line: "",
          firm_postal_city: `${firm.city}, ${firm.country}`,
          angebot_number: angebot.angebot_number,
          issue_date: formatDate(angebot.issue_date),
          customer_number: customerNumber,
          valid_until: formatDate(angebot.valid_until),
          vat_rate: angebot.vat_rate,
          net_amount: formatCurrency(angebot.net_amount),
          vat_amount: formatCurrency(angebot.vat_amount),
          total_amount: formatCurrency(angebot.total_amount),
          items,
        })
      : await renderPdf({
          title: "Angebot",
          recipient: [firm.name, ...(firm.contact_name ? [firm.contact_name] : []), `${firm.city}, ${firm.country}`],
          meta: [
            ["Angebotsnummer", angebot.angebot_number],
            ["Datum", formatDate(angebot.issue_date)],
            ["Kundennummer", customerNumber],
            ["Gültig bis", formatDate(angebot.valid_until)],
          ],
          intro: [salutation, "vielen Dank für Ihr Interesse. Gerne unterbreiten wir Ihnen folgendes Angebot:"],
          items: { labels: ["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamt"], rows: items },
          totals: [
            { label: "Nettobetrag", value: formatCurrency(angebot.net_amount) },
            { label: `zzgl. ${angebot.vat_rate}% USt.`, value: formatCurrency(angebot.vat_amount) },
            { label: "Gesamtbetrag", value: formatCurrency(angebot.total_amount), strong: true },
          ],
          closing: ["Wir freuen uns auf Ihre Rückmeldung.", "Mit freundlichen Grüßen", SIGNER_NAME],
        });

  const filePath = `angebots/${angebot.angebot_number}.${format}`;
  const url = await storeAndSign(
    supabase,
    filePath,
    buffer,
    format,
    `Offer-${angebot.angebot_number}-${slug(firm.name)}.${format}`
  );

  if (format === "docx") {
    await supabase.from("angebots").update({ file_path: filePath }).eq("id", id);
    revalidatePath("/offers");
  }
  return url;
}
