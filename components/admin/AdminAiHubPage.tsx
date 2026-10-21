"use client";

import { useState } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { AI_HUB_PRICE_LABEL, type AdminAiHubMember, type AiHubAccess, type AiHubTopic } from "@/lib/aiHubData";
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

      <TopicsPanel />
    </AdminShell>
  );
}

// Speaking topics: students get one of these (or a built-in one) at random
// when they press "Give me a topic" in Speak as monologue.
function TopicsPanel() {
  const { items: topics, loaded, remove, refresh } = useAdminCollection<AiHubTopic>("/api/ai-hub/topics");
  const [topic, setTopic] = useState("");
  const [points, setPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-hub/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, points }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || "Couldn't save the topic.");
        return;
      }
      setTopic("");
      setPoints("");
      refresh();
    } catch {
      setError("Couldn't save the topic.");
    } finally {
      setSaving(false);
    }
  }

  const field = { padding: ".6rem .8rem", font: "inherit", borderRadius: 8, border: "1px solid #ccc" } as const;

  return (
    <div className={styles.tabPanel}>
      <h2 style={{ fontSize: "1.1rem", margin: ".4rem 0 0" }}>Speaking topics</h2>
      <p className={styles.tabHint}>
        Add topics for the <strong>Speak as monologue</strong> practice. When a student presses <em>Give me a topic</em> they get one of yours (or one of the built-in
        topics) at random. Write them in French, or in English if you want the student to work out the French.
      </p>
      <form onSubmit={add} style={{ display: "grid", gap: ".6rem", maxWidth: 640 }}>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="e.g. Faut-il interdire les téléphones à l'école ? Défendez votre opinion."
          style={field}
        />
        <input value={points} onChange={(e) => setPoints(e.target.value)} maxLength={300} placeholder="Points to cover, separated by commas (optional)" style={field} />
        <div>
          <button type="submit" className={leadStyles.action} disabled={saving || !topic.trim()}>
            {saving ? "Adding…" : "Add topic"}
          </button>
        </div>
        {error && <p className={leadStyles.confirmError}>{error}</p>}
      </form>

      {!loaded ? (
        <p className={styles.tabHint}>Loading…</p>
      ) : topics.length === 0 ? (
        <div className={leadStyles.empty}>No topics added yet — students are getting the built-in ones.</div>
      ) : (
        <table className={leadStyles.table}>
          <thead>
            <tr>
              <th>Your topics ({topics.length})</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.topic}</strong>
                  {t.points && <div className={leadStyles.muted}>{t.points}</div>}
                </td>
                <td>
                  <button
                    type="button"
                    className={leadStyles.remove}
                    onClick={() => {
                      if (window.confirm("Remove this topic?")) remove(t.id);
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
