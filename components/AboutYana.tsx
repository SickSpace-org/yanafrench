import Link from "next/link";
import { asset } from "@/lib/site";
import { Arrow } from "./Arrow";
import { Reveal } from "./Reveal";

export function AboutYana() {
  return (
    <section className="section yana-section">
      <div className="container yana-section__grid">
        <Reveal className="yana-section__image-wrap">
          <img src={asset("/images/yana-editorial.webp")} alt="Yana Budhiraja in a warm study setting" className="yana-section__image" loading="lazy"/>
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
