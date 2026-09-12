"use client";

import { loadRazorpayScript } from "./loadRazorpayScript";

export type CourseOrder = { orderId: string; amount: number; currency: string; title: string };
export type CourseCheckoutDetails = { name: string; email: string; phone: string };
export type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

// Creates a Razorpay order server-side via /api/course-payment/create-order
// — the server re-derives the price from lib/courseCatalogData.ts by
// productId, so nothing here can inflate or discount the charged amount.
export async function createCourseOrder(input: {
  leadId: string;
  name: string;
  email: string;
  phone: string;
  productId: string;
}): Promise<CourseOrder> {
  const res = await fetch("/api/course-payment/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Couldn't start the payment. Please try again.");
  return res.json();
}

// Opens Razorpay's checkout for an already-created order.
//
// WHERE TO WIRE A LIVE GATEWAY: this project already has a real Razorpay
// integration on a TEST key — RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
// (server-only, used in app/api/course-payment/create-order and
// app/api/course-payment/verify) and NEXT_PUBLIC_RAZORPAY_KEY_ID (public,
// read below). To go live, replace those three values with live-mode
// credentials in .env.local / Vercel env vars — no code change is needed
// here or in the API routes.
export async function openCourseCheckout(
  order: CourseOrder,
  details: CourseCheckoutDetails,
  handlers: {
    onSuccess: (response: RazorpaySuccessResponse) => void | Promise<void>;
    onDismiss: () => void;
  }
): Promise<void> {
  const scriptOk = await loadRazorpayScript();
  if (!scriptOk || !window.Razorpay) {
    throw new Error("Couldn't load the payment widget. Check your connection and try again.");
  }

  const razorpay = new window.Razorpay({
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: order.currency,
    order_id: order.orderId,
    name: "The Français Hub",
    description: order.title,
    prefill: { name: details.name, email: details.email, contact: details.phone },
    method: { upi: true, card: true, netbanking: true, wallet: true, paylater: true },
    theme: { color: "#1F3A5F" },
    handler: handlers.onSuccess,
    modal: { ondismiss: handlers.onDismiss },
  });
  razorpay.open();
}
