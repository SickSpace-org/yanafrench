import type { Metadata } from "next";
import { TeacherDashboard } from "@/components/TeacherDashboard";

export const metadata: Metadata = { title: "Teacher portal" };

export default function TeacherHomePage() {
  return <TeacherDashboard />;
}
