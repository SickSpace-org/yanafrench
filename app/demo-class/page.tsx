import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { DemoClassBooking } from "@/components/DemoClassBooking";
import { FinalCta } from "@/components/FinalCta";
import { SITE_URL } from "@/lib/site";

const TITLE = "Book a Free French Demo Class | The Français Hub";
const DESCRIPTION =
  "Book a free live online French demo class with Yana. Pick a time slot that suits you — small groups of at most 4 students.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/demo-class` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/demo-class`, siteName: "The Français Hub", type: "website" },
};

export default function DemoClassPage() {
  return <>
    <PageHero
      eyebrow="Demo Class"
      title="Try a class,"
      italic="free."
      body="Join a live online French class with Yana before you enroll. Pick a time slot below — each one takes at most 4 students."
      trail={[{ label: "Discover", href: "/" }, { label: "Demo Class" }]}
    />
    <DemoClassBooking />
    <FinalCta />
  </>;
}
