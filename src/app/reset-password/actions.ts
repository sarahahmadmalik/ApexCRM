"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RESET_VERIFIED_COOKIE } from "@/lib/security";

const EXPIRED = "Your reset session has expired. Request a new code from the login page.";

export async function setNewPassword(_prevState: { error: string }, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password.length > 72) return { error: "Password must be 72 characters or fewer." };
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

  redirect("/overview");
}
