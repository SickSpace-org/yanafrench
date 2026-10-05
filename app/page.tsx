import type { Metadata } from "next";
import { Suspense } from "react";
import { Hero } from "@/components/Hero";
import { AuthNoticeToast } from "@/components/AuthNoticeToast";
import { JsonLd } from "@/components/JsonLd";
import { site, SITE_URL } from "@/lib/site";
import { Pathways } from "@/components/Pathways";
import { TefFeature } from "@/components/TefFeature";
import { MaxFour } from "@/components/MaxFour";
import { AboutYana } from "@/components/AboutYana";
import { PersonalityBand } from "@/components/PersonalityBand";
import { ResultsPreview } from "@/components/ResultsPreview";
import { Approach } from "@/components/Approach";
import { LanguageJourney } from "@/components/LanguageJourney";
import { ClassFormat } from "@/components/ClassFormat";
import { BatchFinder } from "@/components/BatchFinder";
import { ResourcesFeature } from "@/components/ResourcesFeature";
import { FinalCta } from "@/components/FinalCta";

const TITLE = "Learn French Online for TEF, TCF & DELF | The Français Hub";
const DESCRIPTION =
  "Online French classes for TEF, TCF and DELF exam prep, built for students in India and Canada targeting PR through French proficiency. Live batches, structured courses, real results.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/`, siteName: "The Français Hub", type: "website" },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "@id": `${SITE_URL}/#organization`,
  name: "The Français Hub",
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  image: `${SITE_URL}/icon-512.png`,
  description: DESCRIPTION,
  areaServed: ["IN", "CA"],
  // Official profiles — what Google matches the brand against for a
  // Knowledge Panel.
  sameAs: [site.instagram, site.linkedin],
  founder: { "@type": "Person", name: site.tutor },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: `+${site.phone}`,
    contactType: "customer service",
    availableLanguage: ["English", "French"],
  },
};

// WebSite data is what Google uses to show "The Français Hub" as the
// site name in results instead of the bare domain.
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "The Français Hub",
  alternateName: ["The Francais Hub", "Français Hub"],
  url: `${SITE_URL}/`,
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export default function Home() {
  return <>
    <JsonLd data={organizationSchema} />
    <JsonLd data={websiteSchema} />
    <Suspense fallback={null}>
      <AuthNoticeToast param="logged_out" message="You&rsquo;ve been signed out." />
    </Suspense>
    <Hero/>
    <Pathways/>
    <TefFeature/>
    <MaxFour/>
    <AboutYana/>
    <PersonalityBand/>
    <ResultsPreview/>
    <Approach/>
    <LanguageJourney/>
    <ClassFormat/>
    <BatchFinder/>
    <ResourcesFeature/>
    <FinalCta/>
  </>;
}
