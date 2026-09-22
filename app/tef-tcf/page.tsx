import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ProgramDetail } from "@/components/ProgramDetail";
import { ResultsPreview } from "@/components/ResultsPreview";
import { FinalCta } from "@/components/FinalCta";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

const TITLE = "TEF & TCF Canada Preparation Course | The Français Hub";
const DESCRIPTION =
  "Targeted TEF Canada and TCF Canada preparation for PR applicants. Speaking, writing, listening and reading practice aligned to what Canadian immigration actually scores.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tef-tcf` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/tef-tcf`, siteName: "The Français Hub", type: "website" },
};

const courseSchema = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "TEF & TCF Canada Preparation Course",
  description: DESCRIPTION,
  url: `${SITE_URL}/tef-tcf`,
  courseMode: "online",
  provider: {
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: "The Français Hub",
    url: SITE_URL,
  },
};

export default function TefTcfPage() {
  return <>
    <JsonLd data={courseSchema} />
    <PageHero eyebrow="TEF / TCF · Canada" title="French for a goal" italic="beyond the classroom." body="Focused online preparation for learners working toward strong Canadian French test outcomes, with small-group attention and direct guidance from Yana." trail={[{ label: "Discover", href: "/" }, { label: "TEF / TCF" }]}/>
    <ProgramDetail label="How the preparation works" intro="Practice with a purpose." items={[
      { title: "Build the language", body: "Strengthen the grammar, vocabulary and comprehension foundations your exam performance depends on." },
      { title: "Train the format", body: "Work with the structure and expectations of TEF / TCF tasks rather than studying French in the abstract." },
      { title: "Speak and write actively", body: "Expression improves through repetition, correction and feedback — not passive notes." },
      { title: "Adapt the plan", body: "Small batches make it possible to respond to learner gaps instead of forcing everyone through the same pace." },
    ]} message="Hi Yana! I’m interested in TEF/TCF preparation and would like to know about current batch availability."/>
    <ResultsPreview/>
    <FinalCta/>
  </>;
}
