"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Forgets this device (clears the member cookie) and returns to the email
// screen — also used to switch to a different email.
export function SignOutButton({ className, label }: { className?: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    try {
      await fetch("/api/ai-hub/exit", { method: "POST" });
    } finally {
      router.replace("/kiosque/enter");
      router.refresh();
    }
  }

  return (
    <button type="button" className={className} onClick={leave} disabled={busy}>
      {label}
    </button>
  );
}
