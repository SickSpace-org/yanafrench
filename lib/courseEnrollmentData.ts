// One record per paid course-catalog enrollment — the Courses-tab
// equivalent of lib/batchEnrollmentData.ts. Previously a course-catalog
// purchase created no student/enrollment record at all (see
// app/api/course-payment/verify's old "no seat/student side effect here"
// comment); this table plus lib/enrollment.ts's shared identity resolution
// gives a course-catalog buyer a real student-hub login too.

export type EnrollmentStatus = "active" | "cancelled";

export type CourseEnrollment = {
  id: string;
  studentId: string;
  leadId: string;
  paymentId: string; // Razorpay order id
  productId: string;
  productTitle: string;
  status: EnrollmentStatus;
  enrolledAt: string;
};

export type CourseEnrollmentRow = {
  id: string;
  student_id: string;
  lead_id: string;
  payment_id: string;
  product_id: string;
  product_title: string;
  status: EnrollmentStatus;
  enrolled_at: string;
};

export function courseEnrollmentFromRow(row: CourseEnrollmentRow): CourseEnrollment {
  return {
    id: row.id,
    studentId: row.student_id,
    leadId: row.lead_id,
    paymentId: row.payment_id,
    productId: row.product_id,
    productTitle: row.product_title,
    status: row.status,
    enrolledAt: row.enrolled_at,
  };
}

export function courseEnrollmentToRow(e: CourseEnrollment): CourseEnrollmentRow {
  return {
    id: e.id,
    student_id: e.studentId,
    lead_id: e.leadId,
    payment_id: e.paymentId,
    product_id: e.productId,
    product_title: e.productTitle,
    status: e.status,
    enrolled_at: e.enrolledAt,
  };
}
