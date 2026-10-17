import type { Metadata } from "next";
import { AdminEmiPlansPage } from "@/components/admin/AdminEmiPlansPage";

export const metadata: Metadata = { title: "Admin · EMI Plans" };

export default function AdminEmiPlansRoute() {
  return <AdminEmiPlansPage />;
}
