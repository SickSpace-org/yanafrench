import type { Metadata } from "next";
import { AdminGroupsPage } from "@/components/admin/AdminGroupsPage";

export const metadata: Metadata = { title: "Admin · Groups" };

export default function AdminGroupsRoute() {
  return <AdminGroupsPage />;
}
