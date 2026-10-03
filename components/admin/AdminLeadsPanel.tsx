"use client";

import { Fragment, useState } from "react";
import { EMI_INSTALLMENT_COUNT, type PaymentPlan } from "@/lib/emiData";
import { formatRupees } from "@/lib/formatCurrency";
import type { EnrollmentRequest } from "@/lib/enrollmentRequestData";
import styles from "./AdminLeadsPanel.module.css";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function defaultAmount(r: EnrollmentRequest, plan: PaymentPlan): string {
  const paise = plan === "emi" ? r.emiUpfrontPaise : r.feePaise;
  return paise ? String(Math.round(paise / 100)) : "";
}

// The inline "Payment received" form under a row: plan + amount, then
// confirm — which enrolls the student (see lib/enrollmentRequests.ts).
function ConfirmPayment({ request, onDone, onCancel }: { request: EnrollmentRequest; onDone: () => void; onCancel: () => void }) {
  const [plan, setPlan] = useState<PaymentPlan>(request.plan ?? "full");
  const [amount, setAmount] = useState(() => defaultAmount(request, request.plan ?? "full"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changePlan(next: PaymentPlan) {
    setPlan(next);
    setAmount(defaultAmount(request, next));
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/enrollment-requests/${encodeURIComponent(request.id)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRupees: Number(amount), plan }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't confirm the payment.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't confirm the payment.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.confirmBox}>
      {request.emiAvailable && (
        <label>
          Plan
          <select value={plan} onChange={(e) => changePlan(e.target.value as PaymentPlan)} disabled={saving}>
            <option value="full">Paid in full</option>
            <option value="emi">EMI — first payment ({EMI_INSTALLMENT_COUNT} monthly EMIs after)</option>
          </select>
        </label>
      )}
      <label>
        Amount received (₹)
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 25000"
          disabled={saving}
        />
      </label>
      <button type="button" className={styles.received} onClick={confirm} disabled={saving || !(Number(amount) > 0)}>
        {saving ? "Confirming…" : "Confirm payment"}
      </button>
      <button type="button" className={styles.action} onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <p className={styles.confirmNote}>
        This enrolls {request.name}: they move to Payments and Students and get their Student Hub login by email
        {plan === "emi" ? `, and their ${EMI_INSTALLMENT_COUNT} monthly EMIs appear under EMI` : ""}.
      </p>
      {error && <p className={styles.confirmError}>{error}</p>}
    </div>
  );
}

// Admin → Enrollments: everyone who filled an enroll form on the website
// (batch or course) and hasn't been confirmed as paid yet, newest first.
export function AdminLeadsPanel({
  requests,
  onRemove,
  onConfirmed,
}: {
  requests: EnrollmentRequest[];
  onRemove: (id: string) => void;
  onConfirmed: (request: EnrollmentRequest) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  if (requests.length === 0) {
    return <div className={styles.empty}>No pending enrollments — new website enrollments will appear here.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Course</th>
            <th>Fee &amp; plan</th>
            <th>Level</th>
            <th>Notes</th>
            <th>Submitted</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td>{r.name}</td>
                <td className={styles.contact}>
                  <a href={`tel:${r.phone}`}>{r.phone}</a>
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.whatsapp && (
                    <a href={`https://wa.me/${r.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                      WhatsApp {r.whatsapp}
                    </a>
                  )}
                </td>
                <td>
                  <span className={styles.course}>{r.kind === "batch" ? r.title : "Course"}</span>
                  <div>{r.kind === "batch" ? r.detail : r.title}</div>
                </td>
                <td>
                  {r.feePaise ? <div>{formatRupees(r.feePaise)}</div> : <span className={styles.muted}>—</span>}
                  {r.plan && (
                    <div className={styles.muted}>
                      {r.plan === "emi" ? `Wants EMI (${formatRupees(r.emiUpfrontPaise ?? 0)} first)` : "Wants to pay in full"}
                    </div>
                  )}
                </td>
                <td>
                  {r.level || <span className={styles.muted}>—</span>}
                  {r.mode && <div className={styles.muted}>{r.mode}</div>}
                </td>
                <td className={styles.notes}>{r.notes || <span className={styles.muted}>—</span>}</td>
                <td className={styles.time}>{formatWhen(r.createdAt)}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.received} onClick={() => setConfirming(r.id)} disabled={confirming === r.id}>
                      Payment received
                    </button>
                    <button type="button" className={styles.remove} onClick={() => onRemove(r.id)}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
              {confirming === r.id && (
                <tr className={styles.confirmRow}>
                  <td colSpan={8}>
                    <ConfirmPayment
                      request={r}
                      onCancel={() => setConfirming(null)}
                      onDone={() => {
                        setConfirming(null);
                        onConfirmed(r);
                      }}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
