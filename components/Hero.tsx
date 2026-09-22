"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { asset } from "@/lib/site";
import { Arrow } from "./Arrow";
import { WhatsAppLink } from "./WhatsAppLink";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 72]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -24]);

  return (
    <section ref={ref} className="hero">
      <div className="hero__grain" aria-hidden="true"/>
      <div className="container hero__grid">
        <motion.div className="hero__copy" style={{ y: copyY }}>
          <motion.p className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .15 }}>
            The Français Hub · by Yana Budhiraja
          </motion.p>
          {/* initial={false}: this h1 is the (or a) largest-contentful-paint
              candidate — fading it in from opacity:0 held its real paint
              behind Framer Motion's hydrate+animate timing in production
              profiling. Renders directly at the animate target instead,
              same as prefers-reduced-motion already does elsewhere here. */}
          <motion.h1 initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: .95, delay: .24, ease: [0.22, 1, 0.36, 1] }}>
            French,<br/><em>with direction.</em>
          </motion.h1>
          <motion.p className="hero__dek" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .42 }}>
            Personal online French coaching for TEF, TCF and DELF learners guided by a C1-level certified tutor.
          </motion.p>
          <motion.div className="hero__actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .58 }}>
            <Link className="button button--accent" href="/#programs"><span>Explore programs</span><Arrow/></Link>
            <WhatsAppLink className="button button--ghost">Start on WhatsApp</WhatsAppLink>
          </motion.div>
        </motion.div>

        {/* initial={false}: same LCP fix as the h1 above — this wraps the
            hero photo, the site's actual measured LCP element (production
            profiling showed a ~3s render delay from this fade-in alone). */}
        <motion.div className="hero__visual" style={{ y: imageY }} initial={false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: .22, ease: [0.22, 1, 0.36, 1] }}>
          <div className="hero__image-wrap">
            {/* fill: the existing CSS already sizes .hero__image-wrap
                (position:relative) and applies object-fit/object-position
                via the hero__image class — fill fits that same box exactly.
                priority sets fetchpriority=high and preloads this as the
                page's LCP image instead of it competing with everything
                else; sizes tells the optimizer what to actually generate
                for mobile instead of shipping the full desktop-sized file. */}
            <Image
              src={asset("/images/yana-hero.webp")}
              alt="Yana Budhiraja seated at a desk with a laptop and French study books"
              className="hero__image"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 560px"
            />
            <div className="hero__image-label"><span>Bonjour,</span><strong>I&apos;m Yana.</strong></div>
          </div>
          <motion.div className="hero__credentials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .8, delay: .78 }}>
            <span>TEF / TCF · CLB 7+</span><span>DELF · A1–B2</span><span>Online only</span>
          </motion.div>
          <div className="hero__micro" aria-hidden="true">ç<span>.</span></div>
        </motion.div>
      </div>
      <a className="hero__scroll" href="#programs" aria-label="Scroll to programs"><span>Scroll</span><i/></a>
    </section>
  );
}
