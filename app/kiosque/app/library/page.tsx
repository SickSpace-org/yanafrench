import type { Metadata } from "next";
import { TranslateLibrary } from "@/components/ai-hub/TranslateLibrary";

export const metadata: Metadata = { title: "AI Translate & Library" };

export default function LibraryPage() {
  return <TranslateLibrary />;
}
