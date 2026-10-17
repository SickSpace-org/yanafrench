"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { emiProducts, enrollablePriceInPaise, type EmiProduct } from "@/lib/courseCatalogData";
import {
  EMI_MAX_PAYMENTS,
  EMI_NOTE_MAX,
  defaultEmiPlan,
  describeEmiPlan,
  emiSettingProblem,
  planToSetting,
  resolveEmiPlan,
  splitRupees,
  type EmiSetting,
  type EmiSettings,
} from "@/lib/emiData";
import { formatRupees } from "@/lib/formatCurrency";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import planStyles from "./AdminEmiPlansPage.module.css";

type Draft = { rupees: string; afterDays: string; note: string }[];

function toDraft(setting: EmiSetting): Draft {
  return setting.payments.map((p) => ({ rupees: String(p.rupees), afterDays: String(p.afterDays), note: p.note ?? "" }));
}

function fromDraft(draft: Draft): EmiSetting {
  return {
    enabled: draft.length >= 2,
    payments: draft.map((p, i) => ({
      rupees: Number(p.rupees),
      afterDays: i === 0 ? 0 : Number(p.afterDays),
      ...(p.note.trim() ? { note: p.note.trim() } : {}),
    })),
  };
}

// The inline editor under a product: how many payments, then each one's
// amount, when it's due (days after enrolling) and an optional note the
// student sees instead ("after 12 sessions").
function PlanEditor({
  product,
  setting,
  onSaved,
  onCancel,
}: {
  product: EmiProduct;
  setting: EmiSetting | undefined;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const fee = enrollablePriceInPaise(product.enrollable);
  const feeRupees = Math.round(fee / 100);
  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(planToSetting(resolveEmiPlan(product.enrollable, fee, setting), fee))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = draft.reduce((s, p) => s + (Number(p.rupees) || 0), 0);
  const problem = draft.length >= 2 ? emiSettingProblem(fromDraft(draft), fee) : null;

  function setCount(count: number) {
    const amounts = splitRupees(feeRupees, count);
    setDraft((prev) => {
      // Keep the due days already set; each added payment is 30 days after
      // the one before it.
      let lastDays = 0;
      return amounts.map((rupees, i) => {
        const days = i === 0 ? 0 : i < prev.length && Number(prev[i].afterDays) > 0 ? Number(prev[i].afterDays) : lastDays + 30;
        lastDays = days;
        return { rupees: String(rupees), afterDays: String(days), note: prev[i]?.note ?? "" };
      });
    });
  }

  function update(i: number, field: keyof Draft[number], value: string) {
    setDraft((prev) => prev.map((p, j) => (j === i ? { ...p, [field]: value } : p)));
  }

  async function save(body: { setting: EmiSetting | null }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/emi-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.productId, ...body }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't save.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <div className={planStyles.editor}>
      <label className={planStyles.countField}>
        Number of payments
        <select value={draft.length} onChange={(e) => setCount(Number(e.target.value))} disabled={saving}>
          {Array.from({ length: EMI_MAX_PAYMENTS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "1 — pay in full only (no EMI)" : `${n} payments`}
            </option>
          ))}
        </select>
      </label>

      {draft.length >= 2 && (
        <div className={planStyles.payments}>
          <div className={planStyles.paymentHead}>
            <span>#</span>
            <span>Amount (₹)</span>
            <span>Due</span>
            <span>Note shown to student (optional)</span>
          </div>
          {draft.map((p, i) => (
            <div className={planStyles.payment} key={i}>
              <span>{i + 1}</span>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={p.rupees}
                onChange={(e) => update(i, "rupees", e.target.value)}
                disabled={saving}
                aria-label={`Payment ${i + 1} amount`}
              />
              {i === 0 ? (
                <span className={planStyles.atEnroll}>At enrollment</span>
              ) : (
                <span className={planStyles.days}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={p.afterDays}
                    onChange={(e) => update(i, "afterDays", e.target.value)}
                    disabled={saving}
                    aria-label={`Payment ${i + 1} due days after enrolling`}
                  />
                  days after enrolling
                </span>
              )}
              {i === 0 ? (
                <span />
              ) : (
                <input
                  value={p.note}
                  maxLength={EMI_NOTE_MAX}
                  onChange={(e) => update(i, "note", e.target.value)}
                  placeholder="e.g. after 12 sessions"
                  disabled={saving}
                  aria-label={`Payment ${i + 1} note`}
                />
              )}
            </div>
          ))}
          <p className={total === feeRupees ? planStyles.totalOk : planStyles.totalBad}>
            Total {formatRupees(total * 100)} of {formatRupees(fee)} course fee
            {total !== feeRupees && ` — ${total < feeRupees ? `${formatRupees((feeRupees - total) * 100)} short` : `${formatRupees((total - feeRupees) * 100)} over`}`}
          </p>
        </div>
      )}

      <div className={planStyles.actions}>
        <button type="button" className={leadStyles.received} disabled={saving || !!problem} onClick={() => save({ setting: fromDraft(draft) })}>
          {saving ? "Saving…" : "Save plan"}
        </button>
        {draft.length >= 2 && (
          <button type="button" className={leadStyles.action} disabled={saving} onClick={() => setCount(draft.length)}>
            Split equally
          </button>
        )}
        {setting && (
          <button type="button" className={leadStyles.action} disabled={saving} onClick={() => save({ setting: null })}>
            Reset to default
          </button>
        )}
        <button type="button" className={leadStyles.action} disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {problem && draft.length >= 2 && <p className={planStyles.error}>{problem}</p>}
      {error && <p className={planStyles.error}>{error}</p>}
      <p className={planStyles.hint}>
        Applies to new enrollments from now on. Students already on EMI keep their schedule — change theirs from Admin → EMI.
      </p>
    </div>
  );
}

