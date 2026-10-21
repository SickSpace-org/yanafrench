import type { Metadata } from "next";
import { Pronunciation } from "@/components/ai-hub/Pronunciation";

export const metadata: Metadata = { title: "Pronunciation" };

export default function PronunciationPage() {
  return <Pronunciation />;
}
