import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { tefResult, tcfResult, type ResultRow } from "@/lib/data";
import { asset } from "@/lib/site";
import { FinalCta } from "@/components/FinalCta";
import { ScoreRing } from "@/components/ScoreRing";
import { SITE_URL } from "@/lib/site";

const TITLE = "Student Results & Success Stories | The Français Hub";
const DESCRIPTION =
  "Real TEF, TCF and DELF results from students who trained with The Français Hub — see scores, outcomes and PR-track progress from past batches.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/results` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/results`, siteName: "The Français Hub", type: "website" },
};

function FullResult({ title, rows, image, alt, reverse }: { title:string; rows:ResultRow[]; image:string; alt:string; reverse?:boolean }) {
  return <article className={`full-result${reverse ? " full-result--reverse" : ""}`}>
    <Reveal className="full-result__summary"><p className="eyebrow">{title}</p><h2>Recent student<br/><em>result.</em></h2><div className="full-result__rows">{rows.map((row)=><ScoreRing key={row.skill} skill={row.skill} score={row.score} level={row.level} detail={row.clb}/>)}</div></Reveal>
    <Reveal className="full-result__image" delay={.1}><img src={asset(image)} alt={alt}/></Reveal>
  </article>;
}

export default function ResultsPage() {
  return <>
    <PageHero eyebrow="Proof, without the noise" title="Student outcomes," italic="shown clearly." body="These are anonymised result documents shared for proof. Names and identifying details remain hidden." trail={[{ label: "Discover", href: "/" }, { label: "Results" }]}/>
    <section className="section results-page"><div className="container">
      <FullResult title="TEF Canada" rows={tefResult} image="/results/tef-result.jpg" alt="Anonymised TEF Canada result certificate"/>
      <FullResult title="TCF Canada" rows={tcfResult} image="/results/tcf-result.jpg" alt="Anonymised TCF Canada result certificate" reverse/>
    </div></section>
    <FinalCta/>
  </>;
}
