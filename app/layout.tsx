import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
import { asset } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.xn--thefranaishub-ogb.com"),
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
