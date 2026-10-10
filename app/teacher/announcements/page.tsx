import type { Metadata } from "next";
import { TeacherAnnouncementsPage } from "@/components/TeacherAnnouncementsPage";

export const metadata: Metadata = { title: "Teacher · Announcements" };

export default function TeacherAnnouncementsRoute() {
  return <TeacherAnnouncementsPage />;
}
