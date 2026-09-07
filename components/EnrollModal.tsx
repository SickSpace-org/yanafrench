"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatTime, statusText, type Batch, type BatchCourse } from "@/lib/batchData";
import { CURRENT_LEVELS, type CurrentLevel } from "@/lib/leadData";
import { loadRazorpayScript } from "@/lib/loadRazorpayScript";
import styles from "./EnrollModal.module.css";

const COURSES: BatchCourse[] = ["TEF", "TCF", "DELF"];

// Flat test-mode price for every batch — matches ENROLLMENT_FEE_PAISE in
// app/api/payment/create-order/route.ts, which is the value actually
// charged (the server never trusts an amount from the client).
const ENROLLMENT_FEE_LABEL = "₹1";

function canSelect(batch: Batch) {
  return (batch.status !== "full" && batch.seats_remaining > 0) || batch.status === "waitlist";
}

export type EnrollDetails = {
  name: string;
  phone: string;
  email: string;
  currentLevel: CurrentLevel | "";
  notes: string;
};

type Phase = "form" | "processing" | "paid" | "payment_failed";

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export function EnrollModal({
  batches,
  initialBatch,
  onClose,
  onSubmit,
}: {
  batches: Batch[];
  initialBatch: Batch;
  onClose: () => void;
  // Persists the lead and returns its id, used to tie the payment back to it.
  onSubmit: (batch: Batch, details: EnrollDetails) => string;
}) {
  const [course, setCourse] = useState<BatchCourse>(initialBatch.course);
  const [batchId, setBatchId] = useState(initialBatch.id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel | "">("");
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<{ batch: Batch; leadId: string } | null>(null);

  // The site nav is a fixed, high-z-index pill that otherwise sits on top
  // of this modal (and, worse, on top of Razorpay's own checkout overlay
  // once payment opens — the whole point of hiding it), blocking the close
  // controls of whichever is on top. Hidden for as long as this modal is
  // mounted, regardless of phase.
  useEffect(() => {
    document.body.classList.add("enroll-modal-open");
    return () => document.body.classList.remove("enroll-modal-open");
  }, []);

  const courseBatches = useMemo(
    () => batches.filter((b) => b.course === course && canSelect(b)),
    [batches, course]
  );

  const batch = useMemo(
    () => courseBatches.find((b) => b.id === batchId) || courseBatches[0] || null,
    [courseBatches, batchId]
  );

  function handleCourseChange(next: BatchCourse) {
    setCourse(next);
    const firstOfCourse = batches.find((b) => b.course === next && canSelect(b));
    setBatchId(firstOfCourse?.id ?? "");
  }

  async function startPayment(target: Batch, leadId: string) {
    setPhase("processing");
    setError(null);
    pendingRef.current = { batch: target, leadId };

    try {
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk || !window.Razorpay) {
        throw new Error("Couldn't load the payment widget. Check your connection and try again.");
      }

      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          name,
          email,
          phone,
          course: target.course,
          batchId: target.id,
          batchName: target.name,
        }),
      });
      if (!orderRes.ok) throw new Error("Couldn't start the payment. Please try again.");
      const order = await orderRes.json();

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "The Français Hub",
        description: `${target.course} enrollment · ${target.name}`,
        prefill: { name, email, contact: phone },
        // Explicitly opt every method category in — Razorpay's default
        // checkout otherwise sometimes narrows to just Card on a fresh test
        // account. UPI is what actually surfaces Google Pay / PhonePe /
        // Paytm as tappable options on a mobile browser (via UPI intent);
        // on desktop, UPI renders as a QR code / "enter UPI ID" instead of
        // named app icons — that's Razorpay's own behavior, not something
        // this config can change.
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          paylater: true,
        },
        theme: { color: "#1F3A5F" },
        handler: async (response: RazorpaySuccessResponse) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...response, leadId }),
            });
            if (!verifyRes.ok) throw new Error();
            setPhase("paid");
          } catch {
            setError("Payment went through, but we couldn't confirm it automatically — Yana will verify manually.");
            setPhase("payment_failed");
          }
        },
        modal: {
          ondismiss: () => {
            setError("Payment wasn't completed. Your enrollment inquiry is still saved — Yana can follow up, or you can try paying again.");
            setPhase("payment_failed");
          },
        },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong starting the payment.");
      setPhase("payment_failed");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!batch || !name.trim() || !phone.trim() || !email.trim()) return;
    const leadId = onSubmit(batch, { name: name.trim(), phone: phone.trim(), email: email.trim(), currentLevel, notes: notes.trim() });
    startPayment(batch, leadId);
  }

  function retryPayment() {
    if (!pendingRef.current) return;
    startPayment(pendingRef.current.batch, pendingRef.current.leadId);
  }

  return (
    <AnimatePresence>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={phase === "processing" ? undefined : onClose}
      >
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 18, scale: .97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: .98 }}
          transition={{ duration: .25 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Enroll for a batch"
        >
          {phase !== "processing" && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
          )}

          {phase === "paid" && (
            <div className={styles.success}>
              <div className={styles.batchTag}>Payment received</div>
              <h3>Thanks, {name.split(" ")[0]}!</h3>
              <p className={styles.batchMeta}>
                Your {ENROLLMENT_FEE_LABEL} enrollment payment for the {pendingRef.current?.batch.course} batch is confirmed. Yana will personally reach out on {phone} or {email} to finalize your seat.
              </p>
              <button type="button" className={styles.submit} onClick={onClose}>Done</button>
            </div>
          )}

          {phase === "processing" && (
            <div className={styles.success}>
              <div className={styles.batchTag}>Processing</div>
              <h3>Opening secure payment…</h3>
              <p className={styles.batchMeta}>Complete the {ENROLLMENT_FEE_LABEL} payment in the Razorpay window. Don&apos;t close this tab.</p>
            </div>
          )}

          {phase === "payment_failed" && (
            <div className={styles.success}>
              <div className={styles.batchTag}>Payment not completed</div>
              <h3>Your enquiry is still saved.</h3>
              <p className={styles.batchMeta}>{error}</p>
              <div className={styles.fieldRow}>
                <button type="button" className={styles.submit} onClick={retryPayment}>Try payment again</button>
                <button type="button" className={styles.secondary} onClick={onClose}>I&apos;ll pay later</button>
              </div>
            </div>
          )}

          {phase === "form" && (
            <>
              <div className={styles.batchTag}>Enroll now</div>
              <h3>Tell Yana about yourself.</h3>
              <p className={styles.batchMeta}>A {ENROLLMENT_FEE_LABEL} test payment confirms your enrollment inquiry via Razorpay — Yana still confirms your seat personally.</p>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.fieldRow}>
                  <label>
                    <span>Course</span>
                    <select value={course} onChange={(e) => handleCourseChange(e.target.value as BatchCourse)}>
                      {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Batch</span>
                    {courseBatches.length ? (
                      <select value={batch?.id ?? ""} onChange={(e) => setBatchId(e.target.value)}>
                        {courseBatches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} · {b.days.join("/")} {formatTime(b.start_time)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select disabled><option>No open batches</option></select>
                    )}
                  </label>
                </div>

                {batch && (
                  <p className={styles.batchSummary}>
                    {batch.days.join(" · ")} · {formatTime(batch.start_time)}–{formatTime(batch.end_time)} · {statusText(batch)}
                  </p>
                )}

                <label>
                  <span>Full name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                </label>

                <div className={styles.fieldRow}>
                  <label>
                    <span>Phone number</span>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9XXXXXXXXX" required />
                  </label>
                  <label>
                    <span>Email</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
                  </label>
                </div>

                <label>
                  <span>Current French level (optional)</span>
                  <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value as CurrentLevel | "")}>
                    <option value="">Not sure / prefer to discuss</option>
                    {CURRENT_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </label>

                <label>
                  <span>Anything Yana should know? (optional)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Target exam date, scheduling constraints, goals…"
                    rows={3}
                  />
                </label>

                <button type="submit" className={styles.submit} disabled={!batch}>
                  Pay {ENROLLMENT_FEE_LABEL} &amp; submit
                </button>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
