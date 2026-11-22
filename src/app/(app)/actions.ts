"use server";

import { createClient, getCurrentAppUser } from "@/lib/supabase/server";
import { hasAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type GlobalSearchResult = {
  type: "firm" | "employee" | "city" | "offer" | "invoice" | "contract" | "candidate" | "project";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/**
 * Powers the topbar's global search — every table in the tool, searched on
 * the backend: firms and employees by name, offers and invoices by their
 * document number, contracts by the employee they belong to, plus cities
 * from the static geo list.
 */
export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const appUser = await getCurrentAppUser();
  if (!appUser) return [];
  const can = (page: Parameters<typeof hasAccess>[1]) => hasAccess(appUser.permissions, page);
  const supabase = await createClient();
  const none = Promise.resolve({ data: [] as never[] });

  // Only search the areas this user can open (RLS would filter them anyway;
  // this also stops suggesting links to pages they'd be redirected away from).
  const [firms, employees, offers, invoices, contracts, candidates, projects] = await Promise.all([
    can("firms")
      ? supabase.from("firms").select("id, name, city, country").ilike("name", `%${q}%`).limit(5)
      : none,
    can("employees")
      ? supabase.from("employees").select("id, full_name, position").ilike("full_name", `%${q}%`).limit(5)
      : none,
    can("offers")
      ? supabase
          .from("angebots")
          .select("id, angebot_number, status, firms(name)")
          .ilike("angebot_number", `%${q}%`)
          .limit(5)
      : none,
    can("invoices")
      ? supabase
          .from("invoices")
          .select("id, invoice_number, status, firms(name)")
          .ilike("invoice_number", `%${q}%`)
          .limit(5)
      : none,
    can("contracts")
      ? supabase
          .from("contracts")
          .select("id, status, employees!inner(full_name)")
          .ilike("employees.full_name", `%${q}%`)
          .limit(5)
      : none,
    can("hiring")
      ? supabase.from("job_candidates").select("id, full_name, stage").ilike("full_name", `%${q}%`).limit(4)
      : none,
    can("projects")
      ? supabase.from("projects").select("id, name, client_name").ilike("name", `%${q}%`).limit(4)
      : none,
  ]);

  const results: GlobalSearchResult[] = [];

  (firms.data ?? []).forEach((f) =>
    results.push({ type: "firm", id: f.id, title: f.name, subtitle: `${f.city}, ${f.country}`, href: `/firms?q=${encodeURIComponent(f.name)}` })
  );
  (employees.data ?? []).forEach((e) =>
    results.push({ type: "employee", id: e.id, title: e.full_name, subtitle: e.position ?? "Employee", href: `/employees?q=${encodeURIComponent(e.full_name)}` })
  );
  (offers.data ?? []).forEach((o) => {
    const firmName = (o as unknown as { firms: { name: string } | null }).firms?.name ?? "No firm";
    results.push({ type: "offer", id: o.id, title: o.angebot_number, subtitle: `Offer for ${firmName}`, href: `/offers?q=${encodeURIComponent(o.angebot_number)}` });
  });
  (invoices.data ?? []).forEach((inv) => {
    const firmName = (inv as unknown as { firms: { name: string } | null }).firms?.name ?? "No firm";
    results.push({ type: "invoice", id: inv.id, title: inv.invoice_number, subtitle: `Invoice for ${firmName}`, href: `/invoices?q=${encodeURIComponent(inv.invoice_number)}` });
  });
  (contracts.data ?? []).forEach((c) => {
    const employeeName = (c as unknown as { employees: { full_name: string } | null }).employees?.full_name ?? "Employee";
    results.push({ type: "contract", id: c.id, title: `${employeeName}'s contract`, subtitle: c.status === "final" ? "Document ready" : "Template pending", href: `/contracts?q=${encodeURIComponent(employeeName)}` });
  });
  (candidates.data ?? []).forEach((cand) => {
    results.push({
      type: "candidate",
      id: cand.id,
      title: cand.full_name,
      subtitle: `Candidate · ${cand.stage}`,
      href: "/hiring",
    });
  });
  (projects.data ?? []).forEach((proj) => {
    results.push({
      type: "project",
      id: proj.id,
      title: proj.name,
      subtitle: proj.client_name ? `Project for ${proj.client_name}` : "Project",
      href: "/projects",
    });
  });

  const cityMatches = !can("firms")
    ? []
    : Array.from(
    new Set(
      (await import("@/lib/data/geo")).ALL_CITIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).map((c) => c.label)
    )
  ).slice(0, 4);
  cityMatches.forEach((label, i) => {
    const [city] = label.split(",");
    results.push({ type: "city", id: `city-${i}`, title: city, subtitle: label, href: `/firms?city=${encodeURIComponent(city)}` });
  });

  return results;
}
