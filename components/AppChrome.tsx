"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { ChatWidget } from "./ChatWidget";

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
    </>
  );
}
