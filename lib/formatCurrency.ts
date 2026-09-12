// Shared INR currency formatting — Indian digit grouping (lakhs/crores),
// no decimal places, from a paise integer. Used by the course catalog and
// its enroll/payment flow; components/admin/AdminPaymentsPanel.tsx has its
// own simpler formatter for the (2-decimal, non-grouped) batch payment
// amounts and is left as-is.
export function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}
