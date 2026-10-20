import type { Metadata } from "next";
import { AdminCoursesPage } from "@/components/admin/AdminCoursesPage";

export const metadata: Metadata = { title: "Admin · Courses" };

export default function AdminCoursesRoute() {
  return <AdminCoursesPage />;
}
