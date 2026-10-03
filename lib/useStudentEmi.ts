"use client";

import { useCallback, useEffect, useState } from "react";
import { formatIndiaDate, type EmiInstallment } from "./emiData";
import { formatRupees } from "./formatCurrency";

export type StudentEmiState = {
  loaded: boolean;
  installments: EmiInstallment[];
  locked: boolean;
  today: string | null;
};

// The signed-in student's EMI schedule (app/api/student/emi) — fetched on
// mount and on refresh(), like useStudentProfile.
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

// What a student sends Yana on WhatsApp to pay an EMI — there's no online
// payment in the hub; Yana marks it paid in Admin → EMI once received.
export function emiWhatsappMessage(inst: EmiInstallment): string {
  return `Hi Yana! I'd like to pay my EMI ${inst.installmentNo} of ${inst.installmentCount} for ${inst.productTitle} — ${formatRupees(inst.amount)}, due ${formatIndiaDate(inst.dueDate)}. How can I pay?`;
}
