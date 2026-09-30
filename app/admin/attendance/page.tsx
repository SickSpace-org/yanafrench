import type { Metadata } from "next";
import { AdminAttendancePage } from "@/components/admin/AdminAttendancePage";

export const metadata: Metadata = { title: "Admin · Attendance" };

export default function AdminAttendanceRoute() {
  return <AdminAttendancePage />;
}
