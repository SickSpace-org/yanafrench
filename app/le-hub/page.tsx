import type { Metadata } from "next";
import { LeHubShowcase } from "@/components/LeHubShowcase";
import { SITE_URL } from "@/lib/site";

const TITLE = "Your Student Dashboard, Explained | The Français Hub";
const DESCRIPTION =
  "See what you get inside The Français Hub after enrolling — course access, progress tracking, practice materials and everything in your student dashboard.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/le-hub` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/le-hub`, siteName: "The Français Hub", type: "website" },
};

export default function LeHubPage() {
  return <LeHubShowcase />;
}
