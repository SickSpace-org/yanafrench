import type { Metadata } from "next";
import Image from "next/image";
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
      {/* eager: this portrait is directly beside PageHero's content, above
          the fold, and IS this page's measured LCP element (confirmed via
          production Lighthouse). priority + fetchPriority: same as Hero's
          image. width/height + CSS height:auto (not fill, not aspect-ratio
          alone): the plain aspect-ratio-only version of this exact CSS
          pattern is what stretched AboutYana's image into a 1402px-tall
          box (see ad8bff6) — height:auto is next/image's own documented
          fix for "using CSS to resize the image" (see the warning in
          next/dist/client/image-component.js), so it's applied here
          instead of repeating that mistake. */}
      <Reveal className="about-page__portrait" eager>
        <Image src={asset("/images/yana-standing.webp")} alt="Yana Budhiraja" width={778} height={1600} priority fetchPriority="high" sizes="(max-width: 800px) 100vw, 43vw"/>
        <div className="about-page__flashcard"><small>Based in</small><strong>Delhi, India</strong></div>
      </Reveal>
      {/* eager: same reasoning as CourseCatalog's h2 (105c10c) — above the
          fold, no reason to gate it behind a scroll-triggered fade-in. */}
      <Reveal className="about-page__copy" eager><p className="eyebrow">Yana Budhiraja</p><h2>High energy.<br/><em>Highly adaptable.</em></h2><p>Yana is a C1-level certified French tutor based in Delhi and teaches exclusively online. Her focus spans TEF / TCF preparation for learners targeting CLB 7+ and DELF preparation from A1 to B2.</p><p>The teaching experience is designed around direct interaction rather than crowded classes. Batches are capped at four students and offered based on availability.</p><div className="about-page__facts"><span><small>Specialises in</small>TEF · TCF · DELF</span><span><small>Teaching format</small>Online only</span><span><small>Batch size</small>Maximum 4</span></div></Reveal>
    </div></section>
    <Approach/>
    <FinalCta/>
  </>;
}
