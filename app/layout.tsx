import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
import { asset } from "@/lib/site";

// Self-hosted via next/font instead of globals.css's old
// @import url(fonts.googleapis.com/...) — that import was measured as a
// 965ms render-blocking request (extra DNS/TLS/round-trip to a third
// origin before the browser even knew which font files to fetch next).
// next/font downloads the font files at build time and serves them from
// this same origin with no runtime request to Google at all. The CSS
// variable names below feed --serif/--sans in globals.css, so nothing
// about which fonts render or how text looks changes.
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });

// Same env var + fallback chain as app/sitemap.ts, app/robots.ts,
// app/api/auth/forgot-password/route.ts and lib/studentAccount.ts — one
// source of truth for the canonical origin.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "The Français Hub · French with direction", template: "%s · The Français Hub" },
  description: "Online French coaching by Yana Budhiraja for TEF, TCF and DELF learners. Small batches of up to four students.",
  icons: { icon: asset("/favicon.svg") },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${instrumentSerif.variable} ${manrope.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
