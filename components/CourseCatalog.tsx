"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Reveal } from "./Reveal";
import { CourseCard } from "./CourseCard";
import { CourseDetailsModal } from "./CourseDetailsModal";
import { CourseEnrollModal } from "./CourseEnrollModal";
import { DelfPricingTable } from "./DelfPricingTable";
import { OrientationTestCard } from "./OrientationTestCard";
import { courses, type Course, type CourseCategory, type Enrollable } from "@/lib/courseCatalogData";

const FILTERS: ("All" | CourseCategory)[] = ["All", "French Levels", "TEF", "TCF", "DELF", "Orientation"];

export function CourseCatalog() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [detailsCourse, setDetailsCourse] = useState<Course | null>(null);
  const [enrolling, setEnrolling] = useState<Enrollable | null>(null);

  const visibleCourses = useMemo(() => {
    if (filter === "All") return courses;
    if (filter === "DELF" || filter === "Orientation") return [];
    return courses.filter((c) => c.category === filter);
  }, [filter]);

  const showDelf = filter === "All" || filter === "DELF";
  const showOrientation = filter === "All" || filter === "Orientation";

  return (
    <section className="section course-catalog">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">Explore Our Courses</p>
          <h2>Choose the right <em>French program.</em></h2>
          <p className="course-catalog__subtitle">
            Choose the right French learning program for your goals. From complete beginner courses to advanced exam preparation, find a program designed around your target.
          </p>
        </Reveal>

        <div className="course-catalog__filters" role="group" aria-label="Filter courses by category">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`course-catalog__filter ${filter === f ? "is-active" : ""}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>

        {visibleCourses.length > 0 && (
          <div className="course-catalog__grid">
            {visibleCourses.map((course, i) => (
              <Reveal key={course.id} delay={i * 0.05}>
                <CourseCard
                  course={course}
                  onViewDetails={() => setDetailsCourse(course)}
                  onEnroll={() => setEnrolling({ kind: "course", course })}
                />
              </Reveal>
            ))}
          </div>
        )}

        {showDelf && (
          <DelfPricingTable onEnroll={(level, option) => setEnrolling({ kind: "delf", level, option })} />
        )}

        {showOrientation && (
          <OrientationTestCard onEnroll={(level) => setEnrolling({ kind: "orientation", level })} />
        )}
      </div>

      <AnimatePresence>
        {detailsCourse && (
          <CourseDetailsModal
            course={detailsCourse}
            onClose={() => setDetailsCourse(null)}
            onEnroll={() => {
              const course = detailsCourse;
              setDetailsCourse(null);
              setEnrolling({ kind: "course", course });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {enrolling && <CourseEnrollModal enrollable={enrolling} onClose={() => setEnrolling(null)} />}
      </AnimatePresence>
    </section>
  );
}
