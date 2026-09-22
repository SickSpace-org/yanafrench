import { Reveal } from "./Reveal";
import { Breadcrumb } from "./Breadcrumb";

export function PageHero({ eyebrow, title, italic, body, trail }: { eyebrow: string; title: string; italic?: string; body: string; trail?: { label: string; href?: string }[] }) {
  return (
    <section className="page-hero"><div className="container page-hero__inner">
      {trail && <Breadcrumb items={trail}/>}
      <Reveal eager><p className="eyebrow">{eyebrow}</p><h1>{title}{italic && <><br/><em>{italic}</em></>}</h1><p>{body}</p></Reveal>
    </div></section>
  );
}
