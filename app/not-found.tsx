import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Arrow } from "@/components/Arrow";

export const metadata: Metadata = { title: "Page not found" };

// PageHero is the same component every other inner page (/about, /tef-tcf,
// /courses, etc.) uses for its header — reusing it here means the heading,
// eyebrow and body text all get the site's existing typography/color
// tokens for free, no new CSS needed. No trail: a 404 has no real place in
// the breadcrumb hierarchy, and trail is optional on PageHero.
export default function NotFound() {
  return <>
    <PageHero
      eyebrow="404"
      title="Page not"
      italic="found."
      body="The page you're looking for doesn't exist or may have moved. Let's get you back on track."
    />
    <section className="section">
      <div className="container" style={{ display: "flex", flexWrap: "wrap", gap: ".7rem" }}>
        <Link href="/" className="button button--accent"><span>Back to homepage</span><Arrow/></Link>
        <Link href="/courses" className="button button--nav-outline">Explore courses</Link>
      </div>
    </section>
  </>;
}
