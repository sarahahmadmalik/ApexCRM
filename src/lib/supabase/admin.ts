import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Service-role Supabase client — bypasses RLS and can manage auth users.
 *
 * SERVER ONLY. Never import this from a Client Component, and never expose
 * SUPABASE_SECRET_KEY to the browser (it has no NEXT_PUBLIC_ prefix, so Next
 * will not inline it into client bundles). Every caller must first prove the
 * current user is a workspace admin — see `assertAdmin()` in
 * src/lib/auth/guards.ts.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Member management isn't configured: SUPABASE_SECRET_KEY is missing on the server.");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
