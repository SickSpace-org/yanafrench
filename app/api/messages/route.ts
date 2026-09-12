import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { getMessagesFor, appendMessageFor, type ThreadMessage } from "@/lib/messageStore";

export type { ThreadMessage };

// Per-student message thread — one document per student (see
// lib/messageStore.ts), not the single shared thread every student used
// to see. A student always reads/writes their own; an admin must name
// which student via ?studentUserId= (GET) / studentUserId in the body
// (POST) — see components/admin/AdminMessagesPage.tsx's conversation list.
function resolveTargetUserId(viewer: Viewer, studentUserId: string | null): string | Response {
  if (viewer.role === "admin") {
    if (!studentUserId) return new Response("studentUserId is required.", { status: 400 });
    return studentUserId;
  }
  return viewer.userId;
}

export async function GET(req: Request) {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const target = resolveTargetUserId(viewer, new URL(req.url).searchParams.get("studentUserId"));
  if (target instanceof Response) return target;

  return Response.json(await getMessagesFor(target));
}

export async function POST(req: Request) {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const studentUserId = typeof body?.studentUserId === "string" ? body.studentUserId : null;

  if (!text) return new Response("Invalid message", { status: 400 });

  const target = resolveTargetUserId(viewer, studentUserId);
  if (target instanceof Response) return target;

  // The sender's voice is derived from their actual role, never trusted
  // from the client — otherwise a student could post a message that
  // renders as if it came from the teacher, in their own thread.
  const from: ThreadMessage["from"] = viewer.role === "admin" ? "teacher" : "student";
  const message: ThreadMessage = { id: `msg-${Date.now()}`, from, text, time: Date.now() };

  const next = await appendMessageFor(target, message);
  if (!next) {
    return new Response("Messages aren't persisted yet — R2 isn't configured.", { status: 501 });
  }

  return Response.json(next);
}
