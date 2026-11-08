import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RESET_VERIFIED_COOKIE } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  // Only reachable right after a verified code — otherwise start over.
  const verified = (await cookies()).get(RESET_VERIFIED_COOKIE);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!verified || !user) redirect("/forgot-password");

  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
