import Image from "next/image";
import Link from "next/link";
import { asset } from "@/lib/site";
import { Arrow } from "./Arrow";
import { Reveal } from "./Reveal";

export function AboutYana() {
  return (
    <section className="section yana-section">
      <div className="container yana-section__grid">
        <Reveal className="yana-section__image-wrap">
          {/* Below the fold — no priority, so this stays lazy-loaded and
              excluded from the initial-load priority queue (see Hero.tsx
              for the one image that should compete for that). width/height
              (not fill) since .yana-section__image-wrap has no explicit
              height of its own — its size today comes from the image's
              own intrinsic aspect ratio via normal flow, which this
              preserves exactly. */}
          <Image
            src={asset("/images/yana-editorial.webp")}
            alt="Yana Budhiraja in a warm study setting"
            className="yana-section__image"
            width={1122}
            height={1402}
            sizes="(max-width: 800px) 100vw, 47vw"
          />
          <span className="yana-section__caption">Based in Delhi · teaching online</span>
          <div className="yana-section__badge"><strong>C1</strong><span>Certified<br/>French tutor</span></div>
        </Reveal>
        <Reveal className="yana-section__copy" delay={.12}>
          <p className="eyebrow">Meet your tutor</p>
          <h2>Bonjour,<br/><em>I&apos;m Yana.</em></h2>
          <p className="yana-section__lead">C1-level certified French tutor specialising in TEF, TCF and DELF preparation.</p>
          <p>High-energy when the class needs momentum, patient when a concept needs unpacking, and adaptable enough to meet learners where they actually are.</p>
          <div className="yana-section__tags"><span>C1 French</span><span>TEF / TCF</span><span>DELF A1–B2</span><span>Online</span></div>
          <Link href="/about" className="text-link">More about Yana <Arrow/></Link>
        </Reveal>
      </div>
    </section>
  );
}
