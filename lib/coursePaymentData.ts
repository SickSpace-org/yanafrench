// A payment transaction ledger for course-catalog enrollments — one record
// per Razorpay order created from app/api/course-payment/create-order,
// independent of the CourseLead it came from. Mirrors lib/paymentData.ts's
// shape but is kept fully separate from the batch system's Payment type.

export type CoursePaymentStatus = "created" | "paid" | "failed";

export type CoursePayment = {
  id: string; // Razorpay order id
  leadId: string;
  name: string;
  email: string;
  phone: string;
  productId: string;
  productTitle: string;
  amount: number; // paise
  currency: string;
  status: CoursePaymentStatus;
  razorpayPaymentId?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

export type CoursePaymentRow = {
  id: string;
  lead_id: string;
  name: string;
  email: string;
  phone: string;
  product_id: string;
  product_title: string;
  amount: number;
  currency: string;
  status: CoursePaymentStatus;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export function coursePaymentFromRow(row: CoursePaymentRow): CoursePayment {
  return {
    id: row.id,
    leadId: row.lead_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    productId: row.product_id,
    productTitle: row.product_title,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    razorpayPaymentId: row.razorpay_payment_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export function coursePaymentToRow(payment: CoursePayment): CoursePaymentRow {
  return {
    id: payment.id,
    lead_id: payment.leadId,
    name: payment.name,
    email: payment.email,
    phone: payment.phone,
    product_id: payment.productId,
    product_title: payment.productTitle,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    razorpay_payment_id: payment.razorpayPaymentId ?? null,
    created_at: payment.createdAt,
    paid_at: payment.paidAt ?? null,
  };
}
