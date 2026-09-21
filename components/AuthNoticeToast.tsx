"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./AuthNoticeToast.module.css";

const VISIBLE_MS = 4000;

// One shared toast for auth-flow notices (logout success on the homepage,
// sign-out failure wherever the "Log out" button was actually pressed) —
// reads a one-shot ?<param>=1 flag, shows it, then strips the flag from
// the URL (history.replaceState, no navigation) so a refresh or Back
// doesn't re-trigger it.
export function AuthNoticeToast({
  param,
  message,
  variant = "success",
}: {
  param: string;
  message: string;
  variant?: "success" | "error";
}) {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get(param) !== "1") return;

    setVisible(true);

    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url.pathname + url.search);

    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  if (!visible) return null;

  return (
    <div className={`${styles.toast} ${variant === "error" ? styles.error : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
