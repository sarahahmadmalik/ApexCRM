"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RESET_EMAIL_COOKIE,
  RESET_VERIFIED_COOKIE,
  clientIp,
  rateLimit,
  resetCookieOptions,
  resetRateLimit,
  tooManyAttempts,
} from "@/lib/security";

const WINDOW = 15 * 60 * 1000;
const GENERIC = "That code is incorrect or has expired. Request a new one if needed.";

export async function verifyOtp(_prev: { error: string }, formData: FormData) {
  const jar = await cookies();
  const email = jar.get(RESET_EMAIL_COOKIE)?.value;
  if (!email) redirect("/forgot-password");

  const token = String(formData.get("token") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { error: "Enter the 6-digit code from your email." };

  const ip = await clientIp();
  const acctKey = `otp:acct:${email.toLowerCase()}`;
  const limited = [rateLimit(`otp:ip:${ip}`, 15, WINDOW), rateLimit(acctKey, 5, WINDOW)].find((r) => !r.ok);
  if (limited) return { error: tooManyAttempts(limited.retryAfter) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
  if (error || !data.user) return { error: GENERIC };

  // Same allowlist as sign-in: a valid code for a non-authorized account must
  // not leave a live session behind.
  const { data: appUser } = await supabase.from("app_users").select("id, is_active").eq("id", data.user.id).maybeSingle();
  if (!appUser || !appUser.is_active) {
    await supabase.auth.signOut();
    return { error: GENERIC };
  }

  resetRateLimit(acctKey);
  jar.delete(RESET_EMAIL_COOKIE);
  // Marks this session as one that came through the reset flow; /reset-password
  // and setNewPassword both require it.
  jar.set(RESET_VERIFIED_COOKIE, "1", resetCookieOptions(15 * 60));
  redirect("/reset-password");
}
