"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BOOKING_LABELS,
  formatSlotDate,
  formatSlotDay,
  formatSlotTime,
  formatSlotWhen,
  groupSlotsByDate,
  type BookingKind,
  type PublicSlot,
} from "@/lib/bookingData";
import { orientationLevels as defaultOrientationLevels, type OrientationLevel } from "@/lib/courseCatalogData";
import { CURRENT_LEVELS } from "@/lib/courseLeadData";
import { formatRupees } from "@/lib/formatCurrency";
import { whatsappDisplay } from "@/lib/site";
import { WhatsAppLink } from "./WhatsAppLink";
import { WhatsAppCountdown } from "./WhatsAppCountdown";
import { PhoneNumberInput, isValidPhoneNumber } from "./PhoneNumberInput";
import enrollStyles from "./EnrollModal.module.css";
import courseStyles from "./CourseModals.module.css";
import styles from "./BookingModal.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Seat counts refresh while the modal is open, so a slot that fills up
// while someone is choosing turns to "Full".
const POLL_MS = 8000;

// Last-known slots per kind, so the modal opens with times already shown
// (then refreshes). prefetchBookingSlots() warms it from the page that
// hosts the booking button, before anyone clicks.
const slotCache = new Map<BookingKind, PublicSlot[]>();
const inflight = new Map<BookingKind, Promise<PublicSlot[]>>();

function fetchSlots(kind: BookingKind): Promise<PublicSlot[]> {
  const pending = inflight.get(kind);
  if (pending) return pending;
  const request = fetch(`/api/bookings/slots?kind=${kind}`, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error();
      return res.json() as Promise<PublicSlot[]>;
    })
    .then((slots) => {
      slotCache.set(kind, slots);
      return slots;
    })
    .finally(() => inflight.delete(kind));
  inflight.set(kind, request);
  return request;
}

export function prefetchBookingSlots(kind: BookingKind) {
  if (!slotCache.has(kind)) fetchSlots(kind).catch(() => {});
}

type FieldErrors = Partial<Record<"slot" | "name" | "email" | "phone", string>>;

const INTRO: Record<BookingKind, string> = {
  orientation: "Pick a time for your placement test. Each slot takes at most 5 students.",
  demo: "Pick a time for your free demo class. Each slot takes at most 5 students.",
};

// The WhatsApp message opened after booking. The Orientation Test is paid,
// so it asks Yana for the payment details; the Demo Class is free.
function bookedWhatsappMessage(kind: BookingKind, startsAt: string, name: string, email: string, orientation?: OrientationLevel): string {
  const when = formatSlotWhen(startsAt);
  if (kind === "orientation" && orientation) {
    return `Hi Yana! I'm ${name.trim()} (${email.trim()}). I've booked the French Orientation Test — ${orientation.level} (${formatRupees(orientation.priceInPaise)}) for ${when}. Please share the details for payment.`;
  }
  return `Hi Yana! I'm ${name.trim()} (${email.trim()}). I've booked the free Demo Class for ${when}. Looking forward to it!`;
}

