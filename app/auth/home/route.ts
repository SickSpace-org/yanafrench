import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";

// Sends the caller to the right landing page for their role. Used after
// login and after a password reset, so neither the client nor proxy has to
// duplicate the role -> home-page mapping.
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.redirect(new URL(homeForRole(viewer.role), request.url));
}
