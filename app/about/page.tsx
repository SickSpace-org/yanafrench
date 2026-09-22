import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { Approach } from "@/components/Approach";
import { FinalCta } from "@/components/FinalCta";
import { JsonLd } from "@/components/JsonLd";
import { asset, SITE_URL } from "@/lib/site";

const TITLE = "About Yana | French Tutor for TEF, TCF & DELF Prep";
const DESCRIPTION =
  "Meet Yana, your online French tutor specializing in exam-focused French training for students in India and Canada pursuing TEF, TCF and DELF certification for Canadian PR.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/about`, siteName: "The Français Hub", type: "website" },
};

// Grounded in this page's own copy below (name, city, specialisation,
// teaching format) rather than invented.
const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Yana Budhiraja",
  jobTitle: "French Tutor",
  description: DESCRIPTION,
  image: `${SITE_URL}/images/yana-standing.webp`,
  worksFor: {
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: "The Français Hub",
    url: SITE_URL,
  },
};

export default function AboutPage() {
  return <>
    <JsonLd data={personSchema} />
    <PageHero eyebrow="The person behind the hub" title="Learn French" italic="with Yana." body="The Français Hub is intentionally personal: one tutor, small groups, direct feedback and a teaching style that adapts to the learner in front of her." trail={[{ label: "Discover", href: "/" }, { label: "About Yana" }]}/>
    <section className="section about-page"><div className="container about-page__grid">
      <Reveal className="about-page__portrait"><img src={asset("/images/yana-standing.webp")} alt="Yana Budhiraja"/><div className="about-page__flashcard"><small>Based in</small><strong>Delhi, India</strong></div></Reveal>
      <Reveal className="about-page__copy" delay={.1}><p className="eyebrow">Yana Budhiraja</p><h2>High energy.<br/><em>Highly adaptable.</em></h2><p>Yana is a C1-level certified French tutor based in Delhi and teaches exclusively online. Her focus spans TEF / TCF preparation for learners targeting CLB 7+ and DELF preparation from A1 to B2.</p><p>The teaching experience is designed around direct interaction rather than crowded classes. Batches are capped at four students and offered based on availability.</p><div className="about-page__facts"><span><small>Specialises in</small>TEF · TCF · DELF</span><span><small>Teaching format</small>Online only</span><span><small>Batch size</small>Maximum 4</span></div></Reveal>
    </div></section>
    <Approach/>
    <FinalCta/>
  </>;
}
