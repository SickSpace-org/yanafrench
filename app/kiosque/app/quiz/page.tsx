import type { Metadata } from "next";
import { DailyQuiz } from "@/components/ai-hub/DailyQuiz";

export const metadata: Metadata = { title: "AI Daily Quiz" };

export default function QuizPage() {
  return <DailyQuiz />;
}
