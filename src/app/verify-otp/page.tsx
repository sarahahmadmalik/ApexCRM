import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RESET_EMAIL_COOKIE } from "@/lib/security";
import { VerifyOtpForm } from "./verify-otp-form";

/** "sarah@dua-dev.com" -> "sa***@dua-dev.com" */
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export default async function VerifyOtpPage() {
  const email = (await cookies()).get(RESET_EMAIL_COOKIE)?.value;
  if (!email) redirect("/forgot-password");

  return (
    <AuthShell>
      <VerifyOtpForm maskedEmail={maskEmail(email)} />
    </AuthShell>
  );
}
