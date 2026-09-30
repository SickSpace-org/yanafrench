import type { Metadata } from "next";
import { HomeworkPage } from "@/components/HomeworkPage";

export const metadata: Metadata = { title: "Homework" };

export default function StudentHomeworkRoute() {
  return <HomeworkPage />;
}
