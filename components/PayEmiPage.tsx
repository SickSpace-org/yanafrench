"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { whatsappUrl } from "@/lib/site";
import { formatRupees } from "@/lib/formatCurrency";
import { formatIndiaDate, lockDate, nextPendingInstallment } from "@/lib/emiData";
import { emiWhatsappMessage, useStudentEmi } from "@/lib/useStudentEmi";
import { WhatsAppCountdown } from "./WhatsAppCountdown";
import styles from "./EmiPayments.module.css";

const POLL_MS = 5000;

// The one page a student can reach while their hub is locked for an
// overdue EMI (proxy.ts redirects every other /student-hub page here).
// Deliberately standalone — no DashboardShell, no nav — just what's owed.
// Locked: "pay your fees to continue learning", then Yana's WhatsApp opens
// after 3 seconds to arrange payment; once she marks it paid in Admin →
// EMI, this page notices (it keeps checking) and opens the hub by itself.
// Also reachable when not locked (the reminder emails link here), in which
// case it's simply a "pay your next EMI" page with a WhatsApp button.
export function PayEmiPage() {
  const emi = useStudentEmi();
  const { refresh } = emi;
  const next = nextPendingInstallment(emi.installments);
  // Auto-open WhatsApp only once per installment per browser session —
  // coming back from WhatsApp must not bounce the student straight back.
  const [autoOpen, setAutoOpen] = useState<boolean | null>(null);
  const seenLocked = useRef(false);
  const waKey = next ? `emi-whatsapp-opened-${next.id}` : null;

  useEffect(() => {
    if (!waKey) return;
    try {
      setAutoOpen(!sessionStorage.getItem(waKey));
    } catch {
      setAutoOpen(true);
    }
  }, [waKey]);

  const markOpened = useCallback(() => {
    try {
      if (waKey) sessionStorage.setItem(waKey, "1");
    } catch {
      // storage blocked — worst case it auto-opens again next visit
    }
  }, [waKey]);

  // While locked, keep checking; the moment Yana marks the EMI paid, go
  // to the hub (full navigation so proxy.ts re-checks the lock).
  useEffect(() => {
    if (emi.locked) seenLocked.current = true;
    if (emi.loaded && !emi.locked && seenLocked.current) {
      window.location.href = "/student-hub";
      return;
    }
    if (!emi.locked) return;
    const timer = setInterval(refresh, POLL_MS);
    const onBack = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [emi.loaded, emi.locked, refresh]);

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>le hub<span>.</span></div>

        {!emi.loaded ? (
          <p>Loading…</p>
        ) : !next ? (
          <>
            <h1>You&rsquo;re all paid up.</h1>
            <p>There&rsquo;s no EMI due right now.</p>
            <Link href="/student-hub" className={styles.payBig}>Go to Student Hub</Link>
          </>
        ) : emi.locked ? (
          <>
            <h1>Pay your fees to continue learning.</h1>
            <p>
              Your EMI for {next.productTitle} was due on {formatIndiaDate(next.dueDate)} and is still unpaid, so your Student Hub is paused.
              Pay Yana on WhatsApp — as soon as she confirms your payment, your Student Hub opens again automatically.
            </p>
            <div className={styles.amount}>{formatRupees(next.amount)}</div>
            <div className={styles.facts}>
              <div><span>Course</span>{next.productTitle}</div>
              <div><span>Installment</span>EMI {next.installmentNo} of {next.installmentCount}</div>
              <div><span>Due date</span>{formatIndiaDate(next.dueDate)}</div>
              <div><span>Status</span>Overdue</div>
            </div>
            {autoOpen !== null && (
              <WhatsAppCountdown
                autoStart={autoOpen}
                onOpen={markOpened}
                hint="Your payment message is ready to send."
                message={emiWhatsappMessage(next)}
              />
            )}
            <p className={styles.waiting}>
              <i aria-hidden="true" /> Waiting for Yana to confirm your payment — this page opens your Student Hub by itself.
            </p>
          </>
        ) : (
          <>
            <h1>Pay your next EMI.</h1>
            <p>
              {`Pay Yana on WhatsApp before ${formatIndiaDate(lockDate(next.dueDate))} to keep your Student Hub unlocked. It shows as paid once she confirms it.`}
            </p>
            <div className={styles.amount}>{formatRupees(next.amount)}</div>
            <div className={styles.facts}>
              <div><span>Course</span>{next.productTitle}</div>
              <div><span>Installment</span>EMI {next.installmentNo} of {next.installmentCount}</div>
              <div><span>Due date</span>{formatIndiaDate(next.dueDate)}</div>
              <div><span>Status</span>Pending</div>
            </div>
            <a className={styles.payBig} href={whatsappUrl(emiWhatsappMessage(next))} target="_blank" rel="noreferrer">
              Pay on WhatsApp · {formatRupees(next.amount)}
            </a>
            <Link href="/student-hub" className={styles.signOut}>Back to Student Hub</Link>
          </>
        )}

        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.signOut}>Log out</button>
        </form>
      </div>
    </main>
  );
}
