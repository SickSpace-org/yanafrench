"use client";

import { Fragment, useMemo, useState } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { formatRupees } from "@/lib/formatCurrency";
import {
  daysOverdue,
  formatIndiaDate,
  isInstallmentLocking,
  isoToIndiaDate,
  lockDate,
  nextPendingInstallment,
  todayInIndia,
  type EmiInstallment,
} from "@/lib/emiData";
import type { Student } from "@/lib/studentData";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import emiStyles from "./AdminEmiPage.module.css";

type Plan = {
  key: string;
  student: Student;
  productTitle: string;
  installments: EmiInstallment[];
  next: EmiInstallment | null;
};

// One plan per (student, course enrollment) bought on EMI, built from the
// installments /api/students already attaches to each student. Plans with
// money still owed come first, earliest next due date on top (so overdue
// ones lead); fully paid plans sink to the bottom.
function buildPlans(students: Student[]): Plan[] {
  const plans: Plan[] = [];
  for (const student of students) {
    const byEnrollment = new Map<string, EmiInstallment[]>();
    for (const inst of student.emiInstallments ?? []) {
      const list = byEnrollment.get(inst.courseEnrollmentId) ?? [];
      list.push(inst);
      byEnrollment.set(inst.courseEnrollmentId, list);
    }
    for (const [enrollmentId, installments] of byEnrollment) {
      installments.sort((a, b) => a.installmentNo - b.installmentNo);
      plans.push({
        key: enrollmentId,
        student,
        productTitle: installments[0].productTitle,
        installments,
        next: nextPendingInstallment(installments),
      });
    }
  }
  return plans.sort((a, b) => {
    if (!a.next || !b.next) return a.next ? -1 : b.next ? 1 : a.student.name.localeCompare(b.student.name);
    return a.next.dueDate.localeCompare(b.next.dueDate) || a.student.name.localeCompare(b.student.name);
  });
}

function NextStatus({ next, today }: { next: EmiInstallment | null; today: string }) {
  if (!next) return <span className={`${leadStyles.payment} ${leadStyles.payment_paid}`}>Fully paid</span>;
  const d = daysOverdue(next.dueDate, today);
  if (isInstallmentLocking(next, today)) {
    return <span className={`${leadStyles.payment} ${leadStyles.payment_pending}`}>Overdue {d}d · hub locked</span>;
  }
  if (d > 0) {
    return (
      <span className={`${leadStyles.payment} ${leadStyles.payment_pending}`}>
        Overdue {d}d · locks {formatIndiaDate(lockDate(next.dueDate))}
      </span>
    );
  }
  if (d === 0) return <span className={`${leadStyles.payment} ${leadStyles.payment_pending}`}>Due today</span>;
  return <span className={leadStyles.time}>in {-d} {d === -1 ? "day" : "days"}</span>;
}

