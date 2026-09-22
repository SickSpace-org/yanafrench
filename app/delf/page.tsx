import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ProgramDetail } from "@/components/ProgramDetail";
import { FinalCta } from "@/components/FinalCta";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

const TITLE = "DELF French Course & Exam Prep | The Français Hub";
const DESCRIPTION =
  "DELF exam preparation online, from A1 to B2, for students building French proficiency for study, work or immigration purposes in Canada.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/delf` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/delf`, siteName: "The Français Hub", type: "website" },
};

const courseSchema = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "DELF French Course & Exam Prep",
  description: DESCRIPTION,
  url: `${SITE_URL}/delf`,
  courseMode: "online",
  provider: {
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: "The Français Hub",
    url: SITE_URL,
  },
};

export default function DelfPage() {
  return <>
    <JsonLd data={courseSchema} />
    <PageHero eyebrow="DELF · A1–B2" title="Build French" italic="level by level." body="A structured path for learners progressing through DELF A1 to B2 — with the flexibility and personal attention of a small online class." trail={[{ label: "Discover", href: "/" }, { label: "DELF" }]}/>
    <ProgramDetail label="A clearer path through DELF" intro="Progress you can place." items={[
      { title: "Know your starting point", body: "Begin from your actual level rather than a generic assumption of what you should already know." },
      { title: "Develop all four skills", body: "Reading, listening, speaking and writing are treated as connected parts of one language system." },
      { title: "Grow confidence gradually", body: "Each level adds vocabulary, structure and independence without turning the process into information overload." },
      { title: "Prepare for certification", body: "Learning is shaped around DELF expectations while still building French you can use beyond the exam." },
    ]} message="Hi Yana! I’m interested in DELF preparation (A1–B2) and would like to know about current batch availability."/>
    <FinalCta/>
  </>;
}
