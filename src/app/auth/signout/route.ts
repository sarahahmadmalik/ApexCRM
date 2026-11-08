import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends the session and lands on /login. Used when someone is signed in but no
 * longer allowed in (e.g. the admin deactivated the account) — the app layout
 * can't clear cookies while rendering, and bouncing to /login directly would
 * loop, because /login sends signed-in users back to the dashboard.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
