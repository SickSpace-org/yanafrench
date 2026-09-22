import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
import { asset } from "@/lib/site";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
