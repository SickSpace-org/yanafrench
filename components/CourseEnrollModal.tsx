"use client";

import { motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import {
  enrollableProductId,
  enrollableTitle,
  enrollablePriceInPaise,
  type Enrollable,
} from "@/lib/courseCatalogData";
import { CURRENT_LEVELS, LEARNING_MODES, type CurrentLevel, type LearningMode } from "@/lib/courseLeadData";
import { formatRupees } from "@/lib/formatCurrency";
import { EMI_INSTALLMENT_COUNT, EMI_UPFRONT_PERCENT, emiAvailableFor, splitEmi, type PaymentPlan } from "@/lib/emiData";
import { whatsappDisplay } from "@/lib/site";
import { WhatsAppLink } from "./WhatsAppLink";
import { PhoneNumberInput, isValidPhoneNumber } from "./PhoneNumberInput";
import enrollStyles from "./EnrollModal.module.css";
import styles from "./CourseModals.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Phase = "form" | "submitted";
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
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<PaymentPlan>("full");

  const title = enrollableTitle(enrollable);
  const priceInPaise = enrollablePriceInPaise(enrollable);
  const productId = enrollableProductId(enrollable);
  // EMI: 30% to start, the rest in 3 monthly installments (see
  // lib/emiData.ts). There's no online payment — the plan is the student's
  // preference; Yana confirms payment by hand in Admin → Enrollments.
  const emiOffered = emiAvailableFor(enrollable);
  const emiSplit = splitEmi(priceInPaise);
  const whatsappMessage = `Hi Yana! I'd like to know more about ${title}.`;

  useEffect(() => {
    document.body.classList.add("enroll-modal-open");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
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
    else if (!isValidPhoneNumber(phone)) next.phone = "Enter a valid phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
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
          plan: emiOffered ? plan : "full",
        }),
      });
      if (!res.ok) throw new Error();
      setPhase("submitted");
    } catch {
      setError("Couldn't save your enrollment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className={enrollStyles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
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
        <button type="button" className={enrollStyles.close} onClick={onClose} aria-label="Close">×</button>

        {phase === "form" && (
          <>
            <div className={enrollStyles.batchTag}>Enroll now</div>
            <h3>Tell us about yourself.</h3>
            <p className={enrollStyles.batchMeta}>Send your details and Yana will get in touch to confirm your seat and share the payment details.</p>

            <div className={styles.summaryBox}>
              <span><small>Selected Course</small>{title}</span>
              <span><small>Course Fee</small>{formatRupees(priceInPaise)}</span>
            </div>

            {emiOffered && (
              <fieldset className={styles.planPicker}>
                <legend>Preferred payment plan</legend>
                <label className={plan === "full" ? styles.planOptionActive : styles.planOption}>
                  <input type="radio" name="plan" value="full" checked={plan === "full"} onChange={() => setPlan("full")} />
                  <span>
                    <strong>Pay in full</strong>
                    <small>{formatRupees(priceInPaise)}</small>
                  </span>
                </label>
                <label className={plan === "emi" ? styles.planOptionActive : styles.planOption}>
                  <input type="radio" name="plan" value="emi" checked={plan === "emi"} onChange={() => setPlan("emi")} />
                  <span>
                    <strong>Pay in EMIs</strong>
                    <small>
                      {formatRupees(emiSplit.upfront)} to start ({EMI_UPFRONT_PERCENT}%), then {EMI_INSTALLMENT_COUNT} monthly EMIs of{" "}
                      {emiSplit.installments.every((a) => a === emiSplit.installments[0])
                        ? formatRupees(emiSplit.installments[0])
                        : emiSplit.installments.map(formatRupees).join(" / ")}
                    </small>
                  </span>
                </label>
              </fieldset>
            )}

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
                  <PhoneNumberInput value={phone} onChange={setPhone} ariaInvalid={!!errors.phone} />
                  {errors.phone && <span className={styles.fieldError}>{errors.phone}</span>}
                </label>
              </div>

              <label>
                <span>WhatsApp number (optional)</span>
                <PhoneNumberInput value={whatsapp} onChange={setWhatsapp} placeholder="If different from phone" />
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

              <button type="submit" className={enrollStyles.submit} disabled={submitting}>
                {submitting ? "Sending…" : "Submit enrollment"}
              </button>
              <p className={styles.secureNote}>
                Questions first? WhatsApp Yana at{" "}
                <WhatsAppLink className={styles.inlineLink} message={whatsappMessage}>{whatsappDisplay}</WhatsAppLink>
              </p>
            </form>
          </>
        )}

        {phase === "submitted" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Enrollment received 🎉</div>
            <h3>Thanks, {name.split(" ")[0]}!</h3>
            <div className={styles.summaryBox}>
              <span><small>Course</small>{title}</span>
              <span><small>Course Fee</small>{formatRupees(priceInPaise)}</span>
              {emiOffered && <span><small>Preferred plan</small>{plan === "emi" ? `EMI — ${formatRupees(emiSplit.upfront)} to start, then ${EMI_INSTALLMENT_COUNT} monthly payments` : "Pay in full"}</span>}
            </div>
            <p className={enrollStyles.batchMeta}>
              We&apos;ve emailed a confirmation to {email}. Yana will contact you on {phone} to confirm your seat and share the payment details.
              For more info, message her on WhatsApp at {whatsappDisplay}.
            </p>
            <div className={enrollStyles.fieldRow}>
              <WhatsAppLink className={enrollStyles.submit} message={`Hi Yana! I just enrolled in ${title} on the website (${email}). Could you share the next steps?`}>Chat with Yana on WhatsApp</WhatsAppLink>
              <button type="button" className={enrollStyles.secondary} onClick={onClose}>Back to Courses</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
