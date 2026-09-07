import type { Metadata } from "next";
import { AdminPaymentsPage } from "@/components/admin/AdminPaymentsPage";

export const metadata: Metadata = { title: "Admin · Payments" };

export default function AdminPaymentsRoute() {
  return <AdminPaymentsPage />;
}
