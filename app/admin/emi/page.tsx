import type { Metadata } from "next";
import { AdminEmiPage } from "@/components/admin/AdminEmiPage";

export const metadata: Metadata = { title: "Admin · EMI" };

export default function AdminEmiRoute() {
  return <AdminEmiPage />;
}