// Admin → EMI Plans: every course and DELF option with the EMI plan it's
// sold on. Saving a plan updates the course page's checkout straight away.
export function AdminEmiPlansPage() {
  const products = useMemo(() => emiProducts(), []);
  const [settings, setSettings] = useState<EmiSettings>({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/emi-settings", { cache: "no-store" });
      if (res.ok) setSettings(await res.json());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>EMI Plans.</h1>
        <p>
          How each course can be paid in installments — how many payments, how much each, and when. Changes show on the website&rsquo;s
          course page straight away, for new enrollments.
        </p>
      </div>

      <div className={styles.tabPanel}>
        {!loaded ? (
          <p className={styles.tabHint}>Loading…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={leadStyles.table}>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Fee</th>
                  <th>EMI plan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const fee = enrollablePriceInPaise(product.enrollable);
                  const setting = settings[product.productId];
                  const stale = !!setting && !!emiSettingProblem(setting, fee);
                  const plan = resolveEmiPlan(product.enrollable, fee, setting);
                  const isDefault = !setting || stale;
                  const sameAsDefault = JSON.stringify(plan) === JSON.stringify(defaultEmiPlan(product.enrollable, fee));
                  return (
                    <Fragment key={product.productId}>
                      <tr>
                        <td>
                          <div className={planStyles.title}>{product.title}</div>
                          <div className={leadStyles.muted}>{product.group}</div>
                        </td>
                        <td>{formatRupees(fee)}</td>
                        <td>
                          {plan ? `${plan.length} payments: ${describeEmiPlan(plan)}` : "Pay in full only"}
                          <div className={leadStyles.muted}>
                            {stale
                              ? "Your saved plan no longer adds up to the fee — using the default"
                              : isDefault || sameAsDefault
                                ? "Default"
                                : "Custom"}
                          </div>
                        </td>
                        <td>
                          {editing !== product.productId && (
                            <button type="button" className={leadStyles.action} onClick={() => setEditing(product.productId)}>
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                      {editing === product.productId && (
                        <tr>
                          <td colSpan={4}>
                            <PlanEditor
                              product={product}
                              setting={stale ? undefined : setting}
                              onCancel={() => setEditing(null)}
                              onSaved={() => {
                                setEditing(null);
                                load();
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
        )}
      </div>
    </AdminShell>
  );
}
