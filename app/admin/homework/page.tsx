import type { Metadata } from "next";
import { AdminHomeworkPage } from "@/components/admin/AdminHomeworkPage";

export const metadata: Metadata = { title: "Admin · Homework" };

export default function AdminHomeworkRoute() {
  return <AdminHomeworkPage />;
}
