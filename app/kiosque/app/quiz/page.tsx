import type { Metadata } from "next";
import { DailyQuiz } from "@/components/ai-hub/DailyQuiz";

export const metadata: Metadata = { title: "Daily Quiz" };

export default function QuizPage() {
  return <DailyQuiz />;
}
