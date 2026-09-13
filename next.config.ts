import type { NextConfig } from "next";

// Applied in production only. Next.js dev (Turbopack HMR, React Refresh)
// relies on eval and injects things a strict CSP would block — rather than
// fight that, local `next dev` stays exactly as it is today so this never
// affects local testing.
const isProd = process.env.NODE_ENV === "production";

// script-src/style-src need 'unsafe-inline': Next.js's own hydration
// scripts, and this codebase's extensive use of style={{...}} (progress
// bars, waveforms, dynamic widths) both require it. A stricter nonce-based
// CSP is possible but needs a per-request nonce threaded through proxy.ts —
// real extra surface, left as a future hardening step.
//
// Razorpay and R2 get wildcard subdomains rather than enumerated exact
// hosts: Razorpay's checkout touches several of its own subdomains during
// a real payment, and an incomplete enumerated list would silently break
// checkout — the actual cost of getting this wrong.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.r2.dev https://*.razorpay.com",
  "media-src 'self' https://*.r2.dev",
  "connect-src 'self' https://*.supabase.co https://*.razorpay.com https://api.mymemory.translated.net",
  "frame-src https://www.youtube.com https://player.vimeo.com https://*.razorpay.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera/microphone: (self) — Speaking Practice needs mic access.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    if (!isProd) return [];
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
