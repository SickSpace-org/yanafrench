import type { Metadata } from "next";
import { BatchFinder } from "@/components/BatchFinder";
import { SITE_URL } from "@/lib/site";

const TITLE = "Find Your Batch | The Français Hub";
const DESCRIPTION =
  "Find the right French batch for your level and schedule — TEF, TCF and DELF prep classes matched to where you're starting from.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/find-your-batch` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/find-your-batch`, siteName: "The Français Hub", type: "website" },
};

export default function FindYourBatchPage() {
  return <BatchFinder standalone />;
}
