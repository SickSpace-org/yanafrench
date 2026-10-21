import type { Metadata } from "next";
import { AiHubLanding } from "@/components/ai-hub/AiHubLanding";
import { AI_HUB_PRICE_LABEL } from "@/lib/aiHubData";
import { SITE_URL } from "@/lib/site";

const TITLE = "Le Kiosque — Daily French | The Français Hub";
const DESCRIPTION = `Practise French with AI every day: pronunciation feedback, translation and a personal word library, a daily quiz and daily French news. ${AI_HUB_PRICE_LABEL}.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/kiosque` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/kiosque`, siteName: "The Français Hub", type: "website" },
};

export default function AiHubPage() {
  return <AiHubLanding />;
}
