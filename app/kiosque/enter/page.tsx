import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KiosqueEnter } from "@/components/ai-hub/KiosqueEnter";
import { getAiHubSession } from "@/lib/aiHub";

export const metadata: Metadata = { title: "Enter Le Kiosque", robots: { index: false, follow: false } };

export default async function KiosqueEnterPage() {
  // Already in (or an admin previewing)? Skip the email step.
  const session = await getAiHubSession();
  if (session.kind === "active") redirect("/kiosque/app");
  return <KiosqueEnter />;
}
