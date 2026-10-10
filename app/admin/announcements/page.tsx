import type { Metadata } from "next";
import { AdminAnnouncementsPage } from "@/components/admin/AdminAnnouncementsPage";

export const metadata: Metadata = { title: "Admin · Announcements" };

export default function AdminAnnouncementsRoute() {
  return <AdminAnnouncementsPage />;
}
