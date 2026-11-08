// Pure helpers (no Next.js imports) so they can be unit-tested in plain Node.
type Bucket = { count: number; resetAt: number };

// Best-effort, per-server-instance limiter. On serverless each instance keeps
// its own counters, so this slows automated guessing but is not a hard global
// cap — Supabase Auth applies its own project-wide rate limits on sign-in,
// OTP sending and OTP verification, which is the real backstop.
const buckets = new Map<string, Bucket>();

/** Counts one attempt against `key`. Returns ok=false once `limit` is exceeded within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function tooManyAttempts(retryAfterSeconds: number) {
  const mins = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

/**
 * Accepts only same-site relative paths ("/overview"). Anything else —
 * absolute URLs, protocol-relative "//evil.com", "/\evil.com", "@evil.com" —
 * falls back, which closes the open-redirect hole on `?next=`.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/overview") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export const RESET_EMAIL_COOKIE = "reset_email";
export const RESET_VERIFIED_COOKIE = "reset_verified";

/** Short-lived, httpOnly cookie options for the password-reset flow. */
export function resetCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
