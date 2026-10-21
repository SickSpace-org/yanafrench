import { clearMemberCookie } from "@/lib/aiHubSession";

// POST: "Use a different email" / log out — forgets this device.
export async function POST() {
  await clearMemberCookie();
  return Response.json({ ok: true });
}
