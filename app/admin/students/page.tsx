import type { Metadata } from "next";
import { AdminStudentsPage } from "@/components/admin/AdminStudentsPage";

export const metadata: Metadata = { title: "Admin · Students" };

export default function AdminStudentsRoute() {
  return <AdminStudentsPage />;
}
