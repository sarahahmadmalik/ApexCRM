"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAGE_KEYS } from "@/lib/permissions";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JUST_SIGNED_IN_COOKIE, clientIp, justSignedInCookieOptions, rateLimit, resetRateLimit, tooManyAttempts } from "@/lib/security";

const WINDOW = 15 * 60 * 1000;
const emailSchema = z.string().max(254).pipe(z.email());
const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-00000000d0a0";

const SAMPLE_LOGINS: Record<
  string,
  {
    password: string;
    fullName: string;
    role: string;
    accountRole: "admin" | "user";
    pages?: (typeof PAGE_KEYS)[number][];
  }
> = {
  "demo@apexcrm.io": {
    password: "ApexDemo2026!",
    fullName: "Alex Vance",
    role: "VP of Operations",
    accountRole: "admin",
  },
  "team@apexcrm.io": {
    password: "ApexTeam2026!",
    fullName: "Maya Lin",
    role: "Project & Delivery Lead",
    accountRole: "user",
  },
  "employee@apexcrm.io": {
    password: "ApexStaff2026!",
    fullName: "Lukas Weber",
    role: "Senior Full-Stack Engineer",
    accountRole: "user",
    pages: ["time_leave", "projects", "expenses"],
  },
};

async function ensureSampleLoginProvisioned(email: string, password: string) {
  const sample = SAMPLE_LOGINS[email.toLowerCase()];
  if (!sample || sample.password !== password || !process.env.SUPABASE_SECRET_KEY) return false;

  try {
    const svc = createAdminClient();
    await svc
      .from("workspaces")
      .upsert({ id: DEFAULT_WORKSPACE_ID, name: "ApexCRM Enterprise" }, { onConflict: "id" });

    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email: email.toLowerCase(),
      password: sample.password,
      email_confirm: true,
      user_metadata: { full_name: sample.fullName },
    });

    let userId = created?.user?.id;
    if (!userId && createError) {
      const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        userId = existing.id;
        await svc.auth.admin.updateUserById(userId, { password: sample.password, email_confirm: true });
      }
    }
    if (!userId) return false;

    if (sample.accountRole === "admin") {
      await svc
        .from("app_users")
        .update({ account_role: "user" })
        .eq("workspace_id", DEFAULT_WORKSPACE_ID)
        .eq("account_role", "admin")
        .neq("id", userId);
    }

    await svc.from("app_users").upsert(
      {
        id: userId,
        full_name: sample.fullName,
        role: sample.role,
        workspace_id: DEFAULT_WORKSPACE_ID,
        account_role: sample.accountRole,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (sample.accountRole === "user") {
      const allowedPages = sample.pages ?? PAGE_KEYS;
      await svc.from("user_permissions").delete().eq("user_id", userId);
      await svc.from("user_permissions").upsert(
        allowedPages.map((page) => ({ user_id: userId, page, access: "write" as const })),
        { onConflict: "user_id,page" }
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function login(_prevState: { error: string; email: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }
  // Same message as a wrong password, so malformed input reveals nothing extra.
  if (!emailSchema.safeParse(email).success || password.length > 256) {
    return { error: "Invalid email or password.", email };
  }

  const ip = await clientIp();
  const acctKey = `login:acct:${email.toLowerCase()}`;
  const limited = [rateLimit(`login:ip:${ip}`, 20, WINDOW), rateLimit(acctKey, 5, WINDOW)].find((r) => !r.ok);
  if (limited) return { error: tooManyAttempts(limited.retryAfter), email };

  const supabase = await createClient();

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error && (await ensureSampleLoginProvisioned(email, password))) {
    const retry = await supabase.auth.signInWithPassword({ email, password });
    data = retry.data;
    error = retry.error;
  }
  if (error || !data.user) {
    return { error: "Invalid email or password.", email };
  }

  // Only CEO / CTO accounts registered in app_users may use this tool.
  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  // Unknown account, or one the admin has deactivated.
  if (!appUser || !appUser.is_active) {
    await supabase.auth.signOut();
    return { error: "This account isn't authorized for the internal tool.", email };
  }

  resetRateLimit(acctKey);
  (await cookies()).set(JUST_SIGNED_IN_COOKIE, "1", justSignedInCookieOptions());
  if (email.toLowerCase() === "employee@apexcrm.io") {
    redirect("/time-leave");
  }
  redirect("/overview");
}
