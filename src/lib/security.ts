import { headers } from "next/headers";

export * from "./security-core";

/** Best-effort client IP from the proxy headers (used only as a rate-limit key). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
