"use client";

import { useEffect, useState } from "react";
import { todayInIndia } from "./emiData";
import { buildNotifications, type Notification } from "./notificationData";

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

// The signed-in student's notifications, built from their homework, EMI
// schedule and message thread (see lib/notificationData.ts). Fetched once
// on mount, like useStudentProfile. An admin previewing the hub gets none.
export function useStudentNotifications(): { loaded: boolean; items: Notification[] } {
  const [state, setState] = useState<{ loaded: boolean; items: Notification[] }>({ loaded: false, items: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<{ homework?: []; preview?: boolean }>("/api/student/homework", {}),
      getJson<{ installments?: []; today?: string }>("/api/student/emi", {}),
      getJson<[]>("/api/messages", []),
    ]).then(([hw, emi, messages]) => {
      if (cancelled) return;
      setState({
        loaded: true,
        items: buildNotifications({
          homework: hw.preview ? [] : hw.homework ?? [],
          installments: emi.installments ?? [],
          messages: Array.isArray(messages) ? messages : [],
          today: emi.today ?? todayInIndia(),
        }),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
