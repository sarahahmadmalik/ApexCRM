import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { effectivePermissions, noPermissions, permissionsFromRows } from "@/lib/permissions";
import type { Database } from "@/lib/types/database";

/** Supabase client for use in Server Components, Server Actions, and Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore because
            // middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}

/**
 * Current user's app_users row plus everything the UI/guards need (email,
 * workspace, effective page permissions) — or null if not signed in, not
 * allowlisted, or deactivated by the admin.
 *
 * Wrapped in `cache` so the layout, the page and any server action in the same
 * request share a single lookup.
 */
export const getCurrentAppUser = cache(async () => {
  try {
    const supabase = await createClient();
    // The proxy already validated the session with the auth server on this request, so here the token
    // only needs its signature checked locally (getClaims) instead of paying a second network round trip.
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError) return null;
    const claims = claimsData?.claims;
    if (!claims?.sub) return null;
    const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };

    // Independent lookups: run them side by side (one round trip instead of two).
    const [{ data: appUser, error: userError }, { data: permissionRows }] = await Promise.all([
      supabase.from("app_users").select("*, workspaces(name)").eq("id", user.id).maybeSingle(),
      supabase.from("user_permissions").select("page, access").eq("user_id", user.id),
    ]);

    if (userError || !appUser || !appUser.is_active) return null;

    const isAdmin = appUser.account_role === "admin";
    const stored = isAdmin ? noPermissions() : permissionsFromRows(permissionRows ?? []);

    const { workspaces, ...row } = appUser as typeof appUser & { workspaces: { name: string } | null };
    return {
      ...row,
      email: user.email,
      isAdmin,
      workspaceName: workspaces?.name ?? "Workspace",
      permissions: effectivePermissions(row.account_role, stored),
    };
  } catch {
    return null;
  }
});
