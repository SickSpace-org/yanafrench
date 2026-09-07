import type { Metadata } from "next";
import { AdminLeadsPage } from "@/components/admin/AdminLeadsPage";

export const metadata: Metadata = { title: "Admin · Enrollments" };

export default function AdminEnrollmentsRoute() {
  return <AdminLeadsPage />;
}
