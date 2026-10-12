import type { Metadata } from "next";
import { AdminBookingsPage } from "@/components/admin/AdminBookingsPage";

export const metadata: Metadata = { title: "Admin · Bookings" };

export default function AdminBookingsRoute() {
  return <AdminBookingsPage />;
}
