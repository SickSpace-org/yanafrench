import { authErrorResponse, requireAdmin, requireStudent, type Viewer } from "@/lib/auth";
import { getQuizStore, setQuizLevelFor } from "@/lib/quizStore";
import { quizLevels, type QuizLevel } from "@/lib/quizData";

// GET: a student's own quiz level + history (dashboard/progress display —
// see lib/useQuizState.ts). A student always gets their own; an admin must
// name which student via ?studentUserId= (see Admin -> Lessons' Quiz tab).
export async function GET(req: Request) {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const studentUserId = new URL(req.url).searchParams.get("studentUserId");

  let targetUserId: string;
  if (viewer.role === "admin") {
    if (!studentUserId) return new Response("studentUserId is required.", { status: 400 });
    targetUserId = studentUserId;
  } else {
    targetUserId = viewer.userId;
  }

  return Response.json(await getQuizStore(targetUserId));
}

// PATCH: admin sets a specific student's CEFR level — replaces the old
// sitewide setQuizLevel PortalStateAction now that level is per-student.
export async function PATCH(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const studentUserId = typeof body?.studentUserId === "string" ? body.studentUserId : null;
  const level = body?.level as QuizLevel | undefined;

  if (!studentUserId || !level || !quizLevels.includes(level)) {
    return new Response("studentUserId and a valid level are required.", { status: 400 });
  }

  const saved = await setQuizLevelFor(studentUserId, level);
  if (!saved) return new Response("Not persisted — R2 isn't configured.", { status: 501 });
  return Response.json({ ok: true });
}