// One line of a plan's schedule, with the admin's manual controls: "Mark
// paid" (confirm step, since it's money), "Undo" for a manual mark, and
// "Change date" for a pending one (a two-part plan's "after 12 sessions"
// date is only an estimate until the class has actually reached it).
function InstallmentLine({ inst, onChanged }: { inst: EmiInstallment; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dueDate, setDueDate] = useState(inst.dueDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "paid" | "unpaid" | "reschedule") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/emi/installments/${encodeURIComponent(inst.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reschedule" ? { action, dueDate } : { action }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Something went wrong.");
      setConfirming(false);
      setEditingDate(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const paid = inst.status === "paid";
  return (
    <li className={paid ? emiStyles.paid : undefined}>
      <span>#{inst.installmentNo}</span>
      <span>
        {editingDate ? (
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={saving} aria-label="New due date" />
        ) : (
          formatIndiaDate(inst.dueDate)
        )}
      </span>
      <span>{formatRupees(inst.amount)}</span>
      <span>{paid && inst.paidAt ? `Paid ${formatIndiaDate(isoToIndiaDate(inst.paidAt))}` : paid ? "Paid" : "Pending"}</span>
      <span className={emiStyles.lineActions}>
        {paid ? (
          <button type="button" className={emiStyles.undo} disabled={saving} onClick={() => send("unpaid")} title="Undo a payment you marked by hand">
            {saving ? "…" : "Undo"}
          </button>
        ) : editingDate ? (
          <>
            <button type="button" className={emiStyles.markPaid} disabled={saving || !dueDate || dueDate === inst.dueDate} onClick={() => send("reschedule")}>
              {saving ? "Saving…" : "Save date"}
            </button>
            <button type="button" className={emiStyles.undo} disabled={saving} onClick={() => { setEditingDate(false); setDueDate(inst.dueDate); }}>
              Cancel
            </button>
          </>
        ) : confirming ? (
          <>
            <button type="button" className={emiStyles.markPaid} disabled={saving} onClick={() => send("paid")}>
              {saving ? "Saving…" : `Confirm ${formatRupees(inst.amount)} received`}
            </button>
            <button type="button" className={emiStyles.undo} disabled={saving} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className={emiStyles.markPaid} onClick={() => setConfirming(true)}>
              Mark paid
            </button>
            <button type="button" className={emiStyles.undo} onClick={() => setEditingDate(true)}>
              Change date
            </button>
          </>
        )}
      </span>
      {error && <span className={emiStyles.lineError}>{error}</span>}
    </li>
  );
}

type PendingDraft = { id: string | null; amount: string; dueDate: string };

// "Edit plan" for one existing student: paid installments stay as they
// are; the unpaid ones can be re-priced, re-dated, added or removed — e.g.
// turn 3 remaining EMIs into 2, or into 5 smaller ones.
function ScheduleEditor({ plan, onSaved, onCancel }: { plan: Plan; onSaved: () => void; onCancel: () => void }) {
  const paid = plan.installments.filter((i) => i.status === "paid");
  const originalPending = plan.installments.filter((i) => i.status === "pending");
  const [rows, setRows] = useState<PendingDraft[]>(() =>
    originalPending.map((i) => ({ id: i.id, amount: String(Math.round(i.amount / 100)), dueDate: i.dueDate }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const before = originalPending.reduce((s, i) => s + i.amount, 0);
  const after = rows.reduce((s, r) => s + (Number(r.amount) || 0) * 100, 0);
  const valid = rows.every((r, i) => Number.isInteger(Number(r.amount)) && Number(r.amount) >= 1 && r.dueDate && (i === 0 || r.dueDate >= rows[i - 1].dueDate));

  function update(i: number, field: "amount" | "dueDate", value: string) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  }

  function addPayment() {
    setRows((prev) => {
      const last = prev[prev.length - 1]?.dueDate ?? paid[paid.length - 1]?.dueDate ?? todayInIndia();
      const [y, m, d] = last.split("-").map(Number);
      const next = new Date(Date.UTC(y, m, Math.min(d, 28))).toISOString().slice(0, 10);
      return [...prev, { id: null, amount: "", dueDate: next }];
    });
  }

  // Spreads the amount still to collect (as it was) equally over the rows.
  function splitEqually() {
    const total = Math.round(before / 100);
    const each = Math.floor(total / rows.length);
    setRows((prev) => prev.map((r, i) => ({ ...r, amount: String(i === prev.length - 1 ? total - each * (prev.length - 1) : each) })));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/emi/plans/${encodeURIComponent(plan.key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending: rows.map((r) => ({ id: r.id, amountRupees: Number(r.amount), dueDate: r.dueDate })) }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't save the plan.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the plan.");
      setSaving(false);
    }
  }

  return (
    <div className={emiStyles.editor}>
      <strong className={emiStyles.editorTitle}>
        Edit {plan.student.name}&rsquo;s plan — {plan.productTitle}
      </strong>
      {paid.length > 0 && (
        <p className={leadStyles.muted}>
          Already paid: {paid.map((i) => `${formatRupees(i.amount)} (#${i.installmentNo})`).join(", ")} — these stay as they are.
        </p>
      )}
      {rows.map((r, i) => (
        <div className={emiStyles.editorRow} key={r.id ?? `new-${i}`}>
          <span>Payment {i + 1}</span>
          <label>
            ₹
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={r.amount}
              onChange={(e) => update(i, "amount", e.target.value)}
              disabled={saving}
              aria-label={`Payment ${i + 1} amount`}
            />
          </label>
          <label>
            due
            <input type="date" value={r.dueDate} onChange={(e) => update(i, "dueDate", e.target.value)} disabled={saving} aria-label={`Payment ${i + 1} due date`} />
          </label>
          <button type="button" className={emiStyles.undo} disabled={saving} onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      {rows.length === 0 && <p className={leadStyles.muted}>No payments left — saving marks this plan as fully paid.</p>}
      <p className={after === before ? emiStyles.totalOk : emiStyles.totalChanged}>
        Still to collect: {formatRupees(after)}
        {after !== before && ` (was ${formatRupees(before)})`}
      </p>
      <div className={emiStyles.editorActions}>
        <button type="button" className={leadStyles.received} disabled={saving || !valid || rows.length > 12} onClick={save}>
          {saving ? "Saving…" : "Save plan"}
        </button>
        <button type="button" className={leadStyles.action} disabled={saving || rows.length >= 12} onClick={addPayment}>
          + Add payment
        </button>
        {rows.length > 0 && (
          <button type="button" className={leadStyles.action} disabled={saving} onClick={splitEqually}>
            Split {formatRupees(before)} equally
          </button>
        )}
        <button type="button" className={leadStyles.action} disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {!valid && <p className={emiStyles.lineError}>Every payment needs an amount of ₹1 or more and a date, in date order.</p>}
      {error && <p className={emiStyles.lineError}>{error}</p>}
    </div>
  );
}

export function AdminEmiPage() {
  const { items: students, loaded, refresh } = useAdminCollection<Student>("/api/students");
  const plans = useMemo(() => buildPlans(students), [students]);
  const [editing, setEditing] = useState<string | null>(null);
  const today = todayInIndia();

  const active = plans.filter((p) => p.next);
  const overdue = active.filter((p) => daysOverdue(p.next!.dueDate, today) > 0).length;
  const dueThisWeek = active.filter((p) => {
    const d = daysOverdue(p.next!.dueDate, today);
    return d <= 0 && d >= -7;
  }).length;
  const outstanding = plans.reduce(
    (sum, p) => sum + p.installments.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0),
    0
  );

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>EMI.</h1>
        <p>
          Students paying in installments — what they&rsquo;ve paid, and when their next payment is due. Got an EMI by bank transfer, UPI
          or cash? Press &ldquo;Mark paid&rdquo; next to it — if their Student Hub was locked, it unlocks straight away. &ldquo;Edit
          plan&rdquo; changes a student&rsquo;s remaining payments: amounts, dates, or how many are left. (To change the plan for new
          enrollments, use EMI Plans.)
        </p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : plans.length === 0 ? (
        <div className={styles.tabPanel}>
          <div className={leadStyles.empty}>No students on the EMI plan yet.</div>
        </div>
      ) : (
        <>
          <div className={emiStyles.stats}>
            <div className={emiStyles.stat}><span>{active.length}</span>Active plans</div>
            <div className={emiStyles.stat}><span>{dueThisWeek}</span>Due in next 7 days</div>
            <div className={emiStyles.stat}><span className={overdue > 0 ? emiStyles.alert : undefined}>{overdue}</span>Overdue</div>
            <div className={emiStyles.stat}><span>{formatRupees(outstanding)}</span>Still to collect</div>
          </div>

          <div className={styles.tabPanel}>
            <div style={{ overflowX: "auto" }}>
              <table className={leadStyles.table}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Next payment</th>
                    <th>Status</th>
                    <th>Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const paid = p.installments.filter((i) => i.status === "paid").length;
                    return (
                      <Fragment key={p.key}>
                      <tr>
                        <td>
                          <div className={emiStyles.name}>{p.student.name}</div>
                          <div className={leadStyles.contact}>
                            <a href={`tel:${p.student.phone}`}>{p.student.phone}</a>
                            <a href={`mailto:${p.student.email}`}>{p.student.email}</a>
                          </div>
                        </td>
                        <td>
                          {p.productTitle}
                          <div className={leadStyles.muted}>{paid}/{p.installments.length} installments paid</div>
                        </td>
                        <td>
                          {p.next ? (
                            <>
                              <div className={emiStyles.nextDate}>{formatIndiaDate(p.next.dueDate)}</div>
                              <div className={leadStyles.muted}>
                                {formatRupees(p.next.amount)} · installment {p.next.installmentNo}/{p.next.installmentCount}
                              </div>
                            </>
                          ) : (
                            <span className={leadStyles.muted}>—</span>
                          )}
                        </td>
                        <td><NextStatus next={p.next} today={today} /></td>
                        <td>
                          <ul className={emiStyles.schedule}>
                            {p.installments.map((i) => (
                              <InstallmentLine key={i.id} inst={i} onChanged={refresh} />
                            ))}
                          </ul>
                          {editing !== p.key && (
                            <button type="button" className={emiStyles.editPlan} onClick={() => setEditing(p.key)}>
                              Edit plan
                            </button>
                          )}
                        </td>
                      </tr>
                      {editing === p.key && (
                        <tr>
                          <td colSpan={5}>
                            <ScheduleEditor
                              plan={p}
                              onCancel={() => setEditing(null)}
                              onSaved={() => {
                                setEditing(null);
                                refresh();
                              }}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
