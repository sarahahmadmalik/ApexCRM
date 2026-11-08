import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { firstAccessibleHref, hasAccess, type PageKey } from "@/lib/permissions";

/*
 * Page guards (redirect / 404) for Server Components and action guards (throw)
 * for Server Actions. The UI hides what a user can't use, but these are the
 * checks that actually decide — and RLS in the database (migration 0009)
 * enforces the same rules a third time.
 */

/** For pages: needs at least `level` on `page`, otherwise sends the user somewhere they can open. */
export async function requirePageAccess(page: PageKey, level: "read" | "write" = "read") {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/signout");
  if (!hasAccess(appUser.permissions, page, level)) {
    // Bounce to the first page they do have, so a stale bookmark or the
    // post-login redirect never dead-ends someone who has access elsewhere.
    const fallback = firstAccessibleHref(appUser.permissions);
    redirect(fallback && !fallback.startsWith(`/${page}`) ? fallback : "/no-access");
  }
  return appUser;
}

/** For the admin area: everyone else sees a plain 404 — the page is not advertised to them. */
export async function requireAdminPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/signout");
  if (!appUser.isAdmin) notFound();
  return appUser;
}

/** For Server Actions: throws (surfaced as a toast by the UI) unless the caller has `level` on `page`. */
export async function assertAccess(page: PageKey, level: "read" | "write") {
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("Unauthorized");
  if (!hasAccess(appUser.permissions, page, level)) {
    throw new Error(
      level === "write"
        ? "You have read-only access to this page."
        : "You don't have access to this page."
    );
  }
  return appUser;
}

/** For admin Server Actions. Re-checks against the database on every call — never trusts the client. */
export async function assertAdmin() {
  const appUser = await getCurrentAppUser();
  if (!appUser || !appUser.isAdmin) throw new Error("Only the workspace admin can do this.");
  return appUser;
}
