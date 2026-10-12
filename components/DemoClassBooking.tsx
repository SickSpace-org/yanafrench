"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { DemoClassCard } from "./DemoClassCard";
import { BookingModal } from "./BookingModal";

// The /demo-class page's card + booking modal.
export function DemoClassBooking() {
  const [open, setOpen] = useState(false);
  return (
    <section className="section">
      <div className="container">
        <DemoClassCard onBook={() => setOpen(true)} />
      </div>
      <AnimatePresence>{open && <BookingModal kind="demo" onClose={() => setOpen(false)} />}</AnimatePresence>
    </section>
  );
}
