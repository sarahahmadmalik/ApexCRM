"use server";

import { createClient, getCurrentAppUser } from "@/lib/supabase/server";
import { COUNTRY_NAMES } from "@/lib/data/geo";
import { hasAccess } from "@/lib/permissions";
import { validateMemberPassword } from "@/lib/password";
import { rateLimit, tooManyAttempts } from "@/lib/security";
import { revalidatePath } from "next/cache";

export type ThemePreference = "light" | "dark" | "system";

/** Saves the signed-in user's theme choice on their account, so it follows them to a new device. */
export async function updateThemePreference(theme: ThemePreference) {
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update({ theme_preference: theme }).eq("id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/**
 * Changes the signed-in user's password. Re-authenticates with the current
 * password first (a plain `updateUser` call would work off the existing
 * session alone, but that means anyone at an unlocked, still-logged-in
 * computer could change it without knowing it).
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const appUser = await getCurrentAppUser();
  if (!appUser?.email) throw new Error("Unauthorized");
  const weak = validateMemberPassword(newPassword);
  if (weak) throw new Error(weak);
  if (newPassword === currentPassword) throw new Error("New password must be different from the current one.");

  // Re-checking the current password is a password-guessing oracle for anyone on an unlocked session: throttle it.
  const limited = rateLimit(`chgpw:${appUser.id}`, 5, 15 * 60 * 1000);
  if (!limited.ok) throw new Error(tooManyAttempts(limited.retryAfter));

  const supabase = await createClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: appUser.email,
    password: currentPassword,
  });
  if (reauthError) throw new Error("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/**
 * Lets the signed-in user update their own location on the team roster,
 * without needing the full employee-edit form. Matched by email, the same
 * best-effort link the rest of the profile page uses — there's no formal
 * foreign key between app_users and employees.
 */
export async function updateMyLocation(country: string) {
  const appUser = await getCurrentAppUser();
  if (!appUser?.email) throw new Error("Unauthorized");
  if (!COUNTRY_NAMES.includes(country)) throw new Error("Unrecognized country.");
  if (!hasAccess(appUser.permissions, "employees", "write")) {
    throw new Error("You don't have permission to edit the team roster.");
  }

  const supabase = await createClient();
  const { data: employee, error: lookupError } = await supabase
    .from("employees")
    .select("id")
    .eq("email", appUser.email)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!employee) throw new Error("No employee record is linked to your account yet.");

  const { error } = await supabase.from("employees").update({ country }).eq("id", employee.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/employees");
}
