import { Suspense } from "react";
import { Hero } from "@/components/Hero";
import { AuthNoticeToast } from "@/components/AuthNoticeToast";
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

export default function Home() {
  return <>
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
