import type { Metadata } from "next";
import { PayEmiPage } from "@/components/PayEmiPage";

export const metadata: Metadata = { title: "Pay your EMI" };

export default function PayEmiRoute() {
  return <PayEmiPage />;
}
