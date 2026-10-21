import type { Metadata } from "next";
import { DailyNews } from "@/components/ai-hub/DailyNews";

export const metadata: Metadata = { title: "Daily News" };

export default function NewsPage() {
  return <DailyNews />;
}
