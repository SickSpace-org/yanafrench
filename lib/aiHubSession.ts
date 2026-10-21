// Server-only. The cookie that remembers which Le Kiosque member entered
// their email on this device. It holds ONLY the member's id, signed so it
// can't be forged or swapped for another member's. It grants nothing by
// itself: lib/aiHub.ts re-reads the member row on every request, so pausing
// a member or letting their month run out takes effect immediately.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "kiosque_member";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(value: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY isn't configured.");
  return createHmac("sha256", key).update(`kiosque:${value}`).digest("base64url");
}

export async function setMemberCookie(memberId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, `${memberId}.${sign(memberId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearMemberCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

// The member id from a valid signed cookie, or null.
export async function readMemberCookie(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const id = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}
