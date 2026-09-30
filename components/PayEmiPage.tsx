"use client";

import Link from "next/link";
import { useState } from "react";
import { formatRupees } from "@/lib/formatCurrency";
import { formatIndiaDate, lockDate, nextPendingInstallment } from "@/lib/emiData";
import { payNextEmi, useStudentEmi } from "@/lib/useStudentEmi";
import styles from "./EmiPayments.module.css";

// The one page a student can reach while their hub is locked for an
// overdue EMI (proxy.ts redirects every other /student-hub page here).
// Deliberately standalone — no DashboardShell, no nav — just what's owed
// and a pay button. Also reachable when not locked (the reminder emails
// link here), in which case it's simply a "pay your next EMI" page.
export function PayEmiPage() {
  const emi = useStudentEmi();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextPendingInstallment(emi.installments);

  async function handlePay() {
    setPaying(true);
    setError(null);
    try {
      const result = await payNextEmi();
      if (result === "paid") {
        // Full navigation (not router.push) so proxy.ts re-checks the lock.
        window.location.href = "/student-hub";
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
    setPaying(false);
    emi.refresh();
  }

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
        ) : (
          <>
            <h1>{emi.locked ? "Your Student Hub is locked." : "Pay your next EMI."}</h1>
            <p>
              {emi.locked
                ? `Your EMI was due on ${formatIndiaDate(next.dueDate)} and is still unpaid. Pay it now to unlock your Student Hub instantly.`
                : `Pay before ${formatIndiaDate(lockDate(next.dueDate))} to keep your Student Hub unlocked.`}
            </p>
            <div className={styles.amount}>{formatRupees(next.amount)}</div>
            <div className={styles.facts}>
              <div><span>Course</span>{next.productTitle}</div>
              <div><span>Installment</span>EMI {next.installmentNo} of {next.installmentCount}</div>
              <div><span>Due date</span>{formatIndiaDate(next.dueDate)}</div>
              <div><span>Status</span>{emi.locked ? "Overdue — hub locked" : "Pending"}</div>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="button" className={styles.payBig} onClick={handlePay} disabled={paying}>
              {paying ? "Opening payment…" : `Pay now · ${formatRupees(next.amount)}`}
            </button>
            {!emi.locked && <Link href="/student-hub" className={styles.signOut}>Back to Student Hub</Link>}
          </>
        )}

        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.signOut}>Log out</button>
        </form>
      </div>
    </main>
  );
}
