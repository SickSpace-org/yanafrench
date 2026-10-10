import type { Metadata } from "next";
import { TeacherAttendancePage } from "@/components/TeacherAttendancePage";

export const metadata: Metadata = { title: "Teacher · Attendance" };

export default function TeacherAttendanceRoute() {
  return <TeacherAttendancePage />;
}
