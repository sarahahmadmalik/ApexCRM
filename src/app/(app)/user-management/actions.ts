"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePermissions, permissionsToRows } from "@/lib/permissions";
import { validateMemberPassword } from "@/lib/password";

/*
 * Member management. Every action re-verifies, against the database, that the
 * caller is the workspace admin (assertAdmin) BEFORE touching the service-role
 * client — the client-side checks are convenience only. Members are always
 * created with account_role 'user', and `permissions` is validated against the
 * known page list, so neither the admin role nor the /admin page can be handed
 * to anyone through these actions.
 */

const nameSchema = z.string().trim().min(2, "Enter the member's full name.").max(80, "Name is too long.");
const roleSchema = z.string().trim().min(2, "Enter their position in the company.").max(60, "Position is too long.");
const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address."));

/** Turns a Supabase Admin API failure into something an admin can act on. */
function fail(message: string): never {
  if (/invalid api key|jwt|apikey/i.test(message)) {
    throw new Error("The server's SUPABASE_SECRET_KEY is missing or invalid. Copy the secret key from Supabase (Project Settings -> API Keys) into your environment and restart.");
  }
  throw new Error(message);
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export type MemberInput = {
  fullName: string;
  email: string;
  /** Company position (CTO, Designer, ...) — free text. */
  role: string;
  password: string;
  permissions: Record<string, string>;
};

type Service = ReturnType<typeof createAdminClient>;

/** Loads a member of the admin's own workspace; refuses the admin account itself. */
async function loadMember(svc: Service, id: string, workspaceId: string) {
  if (!z.uuid().safeParse(id).success) throw new Error("Member not found.");
  const { data, error } = await svc
    .from("app_users")
    .select("id, account_role, workspace_id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) fail(error.message);
  if (!data) throw new Error("Member not found.");
  if (data.account_role === "admin") throw new Error("The admin account can't be changed here.");
  return data;
}

async function savePermissions(svc: Service, userId: string, permissions: Record<string, string>) {
  const perms = parsePermissions(permissions);
  const rows = permissionsToRows(userId, perms);

  if (rows.length > 0) {
    const { error } = await svc.from("user_permissions").upsert(rows, { onConflict: "user_id,page" });
    if (error) fail(error.message);
  }
  const keep = rows.map((r) => r.page);
  let cleanup = svc.from("user_permissions").delete().eq("user_id", userId);
  if (keep.length > 0) cleanup = cleanup.not("page", "in", `(${keep.join(",")})`);
  const { error: cleanupError } = await cleanup;
  if (cleanupError) fail(cleanupError.message);
}

export async function createMember(input: MemberInput) {
  const admin = await assertAdmin();

  const name = nameSchema.safeParse(input.fullName);
  if (!name.success) throw new Error(firstError(name.error));
  const role = roleSchema.safeParse(input.role);
  if (!role.success) throw new Error(firstError(role.error));
  const email = emailSchema.safeParse(input.email);
  if (!email.success) throw new Error(firstError(email.error));
  const passwordError = validateMemberPassword(input.password);
  if (passwordError) throw new Error(passwordError);
  parsePermissions(input.permissions); // fail early, before creating anything

  const svc = createAdminClient();

  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email: email.data,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: name.data },
  });
  if (createError || !created.user) {
    const message = createError?.message ?? "Couldn't create the account.";
    if (/already|registered|exists/i.test(message)) throw new Error("An account with this email already exists.");
    fail(message);
  }
  const userId = created.user.id;

  try {
    const { error: rowError } = await svc.from("app_users").insert({
      id: userId,
      full_name: name.data,
      role: role.data,
      workspace_id: admin.workspace_id,
      account_role: "user",
      is_active: true,
    });
    if (rowError) fail(rowError.message);
    await savePermissions(svc, userId, input.permissions);
  } catch (err) {
    // Don't leave an orphaned login behind if the profile/permissions failed.
    await svc.auth.admin.deleteUser(userId);
    throw err;
  }

  revalidatePath("/user-management");
}

export async function updateMember(
  id: string,
  input: { fullName: string; role: string; isActive: boolean; permissions: Record<string, string> }
) {
  const admin = await assertAdmin();
  const svc = createAdminClient();
  await loadMember(svc, id, admin.workspace_id);

  const name = nameSchema.safeParse(input.fullName);
  if (!name.success) throw new Error(firstError(name.error));
  const role = roleSchema.safeParse(input.role);
  if (!role.success) throw new Error(firstError(role.error));
  parsePermissions(input.permissions);

  const { error } = await svc
    .from("app_users")
    .update({ full_name: name.data, role: role.data, is_active: !!input.isActive })
    .eq("id", id);
  if (error) fail(error.message);

  // Deactivating also bans the login, so a refresh token can't mint new sessions.
  const { error: banError } = await svc.auth.admin.updateUserById(id, {
    ban_duration: input.isActive ? "none" : "876000h",
  });
  if (banError) fail(banError.message);

  await savePermissions(svc, id, input.permissions);
  revalidatePath("/user-management");
}

export async function resetMemberPassword(id: string, password: string) {
  const admin = await assertAdmin();
  const svc = createAdminClient();
  await loadMember(svc, id, admin.workspace_id);

  const passwordError = validateMemberPassword(password);
  if (passwordError) throw new Error(passwordError);

  const { error } = await svc.auth.admin.updateUserById(id, { password });
  if (error) fail(error.message);
}

export async function deleteMember(id: string) {
  const admin = await assertAdmin();
  const svc = createAdminClient();
  await loadMember(svc, id, admin.workspace_id);

  // Cascades to app_users and user_permissions; records they created stay (created_by is set null).
  const { error } = await svc.auth.admin.deleteUser(id);
  if (error) fail(error.message);
  revalidatePath("/user-management");
}

export async function renameWorkspace(name: string) {
  const admin = await assertAdmin();
  const parsed = z.string().trim().min(1, "Enter a workspace name.").max(80, "Name is too long.").safeParse(name);
  if (!parsed.success) throw new Error(firstError(parsed.error));

  const svc = createAdminClient();
  const { error } = await svc.from("workspaces").update({ name: parsed.data }).eq("id", admin.workspace_id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
}
