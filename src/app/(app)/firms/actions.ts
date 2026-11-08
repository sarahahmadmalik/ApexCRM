"use server";

import { createClient } from "@/lib/supabase/server";
import type { FirmStatus } from "@/lib/types/database";
import { findStateForCity } from "@/lib/data/geo";
import { assertAccess } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

export type FirmInput = {
  name: string;
  country: string;
  state: string;
  city: string;
  status: FirmStatus;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
};

function assertValid(input: FirmInput) {
  if (!input.name.trim()) throw new Error("Firm name is required.");
  if (!input.country || !input.state || !input.city) {
    throw new Error("Country, state and city are required.");
  }
}

export async function createFirm(input: FirmInput) {
  const appUser = await assertAccess("firms", "write");
  assertValid(input);

  const supabase = await createClient();
  const { error } = await supabase.from("firms").insert({ ...input, created_by: appUser.id });
  if (error) throw new Error(error.message);

  revalidatePath("/firms");
  revalidatePath("/overview");
  revalidatePath("/cities");
}

export async function updateFirm(id: string, input: FirmInput) {
  await assertAccess("firms", "write");
  assertValid(input);

  const supabase = await createClient();
  const { error } = await supabase.from("firms").update(input).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/firms");
  revalidatePath("/overview");
  revalidatePath("/cities");
}

export async function updateFirmStatus(id: string, status: FirmStatus) {
  await assertAccess("firms", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("firms").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/firms");
  revalidatePath("/overview");
  revalidatePath("/cities");
}

export async function deleteFirm(id: string) {
  await assertAccess("firms", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("firms").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/firms");
  revalidatePath("/overview");
  revalidatePath("/cities");
}

/** Sets the same status on every selected firm in one request — powers the firms table's bulk-select toolbar. */
export async function bulkUpdateFirmStatus(ids: string[], status: FirmStatus) {
  await assertAccess("firms", "write");
  if (ids.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("firms").update({ status }).in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePath("/firms");
  revalidatePath("/overview");
  revalidatePath("/cities");
}

/** Removes every selected firm in one request — powers the firms table's bulk-select toolbar. */
export async function bulkDeleteFirms(ids: string[]) {
  await assertAccess("firms", "write");
  if (ids.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("firms").delete().in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePath("/firms");
  revalidatePath("/overview");
  revalidatePath("/cities");
}

export type CompanyLookupResult = {
  name: string;
  domain: string;
  website: string;
  logo: string | null;
};

/**
 * Looks up a company by name against Clearbit's public autocomplete
 * endpoint — free, no API key, no rate-limit auth needed. It only returns a
 * company's name, domain and logo, so this can fill in the firm name and
 * website; it can't supply a street address, phone number or contact
 * person, since no free API provides those without a paid key.
 */
export async function lookupCompany(query: string): Promise<CompanyLookupResult[]> {
  await assertAccess("firms", "write");

  const q = query.trim();
  if (q.length < 2) return [];

  let response: Response;
  try {
    response = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(4500),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Couldn't reach the company lookup service. It may be blocked on this network.");
  }
  if (!response.ok) throw new Error("Company lookup is unavailable right now. Fill in the details by hand.");

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Company lookup returned something unexpected. Fill in the details by hand.");
  }
  if (!Array.isArray(data)) return [];

  return (data as { name?: string; domain?: string; logo?: string | null }[])
    .filter((c): c is { name: string; domain: string; logo: string | null } => !!c.name && !!c.domain)
    .slice(0, 6)
    .map((c) => ({ name: c.name, domain: c.domain, website: `https://${c.domain}`, logo: c.logo ?? null }));
}

export type BulkImportRow = {
  name: string;
  country: string;
  city: string;
  /** Optional — auto-resolved from `country` + `city` against the known city list when omitted. */
  state?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  status?: FirmStatus;
  notes?: string;
};

export type BulkImportResult = {
  inserted: number;
  skipped: { row: number; name: string; reason: string }[];
};

const VALID_STATUSES: FirmStatus[] = ["not_started", "in_progress", "sent", "responded", "negotiation", "client"];

/**
 * Bulk-inserts firms from a parsed CSV/paste. Chosen over a hand-authored
 * one-off SQL dump for large source lists: a person types the source data
 * once (an export, not a re-transcription), the state is resolved against
 * our own known-city list rather than guessed, and bad rows are reported
 * back instead of silently corrupting contact data.
 */
export async function bulkImportFirms(rows: BulkImportRow[]): Promise<BulkImportResult> {
  const appUser = await assertAccess("firms", "write");
  if (rows.length === 0) return { inserted: 0, skipped: [] };
  if (rows.length > 5000) throw new Error("Import is limited to 5,000 rows at a time. Split the file and import in batches.");

  const skipped: BulkImportResult["skipped"] = [];
  const toInsert: (FirmInput & { created_by: string })[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 1;
    const name = row.name?.trim();
    const country = row.country?.trim();
    const city = row.city?.trim();
    if (!name) return skipped.push({ row: rowNum, name: name || "(blank)", reason: "Missing firm name" });
    if (!country) return skipped.push({ row: rowNum, name, reason: "Missing country" });
    if (!city) return skipped.push({ row: rowNum, name, reason: "Missing city" });

    const state = row.state?.trim() || findStateForCity(country, city);
    if (!state) {
      return skipped.push({
        row: rowNum,
        name,
        reason: `Couldn't match "${city}" to a known state in ${country} — add a state column or check the spelling`,
      });
    }

    const status = row.status && VALID_STATUSES.includes(row.status) ? row.status : "not_started";

    toInsert.push({
      name,
      country,
      state,
      city,
      status,
      contact_name: row.contact_name?.trim() || undefined,
      contact_email: row.contact_email?.trim() || undefined,
      contact_phone: row.contact_phone?.trim() || undefined,
      website: row.website?.trim() || undefined,
      notes: row.notes?.trim() || undefined,
      created_by: appUser.id,
    });
  });

  if (toInsert.length === 0) return { inserted: 0, skipped };

  const supabase = await createClient();
  const CHUNK_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("firms").insert(chunk);
    if (error) throw new Error(`Import stopped after ${inserted} firms: ${error.message}`);
    inserted += chunk.length;
  }

  revalidatePath("/firms");
  revalidatePath("/overview");
  revalidatePath("/cities");

  return { inserted, skipped };
}

/** Status changes for one firm, newest first — shown in the firm details drawer. */
export async function getFirmStatusHistory(firmId: string) {
  await assertAccess("firms", "read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("firm_status_history_feed")
    .select("*")
    .eq("firm_id", firmId)
    .order("changed_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data ?? [];
}
