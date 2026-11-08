import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// 'unsafe-inline' scripts are needed for Next's bootstrap and the theme
// no-flash script; the rest of the policy (no framing, no plugins, same-origin
// forms/base, Supabase-only connections) still blocks the common injection routes.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dashboard was renamed to Overview — keep old links and bookmarks working.
  async redirects() {
    return [{ source: "/dashboard", destination: "/overview", permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Never cache pages in the reset flow.
      {
        source: "/(login|forgot-password|verify-otp|reset-password)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  // The docx templates in /templates are read from disk at request time
  // (Angebot, Rechnung/invoice, and contract generation) — make sure
  // serverless deployments (e.g. Vercel) bundle them with the functions
  // that use them.
  outputFileTracingIncludes: {
    "/offers/*": ["./templates/**/*"],
    "/invoices/*": ["./templates/**/*"],
    "/employees/*": ["./templates/**/*"],
    "/contracts/*": ["./templates/**/*"],
  },
};

export default nextConfig;
