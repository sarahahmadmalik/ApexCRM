import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/guards";
import { permissionsFromRows, fullPermissions } from "@/lib/permissions";
import { AdminPanel } from "@/components/admin/admin-panel";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { MemberRow } from "@/components/admin/member-form-drawer";

export const metadata = { title: "User Management · Dua Dev Internal Tool" };

export default async function AdminPage() {
  // 404 for anyone who isn't the workspace admin.
  const admin = await requireAdminPage();
  const supabase = await createClient();

  const [{ data: users, error }, { data: permissionRows }] = await Promise.all([
    supabase.from("app_users").select("*").eq("workspace_id", admin.workspace_id).order("created_at"),
    supabase.from("user_permissions").select("user_id, page, access"),
  ]);
  if (error) return <ErrorNotice message={error.message} />;

  // Emails live in Supabase Auth, not in app_users — fetched with the service key.
  const emails = new Map<string, string>();
  try {
    const { data, error: listError } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listError) throw new Error(/invalid api key/i.test(listError.message)
      ? "The server's SUPABASE_SECRET_KEY is invalid. Copy the secret key from Supabase (Project Settings -> API Keys) into your environment and restart the server."
      : listError.message);
    data.users.forEach((u) => emails.set(u.id, u.email ?? ""));
  } catch (err) {
    return <ErrorNotice message={err instanceof Error ? err.message : "Couldn't load members."} />;
  }

  const members: MemberRow[] = (users ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: emails.get(u.id) ?? "",
    role: u.role,
    accountRole: u.account_role,
    isActive: u.is_active,
    permissions:
      u.account_role === "admin"
        ? fullPermissions()
        : permissionsFromRows((permissionRows ?? []).filter((r) => r.user_id === u.id)),
    createdAt: u.created_at,
  }));

  // Admin first, then by join date.
  members.sort((a, b) => Number(b.accountRole === "admin") - Number(a.accountRole === "admin"));

  return <AdminPanel workspaceName={admin.workspaceName} members={members} currentUserId={admin.id} />;
}
