// Creates a Razorpay order server-side so the amount is never trusted from
// the client. Flat ₹1 test price for every batch right now — see the
// comment on ENROLLMENT_FEE_PAISE in components/EnrollModal.tsx, which
// displays the same figure to the visitor before checkout opens.
const ENROLLMENT_FEE_PAISE = 100; // ₹1

export async function POST(req: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
  }

  const { leadId } = (await req.json().catch(() => ({}))) as { leadId?: string };

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: ENROLLMENT_FEE_PAISE,
      currency: "INR",
      receipt: leadId ? `lead-${leadId}` : `enroll-${Date.now()}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Razorpay order creation failed", res.status, text);
    return new Response("Failed to create payment order.", { status: 502 });
  }

  const order = await res.json();
  return Response.json({ orderId: order.id, amount: order.amount, currency: order.currency });
}
