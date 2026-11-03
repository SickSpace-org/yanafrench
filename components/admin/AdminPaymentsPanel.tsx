"use client";

import { useState } from "react";
import type { Student } from "@/lib/studentData";
import type { EmiInstallment } from "@/lib/emiData";
import { formatIndiaDate } from "@/lib/emiData";
import { formatRupees } from "@/lib/formatCurrency";
import styles from "./AdminLeadsPanel.module.css";

// Rupee amount that turns into an input on click; Enter / blur saves.
function EditableAmount({ paise, onSave }: { paise: number; onSave: (rupees: number) => Promise<void> | void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function commit() {
    const rupees = Number(value);
    setEditing(false);
    if (value.trim() === "" || !Number.isFinite(rupees) || Math.round(rupees * 100) === paise) return;
    setBusy(true);
    try {
      await onSave(rupees);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{ width: "7rem", padding: ".25rem .4rem", font: "inherit" }}
        aria-label="Amount in rupees"
      />
    );
  }
  return (
    <button
      type="button"
      className={styles.action}
      disabled={busy}
      title="Click to edit"
      onClick={() => {
        setValue(String(paise / 100));
        setEditing(true);
      }}
    >
      {busy ? "Saving…" : `${formatRupees(paise)} ✎`}
    </button>
  );
}

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Couldn't save.");
}

// Admin → Payments: every student from the Students tab with what they've
// paid — first payment, each EMI installment and the running total — all
// editable by hand.
export function AdminPaymentsPanel({ students, onChanged }: { students: Student[]; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    }
    onChanged();
  }

  const editFirst = (id: string, rupees: number) =>
    run(() => send(`/api/payments/${id}`, { method: "PATCH", body: JSON.stringify({ rupees }) }));
  const editEmi = (id: string, rupees: number) =>
    run(() => send(`/api/emi/installments/${id}`, { method: "POST", body: JSON.stringify({ action: "amount", rupees }) }));
  const editDue = (id: string, dueDate: string) =>
    run(() => send(`/api/emi/installments/${id}`, { method: "POST", body: JSON.stringify({ action: "reschedule", dueDate }) }));
  const toggleEmi = (i: EmiInstallment) =>
    run(() => send(`/api/emi/installments/${i.id}`, { method: "POST", body: JSON.stringify({ action: i.status === "paid" ? "unpaid" : "paid" }) }));

  // Editing the total adjusts the student's first payment so first + paid EMIs = the new total.
  async function editTotal(s: Student, rupees: number) {
    const firsts = s.firstPayments ?? [];
    if (firsts.length === 0) {
      setError(`${s.name} has no first payment to adjust.`);
      return;
    }
    const target = Math.round(rupees * 100);
    const emiPaid = (s.emiInstallments ?? []).filter((i) => i.status === "paid").reduce((n, i) => n + i.amount, 0);
    const others = firsts.slice(1).reduce((n, f) => n + f.amount, 0);
    const first = target - emiPaid - others;
    if (first < 0) {
      setError(`Total can't be below ${formatRupees(emiPaid + others)} (already counted from EMIs and other payments).`);
      return;
    }
    await editFirst(firsts[0].id, first / 100);
  }

  if (students.length === 0) {
    return <div className={styles.empty}>No students yet — they appear here as soon as they&rsquo;re added in Students.</div>;
  }

  return (
    <>
      {error && <p style={{ color: "#B63A3A", fontWeight: 700 }}>{error}</p>}
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Contact</th>
              <th>Amount paid (first payment)</th>
              <th>EMI</th>
              <th>Total paid</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const emis = s.emiInstallments ?? [];
              const due = emis.filter((i) => i.status === "pending").reduce((n, i) => n + i.amount, 0);
              const firsts = s.firstPayments ?? [];
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className={styles.contact}>
                    <a href={`tel:${s.phone}`}>{s.phone}</a>
                    <a href={`mailto:${s.email}`}>{s.email}</a>
                  </td>
                  <td>
                    {firsts.length === 0 ? (
                      <span className={styles.muted}>No payment recorded</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
                        {firsts.map((f) => (
                          <div key={f.id}>
                            <EditableAmount paise={f.amount} onSave={(r) => editFirst(f.id, r)} />
                            <div className={styles.muted}>{f.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {emis.length === 0 ? (
                      <span className={styles.muted}>No EMI</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
                        {emis.map((i) => (
                          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
                            <span className={styles.muted}>{i.installmentNo}/{i.installmentCount}</span>
                            <EditableAmount paise={i.amount} onSave={(r) => editEmi(i.id, r)} />
                            {i.status === "pending" ? (
                              <input
                                type="date"
                                value={i.dueDate}
                                aria-label="Due date"
                                title="Change the due date"
                                onChange={(e) => e.target.value && e.target.value !== i.dueDate && editDue(i.id, e.target.value)}
                                style={{ padding: ".2rem .35rem", font: "inherit" }}
                              />
                            ) : (
                              <span className={styles.muted}>due {formatIndiaDate(i.dueDate)}</span>
                            )}
                            <button type="button" className={styles.action} onClick={() => toggleEmi(i)}>
                              {i.status === "paid" ? "Paid ✓ (undo)" : "Mark paid"}
                            </button>
                          </div>
                        ))}
                        {due > 0 && <div className={styles.muted}>{formatRupees(due)} still due</div>}
                      </div>
                    )}
                  </td>
                  <td>
                    <EditableAmount paise={s.totalPaidPaise ?? 0} onSave={(r) => editTotal(s, r)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
