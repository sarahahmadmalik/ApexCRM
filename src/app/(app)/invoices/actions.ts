"use server";

import { createClient } from "@/lib/supabase/server";
import { calcTotals, formatCurrency, formatDate } from "@/lib/utils";
import { renderDocxTemplate } from "@/lib/documents/generate";
import { convertDocxToPdf } from "@/lib/documents/convert";
import { renderPdf } from "@/lib/documents/pdf";
import { storeAndSign, slug, type DocumentFormat } from "@/lib/documents/storage";
import type { InvoiceStatus, LineItem } from "@/lib/types/database";
import { assertAccess } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

const SIGNER_NAME = "Omer Farooq";

export type InvoiceInput = {
  firm_id: string;
  angebot_id: string | null;
  issue_date: string;
  due_date: string;
  service_period_start: string;
  service_period_end: string;
  vat_rate: number;
  line_items: LineItem[];
};

export async function createInvoice(input: InvoiceInput) {
  const appUser = await assertAccess("invoices", "write");
  if (!input.firm_id) throw new Error("Pick a firm.");
  if (input.line_items.length === 0) throw new Error("Add at least one line item.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issue_date)) throw new Error("Issue date is required.");
  if (input.due_date && input.due_date < input.issue_date) throw new Error("Due date can't be before the issue date.");
  if (!!input.service_period_start !== !!input.service_period_end) {
    throw new Error("Service period needs both a start and an end date.");
  }
  if (input.service_period_start && input.service_period_end < input.service_period_start) {
    throw new Error("Service period end can't be before its start.");
  }

  const { net, vat, total } = calcTotals(input.line_items, input.vat_rate);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      firm_id: input.firm_id,
      angebot_id: input.angebot_id,
      issue_date: input.issue_date,
      due_date: input.due_date || null,
      service_period_start: input.service_period_start || null,
      service_period_end: input.service_period_end || null,
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
  revalidatePath("/invoices");
  return data.id as string;
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  await assertAccess("invoices", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/invoices");
}

export async function deleteInvoice(id: string) {
  await assertAccess("invoices", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
}

/**
 * Renders the invoice as a Word document (from the tagged template) or a PDF,
 * stores it, and returns a signed URL that downloads it.
 */
export async function downloadInvoiceDocument(id: string, format: DocumentFormat) {
  await assertAccess("invoices", "read");

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, firms(*)")
    .eq("id", id)
    .single();
  if (error || !invoice) throw new Error(error?.message ?? "Invoice not found");

  const firm = (
    invoice as unknown as { firms: { name: string; contact_name: string | null; city: string; country: string } | null }
  ).firms;
  const firmName = firm?.name ?? "Client";
  const contactName = firm?.contact_name ?? null;
  const postalCity = firm ? `${firm.city}, ${firm.country}` : "";
  const salutation = contactName ? `Sehr geehrte(r) ${contactName},` : "Sehr geehrte Damen und Herren,";
  const customerNumber = invoice.firm_id.slice(0, 8).toUpperCase();
  const servicePeriod =
    invoice.service_period_start && invoice.service_period_end
      ? `${formatDate(invoice.service_period_start)} – ${formatDate(invoice.service_period_end)}`
      : "—";
  const items = (invoice.line_items as LineItem[]).map((li, i) => ({
    pos: i + 1,
    description: li.description,
    quantity: li.quantity,
    unit_price: formatCurrency(li.unit_price),
    total: formatCurrency(li.total),
  }));

  const buildFallbackPdf = () =>
    renderPdf({
      title: "Rechnung",
      recipient: [firmName, ...(contactName ? [contactName] : []), ...(postalCity ? [postalCity] : [])],
      meta: [
        ["Rechnung Nr.", invoice.invoice_number],
        ["Datum", formatDate(invoice.issue_date)],
        ["Fällig bis", formatDate(invoice.due_date)],
        ["Leistungszeitraum", servicePeriod],
        ["Kunden-Nr.", customerNumber],
      ],
      intro: [salutation, "Für unsere erbrachten Leistungen erlauben wir uns, folgenden Betrag in Rechnung zu stellen:"],
      items: {
        labels: ["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamt"],
        rows: items,
      },
      totals: [
        { label: "Nettobetrag", value: formatCurrency(invoice.net_amount) },
        { label: `USt. (${invoice.vat_rate}%)`, value: formatCurrency(invoice.vat_amount) },
        { label: "Gesamtbetrag", value: formatCurrency(invoice.total_amount), strong: true },
      ],
      closing: ["Mit freundlichen Grüßen", SIGNER_NAME],
    });

  let buffer: Buffer;
  try {
    const docx = renderDocxTemplate("rechnung-template.docx", {
      salutation,
      signer_name: SIGNER_NAME,
      firm_name: firmName,
      firm_department: "",
      contact_name: contactName ?? "",
      firm_address_line: "",
      firm_postal_city: postalCity,
      invoice_number: invoice.invoice_number,
      issue_date: formatDate(invoice.issue_date),
      customer_number: customerNumber,
      service_period: servicePeriod,
      vat_rate: invoice.vat_rate,
      net_amount: formatCurrency(invoice.net_amount),
      vat_amount: formatCurrency(invoice.vat_amount),
      total_amount: formatCurrency(invoice.total_amount),
      due_date: formatDate(invoice.due_date),
      items,
    });
    if (format === "docx") {
      buffer = docx;
    } else if (process.env.CLOUDCONVERT_API_KEY) {
      buffer = await convertDocxToPdf(docx, "invoice.docx").catch(() => buildFallbackPdf());
    } else {
      buffer = await buildFallbackPdf();
    }
  } catch (err) {
    if (format === "pdf") {
      buffer = await buildFallbackPdf();
    } else {
      throw err;
    }
  }

  const filePath = `invoices/${invoice.invoice_number}.${format}`;
  const url = await storeAndSign(
    supabase,
    filePath,
    buffer,
    format,
    `Invoice-${invoice.invoice_number}-${slug(firmName)}.${format}`
  );

  if (format === "docx") {
    await supabase.from("invoices").update({ file_path: filePath }).eq("id", id);
    revalidatePath("/invoices");
  }
  return url;
}
