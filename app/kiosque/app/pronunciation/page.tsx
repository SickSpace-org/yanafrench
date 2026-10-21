import type { Metadata } from "next";
import { Pronunciation } from "@/components/ai-hub/Pronunciation";

export const metadata: Metadata = { title: "Speaking" };

export default function PronunciationPage() {
  return <Pronunciation />;
}
