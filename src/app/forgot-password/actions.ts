"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RESET_EMAIL_COOKIE,
  clientIp,
  rateLimit,
  resetCookieOptions,
  tooManyAttempts,
} from "@/lib/security";

const emailSchema = z.string().max(254).pipe(z.email());
const OTP_COOKIE_TTL = 15 * 60;

/** Sends the one-time code. Same response whether or not the account exists. */
async function sendCode(email: string) {
  const supabase = await createClient();
  // Errors (unknown email, Supabase's own send throttle) are deliberately not
  // surfaced: the caller always sees the same neutral outcome, so this can't be
  // used to discover which emails have an account.
  await supabase.auth.resetPasswordForEmail(email);
}

export async function requestPasswordReset(_prev: { error: string; email: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  if (!email) return { error: "Enter your email address.", email };
  if (!emailSchema.safeParse(email).success) return { error: "Enter a valid email address.", email };

  const ip = await clientIp();
  const limited = [
    rateLimit(`reset:ip:${ip}`, 10, 15 * 60 * 1000),
    rateLimit(`reset:acct:${email.toLowerCase()}`, 3, 15 * 60 * 1000),
  ].find((r) => !r.ok);
  if (limited) return { error: tooManyAttempts(limited.retryAfter), email };

  await sendCode(email);

  // The email lives in an httpOnly cookie (not the URL) so it isn't leaked via
  // history, logs or Referer headers, and can't be swapped mid-flow by the client.
  (await cookies()).set(RESET_EMAIL_COOKIE, email, resetCookieOptions(OTP_COOKIE_TTL));
  redirect("/verify-otp");
}

/** Sends a fresh code to the email already in the reset cookie. */
export async function resendOtp(_prev: { message: string; error: string; n: number }, _formData: FormData) {
  void _formData;
  const n = _prev.n + 1;
  const email = (await cookies()).get(RESET_EMAIL_COOKIE)?.value;
  if (!email) redirect("/forgot-password");

  const ip = await clientIp();
  const limited = [
    rateLimit(`resend:ip:${ip}`, 10, 15 * 60 * 1000),
    rateLimit(`resend:acct:${email.toLowerCase()}`, 3, 15 * 60 * 1000),
  ].find((r) => !r.ok);
  if (limited) return { message: "", error: tooManyAttempts(limited.retryAfter), n };

  await sendCode(email);
  return { message: "If that email has an account, a new code is on its way.", error: "", n };
}
