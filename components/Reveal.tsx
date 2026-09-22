"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 24,
  eager = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  // For content that's above the fold on load (PageHero's heading block,
  // say) — whileInView still needs a real IntersectionObserver tick plus
  // Framer Motion's JS to hydrate before it fires, which held the LCP
  // element at opacity:0 for 1.6s+ in production profiling. `eager` skips
  // the from-hidden entrance only on first mount (renders already at the
  // animate target — same instant paint a plain div would have) while
  // whileInView still re-triggers normally on every later scroll in/out,
  // so nothing here changes what content shows or how it's laid out.
  eager?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce || eager ? false : { opacity: 0, y }}
      whileInView={reduce ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-10%" }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
