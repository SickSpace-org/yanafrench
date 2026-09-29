"use client";

import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import { useRef, useState } from "react";

export function LanguageJourney() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [eyebrowVisible, setEyebrowVisible] = useState(true);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setEyebrowVisible(v <= 0.005 || v >= 0.86);
  });
  const y1 = useTransform(scrollYProgress, [0,.24,.3], [0,0,-110]);
  const o1 = useTransform(scrollYProgress, [0,.2,.3], [1,1,0]);
  const y2 = useTransform(scrollYProgress, [.22,.35,.5], [90,0,-110]);
  const o2 = useTransform(scrollYProgress, [.22,.34,.46,.52], [0,1,1,0]);
  const y3 = useTransform(scrollYProgress, [.47,.6,.74], [90,0,-110]);
  const o3 = useTransform(scrollYProgress, [.47,.58,.7,.76], [0,1,1,0]);
  const y4 = useTransform(scrollYProgress, [.72,.86,1], [90,0,0]);
  const o4 = useTransform(scrollYProgress, [.72,.84,1], [0,1,1]);

  const styles = reduce ? [{}, {}, {}, {}] : [
    { y:y1, opacity:o1 }, { y:y2, opacity:o2 }, { y:y3, opacity:o3 }, { y:y4, opacity:o4 }
  ];
  const lines = ["Je mémorise.", "Je comprends.", "Je parle.", "Je pense en français."];

  return (
    <section className="language-journey" ref={ref}>
      <div className="language-journey__sticky">
        <motion.p className="eyebrow" animate={{ opacity: reduce ? 1 : eyebrowVisible ? 1 : 0 }} transition={{ duration: .45, ease: "easeOut" }}>The shift that matters</motion.p>
        <div className="language-journey__stage">
          {lines.map((line, i) => <motion.p key={line} style={styles[i]} className={i === 3 ? "is-final" : ""}>{line}</motion.p>)}
        </div>
      </div>
    </section>
  );
}
