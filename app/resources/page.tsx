import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { ResourceCatalog } from "@/components/ResourceCatalog";
import { ResourcesComingSoon } from "@/components/ResourcesComingSoon";
import { resourcePathways, resourcesApproach } from "@/lib/data";
import { RESOURCES_COMING_SOON } from "@/lib/config";
import { Arrow } from "@/components/Arrow";

export const metadata: Metadata = {
  title: "Resources",
  description: "Curated French study material by Yana Budhiraja for TEF, TCF and DELF learners — writing frameworks, speaking kits, vocabulary systems and exam-focused practice.",
};

export default function ResourcesPage() {
  return <>
    <PageHero
      eyebrow="Digital resources"
      title="Study material,"
      italic="beyond the classroom."
      body="Curated study material by Yana for TEF, TCF and DELF — built for direction, clarity and better practice, without the noise."
      trail={[{ label: "Discover", href: "/" }, { label: "Resources" }]}
    />

    <section className="section resource-pathways">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">Start with your goal</p>
          <h2>Resources for<br/><em>every exam.</em></h2>
        </Reveal>
        <div className="resource-pathways__grid">
          {resourcePathways.map((item, i) => (
            <Reveal key={item.code} delay={i * 0.08}>
              <div className="resource-pathways__card">
                <span>{item.code}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="section resource-approach">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow eyebrow--light">The TFH approach</p>
          <h2>Made with the same<br/><em>intention as class.</em></h2>
        </Reveal>
        <div className="resource-approach__grid">
          {resourcesApproach.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <div className="resource-approach__card">
                <span>0{i + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    {RESOURCES_COMING_SOON ? <ResourcesComingSoon /> : <ResourceCatalog />}

    <section className="resource-cta">
      <div className="container resource-cta__inner">
        <Reveal>
          <p className="eyebrow eyebrow--light">Learn with Yana</p>
          <h2>Resources go further<br/><em>with personal guidance.</em></h2>
          <p className="resource-cta__lead">Personalised French learning and exam preparation, built around you.</p>
          <Link href="/#programs" className="button button--accent">Explore The Français Hub <Arrow/></Link>
        </Reveal>
      </div>
    </section>
  </>;
}
