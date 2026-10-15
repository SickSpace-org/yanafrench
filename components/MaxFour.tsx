"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [value, setValue] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setValue(to); return; }
    const controls = animate(0, to, {
      duration: 1.3,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return <span ref={ref}>{value}</span>;
}

export function MaxFour() {
  return (
    <section className="section max-four">
      <div className="container max-four__grid">
        <Reveal>
          <p className="eyebrow">A deliberately smaller room</p>
          <div className="max-four__number">0<CountUp to={5}/><span>.</span></div>
        </Reveal>
        <Reveal className="max-four__copy" delay={.12}>
          <h2>Students.<br/>Maximum.</h2>
          <p>Because language learning shouldn&apos;t feel anonymous. Batches stay intentionally small so every learner has room to speak, ask, adapt and progress.</p>
        </Reveal>
      </div>
    </section>
  );
}
