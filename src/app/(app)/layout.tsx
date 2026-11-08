import { AppShell } from "@/components/nav/app-shell";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const appUser = await getCurrentAppUser();
  // Signed in but not (or no longer) allowed — end the session instead of looping through /login.
  if (!appUser) redirect("/auth/signout");

  return (
    <AppShell
      userName={appUser.full_name}
      companyRole={appUser.role}
      accountRole={appUser.account_role}
      workspaceName={appUser.workspaceName}
      permissions={appUser.permissions}
      userEmail={appUser.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
