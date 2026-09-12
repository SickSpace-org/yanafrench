import type { Course, CourseCategory } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";

const CATEGORY_SLUG: Record<CourseCategory, string> = {
  "French Levels": "levels",
  TEF: "tef",
  TCF: "tcf",
  DELF: "delf",
  Orientation: "orientation",
};

export function CourseCard({
  course,
  onViewDetails,
  onEnroll,
}: {
  course: Course;
  onViewDetails: () => void;
  onEnroll: () => void;
}) {
  return (
    <article className={`course-capsule course-capsule--${CATEGORY_SLUG[course.category]}`}>
      <span className="course-capsule__sheen" aria-hidden="true" />
      <span className="course-capsule__shimmer" aria-hidden="true" />

      <div className="course-capsule__row">
        <div className="course-capsule__rail">
          <span className="course-capsule__category">{course.category}</span>
          {course.badge && <span className="course-capsule__badge">{course.badge}</span>}
        </div>

        <div className="course-capsule__body">
          <h3>{course.title}</h3>
          <p className="course-capsule__desc">{course.description}</p>
        </div>

        <div className="course-capsule__stats">
          {course.level && (
            <div className="course-capsule__stat">
              <span>Level</span>
              <strong>{course.level}</strong>
            </div>
          )}
          <div className="course-capsule__stat">
            <span>Duration</span>
            <strong>{course.duration}</strong>
          </div>
          <div className="course-capsule__stat">
            <span>Format</span>
            <strong>{course.mode}</strong>
          </div>
        </div>

        <div className="course-capsule__price">
          <span className="course-capsule__price-main">{formatRupees(course.priceInPaise)}</span>
          {course.regularPriceInPaise !== undefined && (
            <span className="course-capsule__price-old">{formatRupees(course.regularPriceInPaise)}</span>
          )}
          {course.savingsInPaise !== undefined && (
            <span className="course-capsule__savings">Save {formatRupees(course.savingsInPaise)}</span>
          )}
        </div>

        <div className="course-capsule__actions">
          <button type="button" className="course-capsule__btn course-capsule__btn--ghost" onClick={onViewDetails}>
            View Details
          </button>
          <button type="button" className="course-capsule__btn course-capsule__btn--solid" onClick={onEnroll}>
            Enroll Now <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}
