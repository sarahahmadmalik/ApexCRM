"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { clientIp, rateLimit, resetRateLimit, tooManyAttempts } from "@/lib/security";

const WINDOW = 15 * 60 * 1000;
const emailSchema = z.string().max(254).pipe(z.email());

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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
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
  redirect("/overview");
}
