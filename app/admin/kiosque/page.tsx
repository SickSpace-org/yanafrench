import type { Metadata } from "next";
import { AdminAiHubPage } from "@/components/admin/AdminAiHubPage";

export const metadata: Metadata = { title: "Admin · Le Kiosque" };

export default function AdminAiHubRoute() {
  return <AdminAiHubPage />;
}
