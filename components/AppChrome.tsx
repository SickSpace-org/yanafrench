"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { ReactNode } from "react";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { GA_MEASUREMENT_ID } from "@/lib/site";

// Pulls in @ai-sdk/react + ai's client runtime, which was part of every
// page's initial JS bundle (via this chrome, rendered everywhere) despite
// the widget itself opening closed and most visits never touching it.
// ssr:false + no loading fallback: it's a floating button with no
// content/SEO value in its closed state, so deferring its chunk (and
// skipping server-rendering it at all) doesn't change what's visible —
// only when its JS actually loads.
const ChatWidget = dynamic(() => import("./ChatWidget").then((m) => m.ChatWidget), { ssr: false });

const STANDALONE_PREFIXES = ["/student-hub", "/admin"];
// Auth screens render with no site chrome at all — no nav, footer or chat.
const BARE_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/auth"];

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname?.startsWith(`${p}/`));
  const standalone = STANDALONE_PREFIXES.some((p) => pathname?.startsWith(p));
  const isAdmin = pathname?.startsWith("/admin");

  if (bare) {
    return <main id="main">{children}</main>;
  }

  if (standalone) {
    return (
      <>
        <main id="main">{children}</main>
        {!isAdmin && <ChatWidget />}
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main id="main">{children}</main>
      <Footer />
      <ChatWidget />
      {/* Public marketing pages only — deliberately excluded from the
          bare/standalone branches above, so no analytics script loads on
          Student Hub, Admin, or the auth screens (login, password reset,
          etc.), and no logged-in usage data reaches GA4. */}
      {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </>
  );
}
