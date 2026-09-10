import type { Course } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";

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
    <article className="course-card">
      {course.badge && <span className="course-card__badge">{course.badge}</span>}
      <span className="course-card__category">{course.category}</span>
      <h3>{course.title}</h3>
      <p className="course-card__desc">{course.description}</p>
      <div className="course-card__meta">
        {course.level && <span>{course.level}</span>}
        <span>{course.duration}</span>
        <span>{course.mode}</span>
      </div>
      <div className="course-card__price-row">
        <span className="course-card__price">{formatRupees(course.priceInPaise)}</span>
        {course.regularPriceInPaise !== undefined && (
          <span className="course-card__regular-price">{formatRupees(course.regularPriceInPaise)}</span>
        )}
      </div>
      {course.savingsInPaise !== undefined && (
        <span className="course-card__savings">Save {formatRupees(course.savingsInPaise)}</span>
      )}
      <div className="course-card__actions">
        <button type="button" className="button button--outline" onClick={onViewDetails}>View Details</button>
        <button type="button" className="button button--accent" onClick={onEnroll}>Enroll Now</button>
      </div>
    </article>
  );
}
