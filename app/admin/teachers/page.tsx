import type { Metadata } from "next";
import { AdminTeachersPage } from "@/components/admin/AdminTeachersPage";

export const metadata: Metadata = { title: "Admin · Teachers" };

export default function AdminTeachersRoute() {
  return <AdminTeachersPage />;
}
