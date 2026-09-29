import Link from "next/link";
import { Arrow } from "./Arrow";
import { Reveal } from "./Reveal";

export function TefFeature() {
  return (
    <section className="section tef-feature">
      <div className="container tef-feature__grid">
        <Reveal className="tef-feature__title"><p className="eyebrow">Focused preparation</p><h2>TEF /<br/><em>TCF</em></h2></Reveal>
        <Reveal className="tef-feature__body" delay={.1}>
          <p className="tef-feature__lead">French for a goal that goes beyond the classroom.</p>
          <p>Structured exam preparation across comprehension and expression, with small-group attention and feedback shaped around the learner.</p>
          <div className="tef-feature__points"><span>Targeted preparation</span><span>Small groups</span><span>Personal feedback</span></div>
          <Link className="text-link" href="/tef-tcf">Explore TEF / TCF <Arrow/></Link>
        </Reveal>
      </div>
    </section>
  );
}
