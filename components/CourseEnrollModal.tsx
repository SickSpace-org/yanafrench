"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  enrollableProductId,
  enrollableTitle,
  enrollablePriceInPaise,
  type Enrollable,
} from "@/lib/courseCatalogData";
import { CURRENT_LEVELS, LEARNING_MODES, type CurrentLevel, type LearningMode } from "@/lib/courseLeadData";
import { formatRupees } from "@/lib/formatCurrency";
import { createCourseOrder, openCourseCheckout, type RazorpaySuccessResponse } from "@/lib/coursePayment";
import { WhatsAppLink } from "./WhatsAppLink";
import enrollStyles from "./EnrollModal.module.css";
import styles from "./CourseModals.module.css";

// Digits only, plus a single optional leading "+" for any country code —
// copied from components/EnrollModal.tsx rather than imported, so the two
// enrollment flows stay fully decoupled (per the isolation requirement in
// docs/superpowers/specs/2026-09-10-courses-section-design.md).
function sanitizePhone(value: string) {
  const hasLeadingPlus = value.trimStart().startsWith("+");
  const digitsAndSpaces = value.replace(/[^\d\s]/g, "");
  return hasLeadingPlus ? `+${digitsAndSpaces.trimStart()}` : digitsAndSpaces;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s]{7,15}$/;

type Phase = "form" | "payment" | "processing" | "paid" | "payment_failed";
type FieldErrors = Partial<Record<"name" | "email" | "phone", string>>;

