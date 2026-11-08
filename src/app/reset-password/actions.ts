"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JUST_SIGNED_IN_COOKIE, RESET_VERIFIED_COOKIE, justSignedInCookieOptions } from "@/lib/security";
import { validateMemberPassword } from "@/lib/password";

const EXPIRED = "Your reset session has expired. Request a new code from the login page.";

export async function setNewPassword(_prevState: { error: string }, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const weak = validateMemberPassword(password);
  if (weak) return { error: weak };
  if (password !== confirm) return { error: "Passwords don't match." };

  const jar = await cookies();
  if (!jar.get(RESET_VERIFIED_COOKIE)) return { error: EXPIRED };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: EXPIRED };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Sign out every other device: whoever triggered the reset may not be the
  // person who was already logged in elsewhere.
  await supabase.auth.signOut({ scope: "others" });
  jar.delete(RESET_VERIFIED_COOKIE);
  jar.set(JUST_SIGNED_IN_COOKIE, "1", justSignedInCookieOptions());

  redirect("/overview");
}
