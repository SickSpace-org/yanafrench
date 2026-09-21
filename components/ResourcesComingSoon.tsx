import Link from "next/link";
import { Arrow } from "./Arrow";
import { Reveal } from "./Reveal";

// Stand-in for <ResourceCatalog /> while RESOURCES_COMING_SOON is on (see
// lib/config.ts) — same section chrome (.resource-catalog background,
// .section-head heading styles) as the catalog it replaces, so swapping
// the flag back just swaps the component back with nothing else to fix.
export function ResourcesComingSoon() {
  return (
    <section className="section resource-catalog">
      <div className="container">
        <Reveal className="section-head resource-catalog__coming-soon">
          <p className="eyebrow">The collection</p>
          <h2>Coming <em>soon.</em></h2>
          <p className="resource-catalog__coming-soon-lead">Fresh notes and practice material are on the way.</p>
          <Link href="/#programs" className="button button--accent">Explore programs<Arrow/></Link>
        </Reveal>
      </div>
    </section>
  );
}
