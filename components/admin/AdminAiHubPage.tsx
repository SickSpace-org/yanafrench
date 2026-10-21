"use client";

import { useState } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { AI_HUB_PRICE_LABEL, type AdminAiHubMember, type AiHubAccess } from "@/lib/aiHubData";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";

const ACCESS_LABEL: Record<AiHubAccess, string> = {
  pending: "Awaiting payment",
  active: "Active",
  expired: "Expired",
  deactivated: "Paused",
};

const ACCESS_CLASS: Record<AiHubAccess, string> = {
  pending: leadStyles.payment_pending,
  active: leadStyles.payment_paid,
  expired: leadStyles.payment_failed,
  deactivated: leadStyles.payment_failed,
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

// Admin -> Le Kiosque: people who asked to join Le Kiosque
// ($45 CAD / month, paid to Yana over WhatsApp). "Payment received" creates
// their login the first time and adds 30 days of access every time. See
// app/api/ai-hub/members.
export function AdminAiHubPage() {
  const { items: members, loaded, remove, refresh } = useAdminCollection<AdminAiHubMember>("/api/ai-hub/members");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(m: AdminAiHubMember, action: "payment" | "deactivate" | "reactivate") {
    setBusyId(m.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/ai-hub/members/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setNotice({ ok: false, text: (await res.text().catch(() => "")) || "Something went wrong." });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (action === "payment") {
        const until = data.expiresAt ? ` Access runs until ${formatDate(data.expiresAt)}.` : "";
        if (data.emailSent === false) {
          setNotice({ ok: true, text: `Payment recorded for ${m.fullName} — they can enter with ${m.email} now. (The welcome email couldn't be sent, so tell them yourself.)${until}` });
        } else {
          setNotice({ ok: true, text: `Payment recorded for ${m.fullName} — they can now enter with ${m.email}.${until}` });
        }
      } else {
        setNotice({ ok: true, text: action === "deactivate" ? `${m.fullName}'s access is paused.` : `${m.fullName} has access again.` });
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong." });
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  const pending = members.filter((m) => m.access === "pending");
  const others = members.filter((m) => m.access !== "pending");

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Le Kiosque.</h1>
        <p>
          Le Kiosque costs {AI_HUB_PRICE_LABEL}. People ask to join on the public Le Kiosque page and message you on WhatsApp. When their
          payment arrives, press <strong>Payment received</strong> — they can then enter Le Kiosque just by typing their email (no password), and get 30 days of access.
          Press it again each month when they renew.
        </p>
      </div>

      <div className={styles.tabPanel}>
        {notice && (
          <p className={notice.ok ? leadStyles.banner : leadStyles.confirmError}>
            {notice.text}
          </p>
        )}

        {!loaded ? (
          <p className={styles.tabHint}>Loading…</p>
        ) : members.length === 0 ? (
          <div className={leadStyles.empty}>No one has asked to join yet.</div>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <h2 style={{ fontSize: "1.1rem", margin: ".4rem 0 0" }}>Waiting for payment ({pending.length})</h2>
                <MemberTable members={pending} busyId={busyId} act={act} remove={remove} />
              </>
            )}
            {others.length > 0 && (
              <>
                <h2 style={{ fontSize: "1.1rem", margin: ".8rem 0 0" }}>Members ({others.length})</h2>
                <MemberTable members={others} busyId={busyId} act={act} remove={remove} />
              </>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function MemberTable({
  members,
  busyId,
  act,
  remove,
}: {
  members: AdminAiHubMember[];
  busyId: string | null;
  act: (m: AdminAiHubMember, action: "payment" | "deactivate" | "reactivate") => void;
  remove: (id: string) => void;
}) {
  return (
    <table className={leadStyles.table}>
      <thead>
        <tr>
          <th>Person</th>
          <th>Status</th>
          <th>Access until</th>
          <th />
          <th />
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.id}>
            <td className={leadStyles.contact}>
              <strong>{m.fullName}</strong>
              <div>
                <a href={`mailto:${m.email}`}>{m.email}</a>
              </div>
              {m.whatsapp && (
                <div>
                  <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    {m.whatsapp}
                  </a>
                </div>
              )}
              <div className={leadStyles.muted}>Asked {formatDate(m.requestedAt)}</div>
            </td>
            <td>
              <span className={`${leadStyles.payment} ${ACCESS_CLASS[m.access]}`}>{ACCESS_LABEL[m.access]}</span>
            </td>
            <td>
              {m.expiresAt ? (
                <>
                  {formatDate(m.expiresAt)}
                  {m.access === "active" && <div className={leadStyles.muted}>{m.daysLeft} day{m.daysLeft === 1 ? "" : "s"} left</div>}
                </>
              ) : (
                <span className={leadStyles.muted}>—</span>
              )}
            </td>
            <td>
              <div className={leadStyles.actions}>
                <button type="button" className={leadStyles.action} disabled={busyId === m.id} onClick={() => act(m, "payment")}>
                  {m.hasPaid ? "Payment received (+30 days)" : "Payment received"}
                </button>
                {m.hasPaid && m.access !== "deactivated" && (
                  <button type="button" className={leadStyles.action} disabled={busyId === m.id} onClick={() => act(m, "deactivate")}>
                    Pause access
                  </button>
                )}
                {m.access === "deactivated" && (
                  <button type="button" className={leadStyles.action} disabled={busyId === m.id} onClick={() => act(m, "reactivate")}>
                    Restore access
                  </button>
                )}
              </div>
            </td>
            <td>
              <button
                type="button"
                className={leadStyles.remove}
                onClick={() => {
                  if (window.confirm(`Remove ${m.fullName}? Their saved words and quiz history are deleted too.`)) remove(m.id);
                }}
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
