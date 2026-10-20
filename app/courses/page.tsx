import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { CourseCatalog } from "@/components/CourseCatalog";
import { FinalCta } from "@/components/FinalCta";
import { SITE_URL } from "@/lib/site";
import { readCatalog } from "@/lib/courseCatalogServer";

const TITLE = "French Courses for TEF, TCF, DELF & PR Prep | The Français Hub";
const DESCRIPTION =
  "Structured online French courses for beginners to advanced, designed around TEF Canada, TCF Canada and DELF exam requirements. Find the right batch for your PR timeline.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/courses` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/courses`, siteName: "The Français Hub", type: "website" },
};

// Static, rebuilt when Admin → Courses saves (app/api/courses revalidates it).
export default async function CoursesPage() {
  const catalog = await readCatalog();
  return <>
    <PageHero
      eyebrow="Courses"
      title="Explore Our"
      italic="Courses."
      body="Choose the right French learning program for your goals. From complete beginner courses to advanced exam preparation, find a program designed around your target."
      trail={[{ label: "Discover", href: "/" }, { label: "Courses" }]}
    />
    <CourseCatalog catalog={catalog} />
    <FinalCta />
  </>;
}
