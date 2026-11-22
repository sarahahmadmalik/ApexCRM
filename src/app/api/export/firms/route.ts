import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentAppUser } from "@/lib/supabase/server";
import { hasAccess } from "@/lib/permissions";
import { FIRM_STATUS_LABELS } from "@/lib/utils";
import type { FirmStatus } from "@/lib/types/database";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Leadership-only spreadsheet export of the firms table, honouring the same
 * filters as the Firms page. Served as UTF-8 CSV with a byte-order mark so
 * Excel opens it directly with accented city names (Düsseldorf, Malmö) intact.
 */
export async function GET(request: NextRequest) {
  const appUser = await getCurrentAppUser();
  if (!appUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!hasAccess(appUser.permissions, "firms")) {
    return NextResponse.json({ error: "You don't have access to firms." }, { status: 403 });
  }
  const supabase = await createClient();

  const params = request.nextUrl.searchParams;
  let query = supabase
    .from("firms")
    .select("name, country, state, city, status, contact_name, contact_email, contact_phone, notes, created_at")
    .order("country")
    .order("city")
    .order("name");

  const q = params.get("q");
  const country = params.get("country");
  const state = params.get("state");
  const city = params.get("city");
  const status = params.get("status");

  if (q) query = query.ilike("name", `%${q}%`);
  if (country) query = query.in("country", country.split(","));
  if (state) query = query.in("state", state.split(","));
  if (city) query = query.in("city", city.split(","));
  if (status) query = query.in("status", status.split(",") as FirmStatus[]);

  const { data: firms, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    "Name",
    "Country",
    "State",
    "City",
    "Status",
    "Contact name",
    "Contact email",
    "Contact phone",
    "Notes",
    "Created at",
  ];
  const rows = (firms ?? []).map((f) =>
    [
      f.name,
      f.country,
      f.state,
      f.city,
      FIRM_STATUS_LABELS[f.status] ?? f.status,
      f.contact_name,
      f.contact_email,
      f.contact_phone,
      f.notes,
      f.created_at ? new Date(f.created_at).toISOString().slice(0, 10) : "",
    ]
      .map(csvEscape)
      .join(",")
  );

  const csv = "﻿" + [header.join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="apexcrm-firms-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
