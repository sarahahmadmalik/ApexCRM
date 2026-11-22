"use server";

import { createClient } from "@/lib/supabase/server";
import { calcTotals, formatCurrency, formatDate } from "@/lib/utils";
import { renderDocxTemplate } from "@/lib/documents/generate";
import { convertDocxToPdf } from "@/lib/documents/convert";
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

  const firm = (
    angebot as unknown as { firms: { name: string; contact_name: string | null; city: string; country: string } | null }
  ).firms;
  const firmName = firm?.name ?? "Client";
  const contactName = firm?.contact_name ?? null;
  const postalCity = firm ? `${firm.city}, ${firm.country}` : "";
  const salutation = contactName ? `Sehr geehrte(r) ${contactName},` : "Sehr geehrte Damen und Herren,";
  const customerNumber = angebot.firm_id.slice(0, 8).toUpperCase();
  const items = (angebot.line_items as LineItem[]).map((li, i) => ({
    pos: i + 1,
    description: li.description,
    quantity: li.quantity,
    unit_price: formatCurrency(li.unit_price),
    total: formatCurrency(li.total),
  }));

  let buffer: Buffer;
  try {
    const docx = renderDocxTemplate("angebot-template.docx", {
      salutation,
      signer_name: SIGNER_NAME,
      firm_name: firmName,
      firm_department: "",
      contact_name: contactName ?? "",
      firm_address_line: "",
      firm_postal_city: postalCity,
      angebot_number: angebot.angebot_number,
      issue_date: formatDate(angebot.issue_date),
      customer_number: customerNumber,
      valid_until: formatDate(angebot.valid_until),
      vat_rate: angebot.vat_rate,
      net_amount: formatCurrency(angebot.net_amount),
      vat_amount: formatCurrency(angebot.vat_amount),
      total_amount: formatCurrency(angebot.total_amount),
      items,
    });
    if (format === "docx") {
      buffer = docx;
    } else if (process.env.CLOUDCONVERT_API_KEY) {
      buffer = await convertDocxToPdf(docx, "angebot.docx").catch(() =>
        renderPdf({
          title: "Angebot",
          recipient: [firmName, ...(contactName ? [contactName] : []), ...(postalCity ? [postalCity] : [])],
          meta: [
            ["Angebot Nr.", angebot.angebot_number],
            ["Datum", formatDate(angebot.issue_date)],
            ["Gültig bis", formatDate(angebot.valid_until)],
            ["Kunden-Nr.", customerNumber],
          ],
          intro: [salutation, "Vielen Dank für Ihr Interesse. Wir unterbreiten Ihnen folgendes Angebot:"],
          items: {
            labels: ["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamt"],
            rows: items,
          },
          totals: [
            { label: "Nettobetrag", value: formatCurrency(angebot.net_amount) },
            { label: `USt. (${angebot.vat_rate}%)`, value: formatCurrency(angebot.vat_amount) },
            { label: "Gesamtbetrag", value: formatCurrency(angebot.total_amount), strong: true },
          ],
          closing: ["Mit freundlichen Grüßen", SIGNER_NAME],
        })
      );
    } else {
      buffer = await renderPdf({
        title: "Angebot",
        recipient: [firmName, ...(contactName ? [contactName] : []), ...(postalCity ? [postalCity] : [])],
        meta: [
          ["Angebot Nr.", angebot.angebot_number],
          ["Datum", formatDate(angebot.issue_date)],
          ["Gültig bis", formatDate(angebot.valid_until)],
          ["Kunden-Nr.", customerNumber],
        ],
        intro: [salutation, "Vielen Dank für Ihr Interesse. Wir unterbreiten Ihnen folgendes Angebot:"],
        items: {
          labels: ["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamt"],
          rows: items,
        },
        totals: [
          { label: "Nettobetrag", value: formatCurrency(angebot.net_amount) },
          { label: `USt. (${angebot.vat_rate}%)`, value: formatCurrency(angebot.vat_amount) },
          { label: "Gesamtbetrag", value: formatCurrency(angebot.total_amount), strong: true },
        ],
        closing: ["Mit freundlichen Grüßen", SIGNER_NAME],
      });
    }
  } catch (err) {
    if (format === "pdf") {
      buffer = await renderPdf({
        title: "Angebot",
        recipient: [firmName, ...(contactName ? [contactName] : []), ...(postalCity ? [postalCity] : [])],
        meta: [
          ["Angebot Nr.", angebot.angebot_number],
          ["Datum", formatDate(angebot.issue_date)],
          ["Gültig bis", formatDate(angebot.valid_until)],
          ["Kunden-Nr.", customerNumber],
        ],
        intro: [salutation, "Vielen Dank für Ihr Interesse. Wir unterbreiten Ihnen folgendes Angebot:"],
        items: {
          labels: ["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamt"],
          rows: items,
        },
        totals: [
          { label: "Nettobetrag", value: formatCurrency(angebot.net_amount) },
          { label: `USt. (${angebot.vat_rate}%)`, value: formatCurrency(angebot.vat_amount) },
          { label: "Gesamtbetrag", value: formatCurrency(angebot.total_amount), strong: true },
        ],
        closing: ["Mit freundlichen Grüßen", SIGNER_NAME],
      });
    } else {
      throw err;
    }
  }

  const filePath = `angebots/${angebot.angebot_number}.${format}`;
  const url = await storeAndSign(
    supabase,
    filePath,
    buffer,
    format,
    `Offer-${angebot.angebot_number}-${slug(firmName)}.${format}`
  );

  if (format === "docx") {
    await supabase.from("angebots").update({ file_path: filePath }).eq("id", id);
    revalidatePath("/offers");
  }
  return url;
}
