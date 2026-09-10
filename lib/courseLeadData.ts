// An enrollment inquiry captured from the public /courses page, before
// payment opens — mirrors lib/leadData.ts's shape and Supabase persistence
// pattern, but kept fully separate: courses/DELF options/orientation
// levels aren't scheduled batches, so this doesn't reuse Lead/BatchCourse.
// See app/api/course-leads/route.ts and
// supabase/migrations/20260910120000_create_course_leads_payments.sql.

export const CURRENT_LEVELS = ["New to French", "A1", "A2", "B1", "B2", "C1"] as const;
export type CurrentLevel = (typeof CURRENT_LEVELS)[number];

export const LEARNING_MODES = ["Live online", "No preference"] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export type CourseLead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp?: string | null;
  productId: string;
  productTitle: string;
  currentLevel?: CurrentLevel | null;
  preferredMode?: LearningMode | null;
  message?: string | null;
  createdAt: string;
  paymentStatus?: "paid" | "pending" | "failed" | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
};

export type CourseLeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp: string | null;
  product_id: string;
  product_title: string;
  current_level: string | null;
  preferred_mode: string | null;
  message: string | null;
  created_at: string;
  payment_status: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

export function courseLeadFromRow(row: CourseLeadRow): CourseLead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    whatsapp: row.whatsapp,
    productId: row.product_id,
    productTitle: row.product_title,
    currentLevel: (row.current_level as CurrentLevel | null) ?? null,
    preferredMode: (row.preferred_mode as LearningMode | null) ?? null,
    message: row.message,
    createdAt: row.created_at,
    paymentStatus: (row.payment_status as CourseLead["paymentStatus"]) ?? null,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
  };
}

export function courseLeadToRow(lead: CourseLead): CourseLeadRow {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    whatsapp: lead.whatsapp ?? null,
    product_id: lead.productId,
    product_title: lead.productTitle,
    current_level: lead.currentLevel ?? null,
    preferred_mode: lead.preferredMode ?? null,
    message: lead.message ?? null,
    created_at: lead.createdAt,
    payment_status: lead.paymentStatus ?? null,
    razorpay_order_id: lead.razorpayOrderId ?? null,
    razorpay_payment_id: lead.razorpayPaymentId ?? null,
  };
}
