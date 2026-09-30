"use client";

import { useCallback, useEffect, useState } from "react";
import { loadRazorpayScript } from "./loadRazorpayScript";
import type { EmiInstallment } from "./emiData";

export type StudentEmiState = {
  loaded: boolean;
  installments: EmiInstallment[];
  locked: boolean;
  today: string | null;
};

// The signed-in student's EMI schedule (app/api/student/emi) — fetched on
// mount and again after a payment, like useStudentProfile.
export function useStudentEmi(): StudentEmiState & { refresh: () => void } {
  const [state, setState] = useState<StudentEmiState>({ loaded: false, installments: [], locked: false, today: null });

  const refresh = useCallback(() => {
    fetch("/api/student/emi", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setState({ loaded: true, installments: data.installments ?? [], locked: !!data.locked, today: data.today ?? null }))
      .catch(() => setState((prev) => ({ ...prev, loaded: true })));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}

// Creates an order for the student's next unpaid installment (the server
// picks which one and how much) and opens Razorpay's checkout for it.
// Resolves "paid" once the payment is verified server-side, "dismissed" if
// the student closed the window, and throws on any other failure.
export async function payNextEmi(): Promise<"paid" | "dismissed"> {
  const res = await fetch("/api/emi/create-order", { method: "POST" });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Couldn't start the payment. Please try again.");
  const order = (await res.json()) as {
    orderId: string;
    amount: number;
    currency: string;
    title: string;
    prefill: { name: string; email: string; contact: string };
  };

  const scriptOk = await loadRazorpayScript();
  if (!scriptOk || !window.Razorpay) throw new Error("Couldn't load the payment widget. Check your connection and try again.");

  return new Promise((resolve, reject) => {
    let settled = false;
    const razorpay = new window.Razorpay!({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "The Français Hub",
      description: order.title,
      prefill: order.prefill,
      theme: { color: "#1F3A5F" },
      handler: async (response: Record<string, string>) => {
        settled = true;
        try {
          const verify = await fetch("/api/emi/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (!verify.ok) throw new Error();
          resolve("paid");
        } catch {
          reject(new Error("Payment went through, but we couldn't confirm it automatically — it will update shortly. Contact us if it doesn't."));
        }
      },
      modal: {
        ondismiss: () => {
          if (!settled) resolve("dismissed");
        },
      },
    });
    razorpay.open();
  });
}