// Slot picker + details form for the Orientation Test and the Demo Class
// (see lib/bookingData.ts). Booking goes through app/api/bookings, which
// emails the student and the admin.
export function BookingModal({
  kind,
  initialLevel,
  levels: orientationLevels = defaultOrientationLevels,
  onClose,
}: {
  kind: BookingKind;
  initialLevel?: OrientationLevel["level"];
  levels?: OrientationLevel[]; // the live Orientation Test fees (Admin → Courses)
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<PublicSlot[] | null>(() => slotCache.get(kind) ?? null);
  const [loadError, setLoadError] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [level, setLevel] = useState<string>(initialLevel ?? (kind === "orientation" ? "A1" : ""));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<{ startsAt: string } | null>(null);

  const what = BOOKING_LABELS[kind];
  const orientation = kind === "orientation" ? orientationLevels.find((o) => o.level === level) : undefined;

  const loadSlots = useCallback(async () => {
    try {
      setSlots(await fetchSlots(kind));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [kind]);

  useEffect(() => {
    if (booked) return;
    loadSlots();
    const timer = setInterval(loadSlots, POLL_MS);
    return () => clearInterval(timer);
  }, [loadSlots, booked]);

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
  }, [onClose]);

  const days = useMemo(() => groupSlotsByDate(slots ?? []), [slots]);
  // Default to the first day that still has a free seat.
  const activeDate = date && days.some((d) => d.date === date)
    ? date
    : (days.find((d) => d.slots.some((s) => s.booked < s.capacity)) ?? days[0])?.date ?? null;
  const activeDay = days.find((d) => d.date === activeDate);
  const selected = slots?.find((s) => s.id === slotId) ?? null;
  const selectedIsFull = !!selected && selected.booked >= selected.capacity;

  // If the chosen slot fills up (or disappears) on a refresh, drop it.
  useEffect(() => {
    if (slotId && slots && (!selected || selectedIsFull)) {
      setSlotId(null);
      setError("Sorry, the time you picked just filled up. Please choose another one.");
    }
  }, [slots, slotId, selected, selectedIsFull]);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!slotId) next.slot = "Pick a date and time first.";
    if (!name.trim()) next.name = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!phone.trim()) next.phone = "Phone number is required.";
    else if (!isValidPhoneNumber(phone)) next.phone = "Enter a valid phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slotId, name: name.trim(), email: email.trim(), phone: phone.trim(), level: level || undefined, message: message.trim() }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Couldn't save your booking. Please try again.");
        if (res.status === 409 || res.status === 404) {
          setSlotId(null);
          loadSlots();
        }
        return;
      }
      const data = (await res.json()) as { startsAt: string };
      setBooked({ startsAt: data.startsAt });
    } catch {
      setError("Couldn't save your booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div className={enrollStyles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className={`${enrollStyles.card} ${styles.card}`}
        initial={{ opacity: 0, y: 18, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: .98 }}
        transition={{ duration: .25 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Book the ${what}`}
      >
        <button type="button" className={enrollStyles.close} onClick={onClose} aria-label="Close">×</button>

        {!booked && (
          <>
            <div className={enrollStyles.batchTag}>Book the {what}</div>
            <h3>Choose your time.</h3>
            <p className={enrollStyles.batchMeta}>{INTRO[kind]} All times are in Indian Standard Time (IST).</p>

            <section aria-label="Available time slots" className={styles.picker}>
              {slots === null && !loadError && <p className={styles.hint}>Loading available times…</p>}
              {slots === null && loadError && (
                <p className={courseStyles.formError}>
                  Couldn&apos;t load the time slots.{" "}
                  <button type="button" className={styles.retry} onClick={loadSlots}>Try again</button>
                </p>
              )}
              {slots !== null && days.length === 0 && (
                <p className={styles.hint}>
                  There are no open slots right now. Message Yana on{" "}
                  <WhatsAppLink className={courseStyles.inlineLink} message={`Hi Yana! I'd like to book the ${what}. Are there any slots available?`}>WhatsApp</WhatsAppLink>{" "}
                  and she&apos;ll find you a time.
                </p>
              )}

              {days.length > 0 && (
                <>
                  <div className={styles.days} role="tablist" aria-label="Pick a date">
                    {days.map((d) => {
                      const { weekday, day, month } = formatSlotDay(d.slots[0].startsAt);
                      const free = d.slots.some((s) => s.booked < s.capacity);
                      const active = d.date === activeDate;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={`${styles.day} ${active ? styles.dayActive : ""} ${free ? "" : styles.dayFull}`}
                          onClick={() => setDate(d.date)}
                        >
                          <span>{weekday}</span>
                          <strong>{day}</strong>
                          <span>{free ? month : "Full"}</span>
                        </button>
                      );
                    })}
                  </div>

                  {activeDay && (
                    <div role="tabpanel">
                      <p className={styles.dayLabel}>{formatSlotDate(activeDay.slots[0].startsAt)}</p>
                      <div className={styles.times} role="radiogroup" aria-label="Pick a time">
                        {activeDay.slots.map((s) => {
                          const left = s.capacity - s.booked;
                          const full = left <= 0;
                          const active = s.id === slotId;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              disabled={full}
                              className={`${styles.time} ${active ? styles.timeActive : ""}`}
                              onClick={() => {
                                setSlotId(s.id);
                                setError(null);
                                setErrors((prev) => ({ ...prev, slot: undefined }));
                              }}
                            >
                              <strong>{formatSlotTime(s.startsAt)}</strong>
                              <span>{full ? "Full" : `${left} ${left === 1 ? "seat" : "seats"} left`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
              {errors.slot && <span className={courseStyles.fieldError}>{errors.slot}</span>}
            </section>

            {selected && (
              <div className={courseStyles.summaryBox}>
                <span><small>{what}</small>{formatSlotWhen(selected.startsAt)}</span>
                {orientation && <span><small>Test fee</small>{orientation.level} · {formatRupees(orientation.priceInPaise)}</span>}
                {kind === "demo" && <span><small>Fee</small>Free</span>}
              </div>
            )}

            <form className={enrollStyles.form} onSubmit={handleSubmit} noValidate>
              {kind === "orientation" ? (
                <fieldset className={styles.levels}>
                  <legend>Test level *</legend>
                  <div>
                    {orientationLevels.map((o) => (
                      <button
                        key={o.level}
                        type="button"
                        aria-pressed={level === o.level}
                        className={`${styles.level} ${level === o.level ? styles.levelActive : ""}`}
                        onClick={() => setLevel(o.level)}
                      >
                        <strong>{o.level}</strong>
                        <span>{formatRupees(o.priceInPaise)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <label>
                <span>Full name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" aria-invalid={errors.name ? "true" : "false"} />
                {errors.name && <span className={courseStyles.fieldError}>{errors.name}</span>}
              </label>

              <div className={enrollStyles.fieldRow}>
                <label>
                  <span>Email address *</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" aria-invalid={errors.email ? "true" : "false"} />
                  {errors.email && <span className={courseStyles.fieldError}>{errors.email}</span>}
                </label>
                <label>
                  <span>Phone number *</span>
                  <PhoneNumberInput value={phone} onChange={setPhone} ariaInvalid={!!errors.phone} />
                  {errors.phone && <span className={courseStyles.fieldError}>{errors.phone}</span>}
                </label>
              </div>

              {kind === "demo" && (
                <label>
                  <span>Current French level</span>
                  <select value={level} onChange={(e) => setLevel(e.target.value)}>
                    <option value="">Not sure / prefer to discuss</option>
                    {CURRENT_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </label>
              )}

              <label>
                <span>Message (optional)</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your goals, target exam, anything Yana should know…" rows={2} />
              </label>

              {error && <p className={courseStyles.formError} role="alert">{error}</p>}

              <button type="submit" className={enrollStyles.submit} disabled={submitting || !slotId}>
                {submitting ? "Booking…" : selected ? `Book ${formatSlotTime(selected.startsAt)} on ${formatSlotDay(selected.startsAt).day} ${formatSlotDay(selected.startsAt).month}` : "Pick a time to continue"}
              </button>
              <p className={courseStyles.secureNote}>
                Questions first? WhatsApp Yana at{" "}
                <WhatsAppLink className={courseStyles.inlineLink} message={`Hi Yana! I have a question about the ${what}.`}>{whatsappDisplay}</WhatsAppLink>
              </p>
            </form>
          </>
        )}

        {booked && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>You&apos;re booked 🎉</div>
            <h3>See you soon, {name.split(" ")[0]}!</h3>
            <div className={courseStyles.summaryBox} style={{ alignSelf: "stretch" }}>
              <span><small>{what}</small>{formatSlotWhen(booked.startsAt)}</span>
              {orientation && <span><small>Level &amp; fee</small>{orientation.level} · {formatRupees(orientation.priceInPaise)}</span>}
            </div>
            <p className={enrollStyles.batchMeta}>
              We&apos;ve emailed the details to {email}.{" "}
              {orientation
                ? "Send Yana your booking on WhatsApp and she'll share the payment details for the test fee, then the joining link before your slot."
                : "The demo class is free — Yana will share the joining link before your slot."}
            </p>
            <WhatsAppCountdown
              seconds={4}
              message={bookedWhatsappMessage(kind, booked.startsAt, name, email, orientation)}
              hint={orientation ? "Your booking message is ready — Yana will reply with the payment details." : "Your booking message is ready to send."}
            />
            <button type="button" className={enrollStyles.secondary} onClick={onClose} style={{ alignSelf: "stretch" }}>Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
