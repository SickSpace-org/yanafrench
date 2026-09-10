import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { CourseCatalog } from "@/components/CourseCatalog";
import { FinalCta } from "@/components/FinalCta";

export const metadata: Metadata = {
  title: "Courses",
  description: "Explore The Français Hub's French courses — from A1 foundations to C1 mastery, TEF/TCF exam preparation, DELF certification, and orientation testing.",
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
