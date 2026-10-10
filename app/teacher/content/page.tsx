import type { Metadata } from "next";
import { TeacherContentPage } from "@/components/TeacherContentPage";

export const metadata: Metadata = { title: "Teacher · Class content" };

export default function TeacherContentRoute() {
  return <TeacherContentPage />;
}
