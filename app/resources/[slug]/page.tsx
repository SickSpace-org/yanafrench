import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { FinalCta } from "@/components/FinalCta";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { resources } from "@/lib/data";
import { RESOURCES_COMING_SOON } from "@/lib/config";

export function generateStaticParams() {
  return resources.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resource = resources.find((r) => r.slug === slug);
  if (!resource) return {};
  return { title: resource.title, description: resource.body };
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  // Same switch as app/resources/page.tsx — a stale bookmark or indexed
  // link to a specific resource shouldn't still show outdated content
  // while the catalog itself says "Coming Soon".
  if (RESOURCES_COMING_SOON) redirect("/resources");

  const { slug } = await params;
  const resource = resources.find((r) => r.slug === slug);
  if (!resource) notFound();

  return <>
    <PageHero
      eyebrow={`${resource.category} · ${resource.level}`}
      title={resource.title}
      body={resource.body}
      trail={[{ label: "Discover", href: "/" }, { label: "Resources", href: "/resources" }, { label: resource.title }]}
    />
    <section className="section resource-detail">
      <div className="container resource-detail__grid">
        <Reveal className="resource-detail__price-block">
          <span className="resource-detail__price-label">Price</span>
          <span className="resource-detail__price">{resource.price}</span>
        </Reveal>
        <Reveal className="resource-detail__body" delay={.1}>
          <div className="resource-detail__facts">
            <span><small>Category</small>{resource.category}</span>
            <span><small>Level</small>{resource.level}</span>
          </div>

          <div className="resource-detail__inside">
            <span className="resource-detail__inside-label">What&apos;s inside</span>
            <ul>
              <li>{resource.format}</li>
              {resource.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </div>

          <div className="resource-detail__purchase">
            <span className="resource-detail__inside-label">How to get it</span>
            <WhatsAppLink
              className="button button--accent resource-detail__cta"
              message={`Hi Yana! I found The Français Hub website and I'm interested in the "${resource.title}" resource (${resource.price}). Could you tell me how to get it?`}
            >
              Ask about this resource
            </WhatsAppLink>
            <p className="resource-detail__note">A website enquiry doesn&apos;t reserve or purchase anything — Yana will confirm access and next steps personally.</p>
          </div>

          <Link href="/resources" className="text-link resource-detail__back">← Back to all resources</Link>
        </Reveal>
      </div>
    </section>
    <FinalCta/>
  </>;
}