export function CourseEnrollModal({ enrollable, onClose }: { enrollable: Enrollable; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel | "">("");
  const [preferredMode, setPreferredMode] = useState<LearningMode | "">("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<{ leadId: string } | null>(null);

  const title = enrollableTitle(enrollable);
  const priceInPaise = enrollablePriceInPaise(enrollable);
  const productId = enrollableProductId(enrollable);

  useEffect(() => {
    document.body.classList.add("enroll-modal-open");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "processing") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("enroll-modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, phase]);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!phone.trim()) next.phone = "Phone number is required.";
    else if (!PHONE_RE.test(phone.trim())) next.phone = "Enter a valid phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      const res = await fetch("/api/course-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          productId,
          productTitle: title,
          currentLevel: currentLevel || undefined,
          preferredMode: preferredMode || undefined,
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      const { leadId } = (await res.json()) as { leadId: string };
      pendingRef.current = { leadId };
      setPhase("payment");
    } catch {
      setError("Couldn't save your enrollment. Please try again.");
    }
  }

  async function startPayment() {
    if (!pendingRef.current) return;
    setPhase("processing");
    setError(null);

    try {
      const order = await createCourseOrder({
        leadId: pendingRef.current.leadId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        productId,
      });

      await openCourseCheckout(
        order,
        { name: name.trim(), email: email.trim(), phone: phone.trim() },
        {
          onSuccess: async (response: RazorpaySuccessResponse) => {
            try {
              const verifyRes = await fetch("/api/course-payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...response, leadId: pendingRef.current?.leadId }),
              });
              if (!verifyRes.ok) throw new Error();
              setPhase("paid");
            } catch {
              setError("Payment went through, but we couldn't confirm it automatically — we'll verify manually.");
              setPhase("payment_failed");
            }
          },
          onDismiss: () => {
            setError("Payment wasn't completed. Your enrollment is still saved — you can try paying again.");
            setPhase("payment_failed");
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong starting the payment.");
      setPhase("payment_failed");
    }
  }

  return (
    <motion.div
      className={enrollStyles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={phase === "processing" ? undefined : onClose}
    >
      <motion.div
        className={enrollStyles.card}
        initial={{ opacity: 0, y: 18, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: .98 }}
        transition={{ duration: .25 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Enroll for a course"
      >
        {phase !== "processing" && (
          <button type="button" className={enrollStyles.close} onClick={onClose} aria-label="Close">×</button>
        )}

        {phase === "form" && (
          <>
            <div className={enrollStyles.batchTag}>Enroll now</div>
            <h3>Tell us about yourself.</h3>
            <p className={enrollStyles.batchMeta}>A few details, then continue to payment to secure your seat.</p>

            <div className={styles.summaryBox}>
              <span><small>Selected Course</small>{title}</span>
              <span><small>Course Fee</small>{formatRupees(priceInPaise)}</span>
            </div>

            <form className={enrollStyles.form} onSubmit={handleFormSubmit} noValidate>
              <label>
                <span>Full name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-invalid={errors.name ? "true" : "false"} />
                {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
              </label>

              <div className={enrollStyles.fieldRow}>
                <label>
                  <span>Email address *</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-invalid={errors.email ? "true" : "false"} />
                  {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                </label>
                <label>
                  <span>Phone number *</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                    placeholder="e.g. +91 98765 43210"
                    aria-invalid={errors.phone ? "true" : "false"}
                  />
                  {errors.phone && <span className={styles.fieldError}>{errors.phone}</span>}
                </label>
              </div>

              <label>
                <span>WhatsApp number (optional)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(sanitizePhone(e.target.value))}
                  placeholder="If different from phone"
                />
              </label>

              <div className={enrollStyles.fieldRow}>
                <label>
                  <span>Current French level</span>
                  <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value as CurrentLevel | "")}>
                    <option value="">Not sure / prefer to discuss</option>
                    {CURRENT_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </label>
                <label>
                  <span>Preferred learning mode</span>
                  <select value={preferredMode} onChange={(e) => setPreferredMode(e.target.value as LearningMode | "")}>
                    <option value="">No preference</option>
                    {LEARNING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>

              <label>
                <span>Message / additional requirements (optional)</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Target exam date, scheduling constraints, goals…" rows={3} />
              </label>

              {error && <p className={styles.formError}>{error}</p>}

              <button type="submit" className={enrollStyles.submit}>Continue to Payment</button>
            </form>
          </>
        )}

        {phase === "payment" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Complete Your Enrollment</div>
            <h3>{title}</h3>
            <div className={styles.summaryBox}>
              <span><small>Student</small>{name}</span>
              <span><small>Course Fee</small>{formatRupees(priceInPaise)}</span>
            </div>
            <p className={styles.secureNote}>🔒 Secure payment via Razorpay</p>
            {error && <p className={styles.formError}>{error}</p>}
            <button type="button" className={enrollStyles.submit} onClick={startPayment}>Pay Now</button>
            <button type="button" className={enrollStyles.secondary} onClick={() => setPhase("form")}>Back to Enrollment</button>
          </div>
        )}

        {phase === "processing" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Processing</div>
            <h3>Opening secure payment…</h3>
            <p className={enrollStyles.batchMeta}>Complete the {formatRupees(priceInPaise)} payment in the Razorpay window. Don&apos;t close this tab.</p>
          </div>
        )}

        {phase === "paid" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Enrollment Successful 🎉</div>
            <h3>Thanks, {name.split(" ")[0]}!</h3>
            <div className={styles.summaryBox}>
              <span><small>Course</small>{title}</span>
              <span><small>Student</small>{name}</span>
              <span><small>Amount Paid</small>{formatRupees(priceInPaise)}</span>
            </div>
            <p className={enrollStyles.batchMeta}>Your enrollment has been successfully submitted. We&apos;ll reach out on {phone} or {email} to get you started.</p>
            <div className={enrollStyles.fieldRow}>
              <button type="button" className={enrollStyles.submit} onClick={onClose}>Back to Courses</button>
              <WhatsAppLink className={enrollStyles.secondary} message={`Hi! I just enrolled in ${title} and would like to know the next steps.`}>Contact The Français Hub</WhatsAppLink>
            </div>
          </div>
        )}

        {phase === "payment_failed" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Payment Unsuccessful</div>
            <h3>Your payment couldn&apos;t be completed.</h3>
            <p className={enrollStyles.batchMeta}>{error}</p>
            <div className={enrollStyles.fieldRow}>
              <button type="button" className={enrollStyles.submit} onClick={startPayment}>Try Again</button>
              <button type="button" className={enrollStyles.secondary} onClick={() => setPhase("form")}>Back to Enrollment</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
