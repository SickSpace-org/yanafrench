import type { Metadata } from "next";
import { AttendancePage } from "@/components/AttendancePage";

export const metadata: Metadata = { title: "Attendance" };

export default function StudentAttendanceRoute() {
  return <AttendancePage />;
}
