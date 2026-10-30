"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Reveal } from "./Reveal";
import { CourseCard } from "./CourseCard";
import { CourseDetailsModal } from "./CourseDetailsModal";
import { CourseEnrollModal } from "./CourseEnrollModal";
import { DelfPricingTable } from "./DelfPricingTable";
import { OrientationTestCard } from "./OrientationTestCard";
import { DemoClassCard } from "./DemoClassCard";
import { BookingModal, prefetchBookingSlots } from "./BookingModal";
import { courseInCategory, isHighlighted, type Catalog, type Course, type CourseCategory, type Enrollable, type OrientationLevel } from "@/lib/courseCatalogData";
import type { BookingKind } from "@/lib/bookingData";
import { prefetchEmiSettings } from "@/lib/useEmiSettings";

const FILTERS: ("All" | CourseCategory | "Demo Class")[] = ["All", "French Levels", "TEF", "TCF", "DELF", "Orientation", "Demo Class"];

export function CourseCatalog({ catalog }: { catalog: Catalog }) {
  const { courses } = catalog;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [detailsCourse, setDetailsCourse] = useState<Course | null>(null);
  const [enrolling, setEnrolling] = useState<Enrollable | null>(null);
  const [booking, setBooking] = useState<{ kind: BookingKind; level?: OrientationLevel["level"] } | null>(null);

  // This page is built ahead of time, so whether a course's highlight has
  // run out is decided here, against the visitor's clock. null until then:
  // the first render (server and hydration) treats any highlight as running.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  // Load the time slots and EMI plans in the background so the booking and
  // enroll modals open with them already there.
  useEffect(() => {
    prefetchBookingSlots("orientation");
    prefetchBookingSlots("demo");
    prefetchEmiSettings();
  }, []);

  // Highlighted courses first, each group keeping the admin's order.
  const ordered = useMemo(
    () => [...courses.filter((c) => isHighlighted(c, now)), ...courses.filter((c) => !isHighlighted(c, now))],
    [courses, now]
  );

  const visibleCourses = useMemo(() => {
    if (filter === "All") return ordered;
    if (filter === "DELF" || filter === "Orientation" || filter === "Demo Class") return [];
    return ordered.filter((c) => courseInCategory(c, filter));
  }, [filter, ordered]);

  const showDelf = filter === "All" || filter === "DELF";
  const showOrientation = filter === "All" || filter === "Orientation";
  const showDemo = filter === "All" || filter === "Demo Class";

  return (
    <section className="section course-catalog">
      <div className="container">
        {/* eager: this h2 is directly below PageHero with nothing tall
            between them, so it's above the fold on load — measured as this
            page's actual LCP element (1.8s render delay from the
            whileInView fade-in before this fix, same issue PageHero's own
            heading had — see components/Reveal.tsx). */}
        <Reveal className="section-head" eager>
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
                  highlighted={isHighlighted(course, now)}
                  onViewDetails={() => setDetailsCourse(course)}
                  onEnroll={() => setEnrolling({ kind: "course", course })}
                />
              </Reveal>
            ))}
          </div>
        )}

        {showDelf && (
          <DelfPricingTable delfCourses={catalog.delf} onEnroll={(level, option) => setEnrolling({ kind: "delf", level, option })} />
        )}

        {showOrientation && (
          <OrientationTestCard levels={catalog.orientation} onEnroll={(level) => setBooking({ kind: "orientation", level: level.level })} />
        )}

        {showDemo && <DemoClassCard onBook={() => setBooking({ kind: "demo" })} />}
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

      <AnimatePresence>
        {booking && <BookingModal kind={booking.kind} levels={catalog.orientation} initialLevel={booking.level} onClose={() => setBooking(null)} />}
      </AnimatePresence>
    </section>
  );
}
