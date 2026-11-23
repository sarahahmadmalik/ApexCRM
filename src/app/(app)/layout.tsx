import { cookies } from "next/headers";
import { AppShell } from "@/components/nav/app-shell";
import { SiteLoader } from "@/components/ui/site-loader";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { aiConfigured } from "@/lib/ai/openrouter";
import { JUST_SIGNED_IN_COOKIE } from "@/lib/security";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const appUser = await getCurrentAppUser();
  // Signed in but not (or no longer) allowed: end the session instead of looping through /login.
  if (!appUser) redirect("/auth/signout");

  // Every full load plays the logo loader. Right after signing in (a flag the sign-in / reset actions set for a
  // few seconds) it runs longer with a welcome line.
  const justSignedIn = (await cookies()).get(JUST_SIGNED_IN_COOKIE)?.value === "1";
  const firstName = appUser.full_name.trim().split(/\s+/)[0];

  return (
    <>
      <SiteLoader showcase={justSignedIn} caption={justSignedIn ? `Welcome back, ${firstName}` : "Loading your workspace"} />
      <AppShell
        userName={appUser.full_name}
        companyRole={appUser.role}
        accountRole={appUser.account_role}
        workspaceName={appUser.workspaceName}
        permissions={appUser.permissions}
        userEmail={appUser.email ?? ""}
        aiEnabled={aiConfigured()}
        assistantPlacement={appUser.assistant_placement ?? "header"}
      >
        {children}
      </AppShell>
    </>
  );
}
