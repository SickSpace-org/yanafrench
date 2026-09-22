import Image from "next/image";
import { asset } from "@/lib/site";
import { Reveal } from "./Reveal";

export function PersonalityBand() {
  return (
    <section className="personality-band">
      <div className="container personality-band__grid">
        <Reveal className="personality-band__copy"><p className="eyebrow eyebrow--light">L&apos;énergie</p><h2>French is serious.<br/><em>Learning it doesn&apos;t always have to feel that way.</em></h2></Reveal>
        <Reveal className="personality-band__media" delay={.1}>
          <Image
            src={asset("/images/yana-lifestyle.webp")}
            alt="Yana Budhiraja in a relaxed setting"
            width={1206}
            height={1448}
            sizes="(max-width: 800px) 82vw, 430px"
          />
          <span>Focused. Adaptable. Engaging.</span>
        </Reveal>
      </div>
    </section>
  );
}
