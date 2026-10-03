import type { Metadata } from "next";
import { MyCoursePage } from "@/components/MyCoursePage";

export const metadata: Metadata = { title: "My Course" };

export default function StudentMyCourseRoute() {
  return <MyCoursePage />;
}
