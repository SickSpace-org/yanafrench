import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { CourseCatalog } from "@/components/CourseCatalog";
import { FinalCta } from "@/components/FinalCta";
import { SITE_URL } from "@/lib/site";

const TITLE = "French Courses for TEF, TCF, DELF & PR Prep | The Français Hub";
const DESCRIPTION =
  "Structured online French courses for beginners to advanced, designed around TEF Canada, TCF Canada and DELF exam requirements. Find the right batch for your PR timeline.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/courses` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/courses`, siteName: "The Français Hub", type: "website" },
};

export default function CoursesPage() {
  return <>
    <PageHero
      eyebrow="Courses"
      title="Explore Our"
      italic="Courses."
      body="Choose the right French learning program for your goals. From complete beginner courses to advanced exam preparation, find a program designed around your target."
      trail={[{ label: "Discover", href: "/" }, { label: "Courses" }]}
    />
    <CourseCatalog />
    <FinalCta />
  </>;
}
